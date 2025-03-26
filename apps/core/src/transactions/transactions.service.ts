import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ITransaction } from '../shared/interfaces';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly dbService: DatabaseService) { }

  async findByHashAndChainId(hash: string, chainId: number): Promise<ITransaction | null> {
    const client = await this.dbService.getClient();

    try {
      // Query the database to get the transaction by its hash
      const transactionResult = await client.query<ITransaction>(
        `SELECT * FROM transactions WHERE hash = $1 AND chain_id = $2`,
        [hash, chainId]
      );

      // If no transaction is found, return null
      if (!transactionResult.rows[0]) {
        return null;
      }

      return transactionResult.rows[0];
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    } finally {
      client.release();
    }
  }

  async createTx(txData: Omit<ITransaction, 'created_at'>): Promise<boolean> {
    const client = await this.dbService.getClient();

    try {
      // Check if the transaction with the same hash already exists
      const transactionResult = await client.query<ITransaction>(
        `SELECT * FROM transactions WHERE hash = $1 AND chain_id = $2`,
        [txData.hash, txData.chain_id]
      );

      // If a transaction with the same hash already exists, return false
      if (transactionResult.rows.length > 0) {
        return false; // Transaction already exists
      }

      // Insert the new transaction into the database
      await client.query(
        `INSERT INTO transactions (hash, event_name, block_number, args, chain_id, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          txData.hash,
          txData.event_name,
          txData.block_number,
          JSON.stringify(
            txData.args,
            (_, value) => (typeof value === 'bigint' ? Number(value) : value) // return everything else unchanged
          ),
          txData.chain_id,
          new Date().toISOString(),
        ]
      );

      return true; // Transaction created successfully
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    } finally {
      client.release();
    }
  }
}
