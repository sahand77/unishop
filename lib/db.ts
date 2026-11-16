import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalState = globalThis as typeof globalThis & { unishopDb?: DatabaseSync };
export const dataDir = () => process.env.UNISHOP_DATA_DIR
  ? resolve(/* turbopackIgnore: true */ process.env.UNISHOP_DATA_DIR)
  : join(process.cwd(),"data");

export function db() {
  if (globalState.unishopDb) return globalState.unishopDb;
  mkdirSync(dataDir(), { recursive: true });
  const connection = new DatabaseSync(resolve(dataDir(), "shop.sqlite"));
  connection.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, admin_id TEXT REFERENCES admins(id) NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, category_id TEXT REFERENCES categories(id),
      kind TEXT NOT NULL CHECK(kind IN ('simple','variable')), status TEXT NOT NULL CHECK(status IN ('draft','published')),
      image TEXT NOT NULL, attributes TEXT NOT NULL, updated INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), options TEXT NOT NULL, combination TEXT NOT NULL,
      price INTEGER NOT NULL CHECK(price >= 0), stock INTEGER NOT NULL CHECK(stock >= 0),
      reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0 AND reserved <= stock),
      weight INTEGER NOT NULL CHECK(weight >= 0), sku TEXT NOT NULL, image TEXT NOT NULL,
      active INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS active_combinations ON offers(product_id, combination) WHERE archived = 0;
    CREATE UNIQUE INDEX IF NOT EXISTS active_skus ON offers(sku) WHERE archived = 0;
    CREATE TABLE IF NOT EXISTS shipping (id TEXT PRIMARY KEY, priority INTEGER NOT NULL, config TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, attempt TEXT UNIQUE NOT NULL, secret TEXT NOT NULL, customer TEXT NOT NULL, quote TEXT NOT NULL,
      amount INTEGER NOT NULL, authority TEXT UNIQUE, mode TEXT NOT NULL, status TEXT NOT NULL,
      reference TEXT, message TEXT, created INTEGER NOT NULL, request_started INTEGER NOT NULL
    );
  `);
  globalState.unishopDb = connection;
  return connection;
}

export function transaction<T>(work: () => T): T {
  const connection = db();
  connection.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    connection.exec("COMMIT");
    return result;
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}