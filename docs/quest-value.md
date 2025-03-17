## Поле `value`: ключевые атрибуты

Самое главное, что в этом поле (объект JSON) должен быть **`type`** , который определяет, как именно сервис поймёт, каким образом проверять квест. Варианты значений, которые в коде обрабатываются по-разному:

1. **`type`:** `"onchain"`
2. **`type`:** `"link"`
3. **`type`:** `"checkMethod"`
4. **`type`:** `"checkOnchainMethod"`
5. **`type`:** `"checkInputData"`

В зависимости от `type`, структура внутри `value` может отличаться.

### 1. `type = "onchain"`

Это основной формат для “он-чейн” (on-chain) квестов. Суть в том, что сервис:

- забирает список транзакций пользователя на указанном блокчейне (чаще всего `Soneium`),
- проверяет, есть ли среди них подходящая транзакция, соответствующая описанию в `actions` (метод, параметры, сумма, адрес контракта и т.д.).

Минимальный набор полей для `type = "onchain"`:

```json
{
  "type": "onchain",
  "chain": "Soneium",
  "contracts": [
    "0x..."
  ],
  "actions": [
    {
      "methodSignatures": [...],
      "tokens": [...],
      "minUsdTotal": 0.1,
      "orderedTokens": false
    }
  ]
}

```

- **`chain`** : название сети, из которой будем забирать транзакции. В коде чаще всего ориентируемся на `"Soneium"`.
- **`contracts`** : массив адресов смарт-контрактов, с которыми должна взаимодействовать транзакция (сервис фильтрует транзакции пользователя по `to = ...`, где `to` совпадает с одним из указанных адресов).
- **`actions`** : массив шагов для проверки. Обычно это один объект, но может быть и несколько.

#### Внутри `actions[]`:

1. **`methodSignatures`** — список сигнатур функций, по которым мы будем парсить `tx.input`. Примеры:

   ***

   ```json
   ["function multicall(bytes[] data) payable returns (bytes[] results)", "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"]
   ```

   Сервис пытается спарсить транзакцию с помощью каждой сигнатуры из этого массива. Если получилось спарсить (т. е. метод совпал), тогда идёт дальнейшая проверка аргументов (tokens, суммы и т. д.).

2. **`tokens`** _(не всегда обязательно, но обычно нужно)_ — массив описаний токенов, которые мы ищем в аргументах:

   ```json
   [
     {
       "address": "0x2cae934a1e84f693fbb78ca5ed3b0a6893259441",
       "paramIndex": 5,
       "paramIndexToken": 0,
       "minAmountToken": 0.03
     }
   ]
   ```

   - `address`: адрес токена, который ищем.
   - `paramIndex`: индекс аргумента внутри вызываемого метода, где хранится количество (amount). Сервис будет извлекать это значение, конвертировать в USD и сравнивать с `minUsdTotal`.
   - `paramIndexToken`: индекс аргумента, где лежит указатель (или массив) с адресом токена (когда нужно проверить, что действительно это тот самый токен).
   - `minAmountToken`: если хотим проверить минимальный _количественный_ порог (в самом токене), используем это поле.

   Обратите внимание: если транзакция сложная (например, вызывается `multicall` с несколькими подпроцессами), код рекурсивно разбирает все вложенные вызовы.
   **Важно** : если в `tokens` два и более токенов, и `orderedTokens = true`, то проверяется порядок следования этих токенов в транзакции (нужно, чтобы один шел после другого). Если `false`, порядок не важен.

3. **`minUsdTotal`** — минимальное значение операции (в долларах), суммирующееся по всем переданным в транзакцию токенам (или иногда по итоговому количеству). Например, если пользователь должен совершить swap на сумму в 10 USD, мы ставим `minUsdTotal: 10`.
4. **`orderedTokens`** — булевское поле, указывающее, важен ли порядок токенов, которые участвуют во входных параметрах.

В коде может использоваться и верхнеуровневое поле `minAmountUSD`, но чаще `minUsdTotal` располагается внутри `actions`.

##### Примеры:

- **Добавление ликвидности V3** (пример из БД):

  ```json
  {
    "type": "onchain",
    "chain": "Soneium",
    "actions": [
      {
        "tokens": [
          { "address": "0x2cae93...", "paramIndex": 5, "paramIndexToken": 0 },
          { "address": "0x420000...", "paramIndex": 6, "paramIndexToken": 1 }
        ],
        "minUsdTotal": 0.03,
        "orderedTokens": false,
        "methodSignatures": ["function multicall(bytes[] data) payable returns (bytes[] results)", "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"]
      }
    ],
    "contracts": ["0xAE2B32E6..."]
  }
  ```

  Здесь метод либо `multicall`, либо `mint`. Сервис найдёт соответствующие параметры и проверит, что сумма в USD больше `minUsdTotal`.

- **Простая проверка депозита** :

