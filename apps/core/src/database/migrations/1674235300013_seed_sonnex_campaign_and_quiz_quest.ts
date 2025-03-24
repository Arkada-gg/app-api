import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export const name = '1674235300013_seed_sonnex_campaign_and_quiz_quest';

export async function up(client: PoolClient): Promise<void> {
  // 1. Удаление всех кампаний, кроме 'sonnex'
  await client.query(`
    DELETE FROM campaigns
    WHERE slug != 'sonnex';
  `);

  // 2. Вставка кампании 'sonnex'
  await client.query(`
    INSERT INTO campaigns (
      id, slug, name, description, image, rewards, started_at, finished_at,
      participants, type, promo, short_description, difficulty, created_at, updated_at
    ) VALUES (
      '018f0071-a409-4ec2-960b-7bdddd74d2ab',
      'sonnex',
      'SONEX',
      'SONEX is an AI-powered next-generation DeFi hub within the Soneium ecosystem integrating DeFi and entertainment. It is dedicated to providing a secure, efficient, and user-friendly cryptocurrency trading experience. By leveraging blockchain technology and AI-driven insights, SONEX aims to revolutionize the decentralized finance space and empower users with a robust and dynamic platform.',
      'https://sonex-1.gitbook.io/sonex/media-kit',
      '[{"type":"tokens","value":"150"}, {"type":"tokens","value":"100"}]',
      '2025-01-01 00:00:00',
      '2025-03-31 23:59:59',
      200,
      'basic',
      'SONEX is an AI-powered decentralized exchange (DEX) hub designed to leverage the power of Soneium, a blockchain solution created by Sony Corporation, offering users a fast, secure, and efficient way to trade digital assets. Built with cutting-edge blockchain technology, SONEX aims to deliver a seamless trading experience with a strong focus on innovation, collaboration, and user empowerment.',
      'SONEX is an AI-powered decentralized exchange (DEX) hub designed to leverage the power of Soneium, offering users a fast, secure, and efficient way to trade digital assets.',
      'medium',
      NOW(),
      NOW()
    )
    ON CONFLICT (slug) DO NOTHING;
  `);

  const quizQuestId = uuidv4();
  const swapQuestId = '1d0eabb9-6a80-4198-a47d-44cdd2898f88';
  const addLiquidityQuestId = '58d3fdd2-cc12-4948-a62c-9f41ca8e4d82';

  const quizQuestions = [
    {
      question:
        'What is the primary focus of SONEX as a decentralized exchange (DEX) hub?',
      choices: [
        'A. Multi-chain interoperability and asset trading',
        'B. Exclusive integration with the Soneium blockchain for optimized DeFi and entertainment services',
        'C. Providing liquidity for Ethereum and Binance Smart Chain',
        'D. Acting as a centralized exchange platform',
      ],
      correct_answer: 'B',
    },
    {
      question: 'Which of the following is NOT a key feature of SONEX?',
      choices: [
        'A. Alpha hunting and AI-powered insights for trading optimization',
        'B. Gamified features integrating DeFi with GameFi',
        'C. Cross-chain integration to aggregate multi-chain assets',
        'D. Hosting NFT marketplaces for Ethereum-based assets',
      ],
      correct_answer: 'D',
    },
    {
      question:
        'What significant milestone has SONEX achieved in its development journey?',
      choices: [
        'A. Partnering with Ethereum to launch its meme token ecosystem',
        'B. Becoming one of the 32 projects selected for the Soneium Spark incubation program',
        'C. Launching the first multi-chain staking pool on Binance Smart Chain',
        'D. Reaching 50 million ASTR in total value locked (TVL) during the Astar Surge Campaign',
      ],
      correct_answer: 'B',
    },
  ];

  // 3. Вставка квестов
  await client.query(`
    INSERT INTO quests (
      id, name, description, image, value, campaign_id, quest_type, sequence, link, created_at, updated_at
    ) VALUES
      (
        '${quizQuestId}',
        'SONEX Quiz',
        'Test your knowledge about SONEX by answering the following multiple-choice questions.',
        'https://sonex-1.gitbook.io/sonex/media-kit',
        '${JSON.stringify(quizQuestions)}',
        '018f0071-a409-4ec2-960b-7bdddd74d2ab',
        'quiz',
        1,
        NULL,
        NOW(),
        NOW()
      ),
      (
        '${swapQuestId}', 
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
        3,
        NULL,
        NOW(),
        NOW()
      ),
      (
        '${addLiquidityQuestId}', 
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
        4,
        NULL,
        NOW(),
        NOW()
      )
    ON CONFLICT (id) DO NOTHING;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DELETE FROM quests
    WHERE id = (
      SELECT id FROM quests
      WHERE campaign_id = '018f0071-a409-4ec2-960b-7bdddd74d2ab' AND name = 'SONEX Quiz'
      LIMIT 1
    );
  `);

  await client.query(`
    DELETE FROM campaigns
    WHERE id = '018f0071-a409-4ec2-960b-7bdddd74d2ab';
  `);
}
