import { Pool, type PoolClient } from "pg";

const runtime = globalThis as typeof globalThis & { unishopPool?: Pool };

export function db() {
  if (runtime.unishopPool) return runtime.unishopPool;
  const connectionString = process.env.DATABASE_URL;
  const password = process.env.PGPASSWORD;
  if (!connectionString && !password) {
    throw new Error("اتصال PostgreSQL تنظیم نشده است.");
  }
  runtime.unishopPool = new Pool({
    connectionString,
    password: connectionString ? undefined : password,
    connectionTimeoutMillis: 5000,
  });
  runtime.unishopPool.on("error", (error) => console.error("PostgreSQL pool:", error.message));
  return runtime.unishopPool;
}

export async function closeDb() {
  const pool = runtime.unishopPool;
  delete runtime.unishopPool;
  await pool?.end();
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    // Serialize inventory and order writes across app processes, as with the original write transaction.
    await client.query("SELECT pg_advisory_xact_lock(839977, 1)");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}