{

```json

  "type": "onchain",
  "chain": "Soneium",
  "actions": [
    {
      "tokens": [
        { "address": "0xbA9986D2381edf1DA03b0b9c1f8b00dc4AacC369", "paramIndex": 0 }
      ],
      "minUsdTotal": 1,
      "methodSignatures": ["function deposit(uint256 amount)"]
    }
  ],
  "contracts": ["0x34834F20..."]
}
```

Здесь сервис будет искать транзакцию на адрес `0x34834F20...` (или другой из `contracts`) с вызовом `deposit(uint256 amount)` и проверять, что переданный `amount` соответствует сумме в долларов выше `1` (исходя из цены соответствующего токена).

### 2. `type = "link"`

Этот вариант встречается, если квест проверяется **через внешний эндпоинт** или же через простую on-chain проверку типа “hasMinted(address)”.

```json
{
  "type": "link",
  "params": "{address: ${address}, outputToken: ... }",
  "endpoint": "https://example.com/external-quest/swap/1868",
  "contract": "0x181b42ca4856237AE76eE8c67F8FF112491eCB9e",
  "expression": "data => data.ok"
}
```

Сервис смотрит внутри `handleLinkQuest(quest, userAddr)` на такие поля:

1. **`contract`** (необязательно): если есть, то сначала пытается вызвать в смарт-контракте метод:

   ```solidity
   function hasMinted(address user) view returns (bool)
   ```

   Если вызов вернёт `true`, квест считается выполненным.

   > Пример:
   >
   > ```json
   > {
   >   "type": "link",
   >   "contract": "0x181b42c..." // контракт с hasMinted(address)
   > }
   > ```

2. **`endpoint`** (необязательно): если есть, делает HTTP-запрос `fetch` на указанный URL. Параметры адреса пользователя (и любые другие) подставляются из `params`.

   - **`params`** : строка, в которой можно указать `\${address}` (или другие поля) для автоматической подстановки.
   - Пример `params`:

     ```json
     "params": "{address: ${address}, minOutputAmount: 0.2}"
     ```

     В коде это превращается в query string: `?address=0x1234...&minOutputAmount=0.2` и добавляется к `endpoint`.

   - Результат HTTP-запроса проверяется. Если задано поле **`expression`** , то это JavaScript-выражение, которое принимается как функция:

     ```javascript
     new Function('data', return (${task.expression})(data);)
     ```

     и если оно вернёт `true`, значит квест выполнен.

   - Если `expression` нет, но из респонса получаем JSON и там есть `data.verified === true`, то квест считается выполненным.

Итого, **`type = "link"`** даёт два сценария:

1. Только `contract` — проверка через `hasMinted()`.
2. Только `endpoint` (или оба) — проверка через внешний HTTP-запрос.

### 3. `type = "checkMethod"`

Используется, когда нужно **просто** проверить результат вызова метода у контракта (без поиска транзакции). Например, проверить, что у пользователя `balanceOf(...) > 0`.

Типичный пример из базы:

{

```json

  "type": "checkMethod",
  "chain": "Soneium",
  "contracts": ["0xEB255E4669Da7FeEf1F746a5a778b4e08b65a1A7"],
  "methodSignatures": [
    "function balanceOf(address account, uint256 id) view returns (uint256)"
  ]
}
```

Сервис:

1. Берёт первый (или единственный) адрес из `contracts`.
2. Берёт сигнатуру `balanceOf(...)`.
3. Вызывает `balanceOf(userAddress, 0)` — (в коде иногда жёстко передаётся `id=0`, будьте внимательны).
4. Сравнивает результат с нулём (`> 0` => квест выполнен).

Данный вариант полезен для проверок “держит ли пользователь NFT?” или “есть ли у него баланс по ERC-1155”.

### 4. `type = "checkOnchainMethod"`

Очень похож на обычный `onchain`, но отличается тем, что сервис по-другому парсит транзакции (добавлена логика, например, для `checkIn(bytes32 _uuid, ...)` или `execute(...)`).

```json
{
  "type": "checkOnchainMethod",
  "chain": "Soneium",
  "actions": [
    {
      "methodSignatures": ["function checkIn(bytes32 _uuid, uint256 _timestamp, uint256 _gasUsed, bytes _signature)"],
      "minUsdTotal": 0.01
    }
  ],
  "contracts": ["0xbd82e1a3f908AFb789f1F0b8f88b1FD0C2787A3D"]
}
```

Сервис ищет транзакции пользователя на адрес `0xbd82e1a3...`, проверяет, есть ли вызов `checkIn(...)`. Если он есть — квест засчитывается.

**Отличие от `"onchain"`** в том, что часть логики (например, парсинг `execute(...)`) может быть чуть сложнее, и вызываются особые проверки (`handleCheckOnchainMethodQuest`). Но структура в целом похожа: указываем `contracts`, `actions` со `methodSignatures` и т. д.

### 5. `type = "checkInputData"`

Используется, когда нужно напрямую анализировать сырые данные транзакции `tx.input`, без попытки парсить её через ABI. Чаще всего, чтобы проверить какую-то конкретную сигнатуру или последовательность байт в транзакции.

Например:

{

```json

  "type": "checkOnchainMethod",
  "chain": "Soneium",
  "actions": [
    {
      "methodSignatures": [
        "function checkIn(bytes32 _uuid, uint256 _timestamp, uint256 _gasUsed, bytes _signature)"
      ],
      "minUsdTotal": 0.01
    }
  ],
  "contracts": ["0xbd82e1a3f908AFb789f1F0b8f88b1FD0C2787A3D"]
}
```

Но при `type = "checkInputData"` в коде (`handleCheckOnchainMethodQuest` / `checkOnChainQuest`) приоритетно идёт проверка `tx.input.startsWith('0xac9650d8')`, `includes('2CAE93...')` и т. д. — это чистая проверка массива байт.

---
