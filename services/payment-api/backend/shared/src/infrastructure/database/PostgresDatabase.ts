import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

export class PostgresDatabase {
  readonly pool: Pool;

  constructor(connectionString = process.env.DATABASE_URL ?? 'postgres://payandgo:payandgo@127.0.0.1:5432/payandgo') {
    this.pool = new Pool({ connectionString, max: Number(process.env.DB_POOL_SIZE ?? 10) });
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}
