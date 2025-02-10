import { Client } from 'pg';

export const name = '1674235300020_assign_ref_codes_to_existing_users';

export async function up(client: Client): Promise<void> {
  const { rows: users } = await client.query(`
    SELECT address, referral_code
    FROM users
  `);

  for (const user of users) {
    const currentCode = user.referral_code?.trim() || null;
    if (!currentCode) {
      const newCode = await generateUniqueReferralCode(client);
      await client.query(
        `UPDATE users SET referral_code = $1 WHERE address = $2`,
        [newCode, user.address.toLowerCase()]
      );
      console.log(`Assigned new code "${newCode}" to ${user.address}`);
    } else {
      console.log(
        `Skipping ${user.address}, because referral_code already set: "${currentCode}"`
      );
    }
  }
}

export async function down(client: Client): Promise<void> {
  await client.query(`UPDATE users SET referral_code = NULL`);
}

async function generateUniqueReferralCode(client: Client): Promise<string> {
  while (true) {
    const code = generateShortCode(5);
    const existing = await client.query(
      `SELECT address FROM users WHERE referral_code = $1`,
      [code]
    );
    if (existing.rows.length === 0) {
      return code;
    }
  }
}

function generateShortCode(length: number): string {
  const base = Math.random()
    .toString(36)
    .substring(2, 2 + length);
  return base.toUpperCase();
}
