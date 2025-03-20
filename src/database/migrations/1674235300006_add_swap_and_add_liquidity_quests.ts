import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export const name = '1674235300006_add_swap_and_add_liquidity_quests';

export async function up(client: Client): Promise<void> {
  await client.query(`
    INSERT INTO quests (id, name, description, image, value, campaign_id, quest_type, created_at, updated_at, sequence)
    VALUES
      (
        '${uuidv4()}', 
        'Swap ETH/ASTR via Swap Router', 
        'Perform a swap using the SWAP_ROUTER contract to exchange ETH for ASTR.', 
        'https://example.com/images/swap-eth-astr.png',
        '{
          "id": "quest6",
          "type": "onchain",
          "chain": "Soneium",
          "event": "Swap",
          "method": "exactInput",
          "contract": "0xDEf357D505690F1b0032a74C3b581163c23d1535",
          "tokens": ["0x4200000000000000000000000000000000000006", "0x2CAE934a1e84F693fbb78CA5ED3B0A6893259441"],
          "minSwapAmountUSD": 10,
          "abiFile": "swapRouter.ts"
        }',
        '018f0071-a409-4ec2-960b-7bdddd74d2ab',
        'onchain',
        NOW(),
        NOW(),
        3
      ),
      (
        '${uuidv4()}', 
        'Add Liquidity to Pool', 
        'Add liquidity to the pool by interacting with the liquidity pool contract.', 
        'https://example.com/images/add-liquidity.png',
        '{
          "id": "quest7",
          "type": "onchain",
          "chain": "Soneium",
          "event": "AddLiquidity",
          "methods": ["mint", "multicall"],
          "contract": "0x6f5F9d55f727928b644B04d987B1c0Cf50AF8C0B",
          "tokens": ["0x4200000000000000000000000000000000000006", "0x2CAE934a1e84F693fbb78CA5ED3B0A6893259441"],
          "minLiquidityAmountUSD": 20,
          "abiFile": "uniswapV3.ts"
        }',
        '018f0071-a409-4ec2-960b-7bdddd74d2ab',
        'onchain',
        NOW(),
        NOW(),
        4
      )
    ON CONFLICT (id) DO NOTHING;
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    DELETE FROM quests
    WHERE id IN (
      'uuid-for-quest6',
      'uuid-for-quest7'
    );
  `);
}
