import { transaction } from "./db";

export async function migrate() {
  await transaction(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);
    `);
    const { rows } = await client.query<{ version: number }>("SELECT version FROM schema_migrations");
    const versions = new Set(rows.map((row) => row.version));
    if (!versions.has(1)) await client.query(`
      CREATE TABLE admins (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
      CREATE TABLE sessions (token TEXT PRIMARY KEY, admin_id TEXT REFERENCES admins(id) NOT NULL, expires BIGINT NOT NULL);
      CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL);
      CREATE TABLE products (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, category_id TEXT REFERENCES categories(id),
        kind TEXT NOT NULL CHECK(kind IN ('simple','variable')), status TEXT NOT NULL CHECK(status IN ('draft','published')),
        image TEXT NOT NULL, attributes TEXT NOT NULL, updated BIGINT NOT NULL,
        sequence BIGINT GENERATED ALWAYS AS IDENTITY
      );
      CREATE TABLE offers (
        id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), options TEXT NOT NULL, combination TEXT NOT NULL,
        price INTEGER NOT NULL CHECK(price >= 0), stock INTEGER NOT NULL CHECK(stock >= 0),
        reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0 AND reserved <= stock),
        weight INTEGER NOT NULL CHECK(weight >= 0), sku TEXT NOT NULL, image TEXT NOT NULL,
        active INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
        sequence BIGINT GENERATED ALWAYS AS IDENTITY
      );
      CREATE INDEX offers_by_product ON offers(product_id);
      CREATE UNIQUE INDEX active_combinations ON offers(product_id, combination) WHERE archived = 0;
      CREATE UNIQUE INDEX active_skus ON offers(sku) WHERE archived = 0;
      CREATE TABLE shipping (
        id TEXT PRIMARY KEY, priority INTEGER NOT NULL, config TEXT NOT NULL,
        sequence BIGINT GENERATED ALWAYS AS IDENTITY
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, attempt TEXT UNIQUE NOT NULL, secret TEXT NOT NULL, customer TEXT NOT NULL, quote TEXT NOT NULL,
        amount BIGINT NOT NULL, authority TEXT UNIQUE, mode TEXT NOT NULL, status TEXT NOT NULL,
        reference TEXT, message TEXT, created BIGINT NOT NULL, request_started BIGINT NOT NULL
      );
      INSERT INTO schema_migrations VALUES (1);
    `);
    if (!versions.has(2)) await client.query(`
      ALTER TABLE products ADD COLUMN gallery JSONB NOT NULL DEFAULT '[]'::jsonb;
      INSERT INTO schema_migrations VALUES (2);
    `);
  });
}
