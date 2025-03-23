import { PoolClient } from 'pg';

export const name = '1674235300020_assign_ref_codes_to_existing_users';

export async function up(client: PoolClient): Promise<void> {
  console.log('Fetching users without referral codes...');
  const { rows: users } = await client.query(
    `SELECT address FROM users WHERE referral_code IS NULL`
  );

  if (users.length === 0) {
    console.log('All users already have referral codes. Skipping migration.');
    return;
  }

  console.log(
    `Found ${users.length} users without referral codes. Generating codes...`
  );

  const usedCodes = new Set<string>();
  const newCodesMap = new Map<string, string>();

  for (const user of users) {
    let newCode: string;
    do {
      newCode = generateShortCode(5);
    } while (usedCodes.has(newCode));

    usedCodes.add(newCode);
    newCodesMap.set(user.address.toLowerCase(), newCode);
  }

  console.log(`Generated ${newCodesMap.size} unique referral codes.`);

  console.log('Updating database in batches...');
  const batchSize = 500;

  const addresses = Array.from(newCodesMap.keys());

  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);

    const values = batch
      .map((addr, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`)
      .join(', ');

    const updateQuery = `
      UPDATE users AS u
      SET referral_code = c.referral_code
      FROM (VALUES ${values}) AS c(address, referral_code)
      WHERE u.address = c.address;
    `;

    const updateValues = batch.flatMap((addr) => [addr, newCodesMap.get(addr)]);

    await client.query(updateQuery, updateValues);
    console.log(`Updated ${batch.length} users.`);
  }

  console.log('Migration complete.');
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`UPDATE users SET referral_code = NULL`);
}

function generateShortCode(length: number): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length)
    .toUpperCase();
}
