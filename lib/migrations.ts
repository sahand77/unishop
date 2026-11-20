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
    if (!versions.has(3)) await client.query(`
      CREATE TABLE customers (id TEXT PRIMARY KEY, mobile TEXT UNIQUE NOT NULL);
      CREATE TABLE customer_sessions (token TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), expires BIGINT NOT NULL, mode TEXT NOT NULL);
      CREATE TABLE login_codes (id TEXT PRIMARY KEY, mobile TEXT NOT NULL, hash TEXT NOT NULL, expires BIGINT NOT NULL, created BIGINT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used BOOLEAN NOT NULL DEFAULT false, ready BOOLEAN NOT NULL DEFAULT false, mode TEXT NOT NULL);
      CREATE INDEX login_codes_mobile_created ON login_codes(mobile, created);
      CREATE INDEX login_codes_created ON login_codes(created);
      INSERT INTO schema_migrations VALUES (3);
    `);
    if (!versions.has(4)) await client.query(`
      ALTER TABLE customer_sessions DROP COLUMN mode;
      ALTER TABLE login_codes DROP COLUMN mode;
      INSERT INTO schema_migrations VALUES (4);
    `);
    if (!versions.has(5)) await client.query(`
      ALTER TABLE orders ADD COLUMN customer_id TEXT REFERENCES customers(id), ADD COLUMN tracking_code TEXT;
      CREATE INDEX orders_customer_created ON orders(customer_id,created DESC);
      CREATE TABLE customer_addresses (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), recipient JSONB NOT NULL);
      CREATE INDEX addresses_customer ON customer_addresses(customer_id);
      INSERT INTO schema_migrations VALUES (5);
    `);
    if (!versions.has(6)) await client.query(`
      ALTER TABLE orders ADD COLUMN fulfillment_status TEXT NOT NULL DEFAULT 'awaiting_confirmation'
        CHECK (fulfillment_status IN ('awaiting_confirmation', 'awaiting_shipment', 'shipped'));
      UPDATE orders SET fulfillment_status='shipped'
        WHERE status='paid' AND NULLIF(BTRIM(tracking_code), '') IS NOT NULL;
      INSERT INTO schema_migrations VALUES (6);
    `);
    if (!versions.has(7)) await client.query(`
      ALTER TABLE orders DROP CONSTRAINT orders_fulfillment_status_check,
        ADD CONSTRAINT orders_fulfillment_status_check
          CHECK (fulfillment_status IN ('awaiting_confirmation', 'awaiting_shipment', 'shipped', 'canceled'));
      INSERT INTO schema_migrations VALUES (7);
    `);
  });
}
