import Database from "better-sqlite3";
import { Pool } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, "..", "hotline.db");

const sqlite = new Database(sqlitePath, { readonly: true });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS governorates (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name_ar TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name_ar TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name_ar TEXT NOT NULL,
        category_id INTEGER NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
        governorate_id INTEGER REFERENCES governorates (id) ON DELETE SET NULL,
        phone TEXT NOT NULL,
        address TEXT,
        notes TEXT,
        source_url TEXT,
        last_verified TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_non_phone BOOLEAN NOT NULL DEFAULT FALSE,
        is_featured BOOLEAN NOT NULL DEFAULT FALSE,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        priority_rank INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS contact_requests (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pending_requests (
        id SERIAL PRIMARY KEY,
        name_ar TEXT NOT NULL,
        phone TEXT NOT NULL,
        category_slug TEXT,
        message TEXT,
        handled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query("DELETE FROM contact_requests");
    await client.query("DELETE FROM pending_requests");
    await client.query("DELETE FROM contacts");
    await client.query("DELETE FROM categories");
    await client.query("DELETE FROM governorates");

    const governorates = sqlite.prepare("SELECT id, code, name_ar FROM governorates ORDER BY id ASC").all();
    for (const row of governorates) {
      await client.query(
        "INSERT INTO governorates (id, code, name_ar) VALUES ($1, $2, $3)",
        [row.id, row.code, row.name_ar]
      );
    }
    await client.query(
      "SELECT setval(pg_get_serial_sequence('governorates','id'), COALESCE((SELECT MAX(id) FROM governorates), 1), true)"
    );

    const categories = sqlite.prepare("SELECT id, slug, name_ar FROM categories ORDER BY id ASC").all();
    for (const row of categories) {
      await client.query(
        "INSERT INTO categories (id, slug, name_ar) VALUES ($1, $2, $3)",
        [row.id, row.slug, row.name_ar]
      );
    }
    await client.query(
      "SELECT setval(pg_get_serial_sequence('categories','id'), COALESCE((SELECT MAX(id) FROM categories), 1), true)"
    );

    const contacts = sqlite.prepare(
      `SELECT
         id,
         name_ar,
         category_id,
         governorate_id,
         phone,
         address,
         notes,
         source_url,
         last_verified,
         created_at,
         COALESCE(is_non_phone, 0) AS is_non_phone,
         COALESCE(is_featured, 0) AS is_featured,
         COALESCE(is_verified, 0) AS is_verified,
         COALESCE(priority_rank, 0) AS priority_rank
       FROM contacts
       ORDER BY id ASC`
    ).all();

    for (const row of contacts) {
      await client.query(
        `INSERT INTO contacts
           (id, name_ar, category_id, governorate_id, phone, address, notes, source_url, last_verified, created_at, is_non_phone, is_featured, is_verified, priority_rank)
         VALUES
           ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          row.id,
          row.name_ar,
          row.category_id,
          row.governorate_id,
          row.phone,
          row.address,
          row.notes,
          row.source_url,
          row.last_verified,
          row.created_at,
          !!row.is_non_phone,
          !!row.is_featured,
          !!row.is_verified,
          row.priority_rank
        ]
      );
    }
    await client.query(
      "SELECT setval(pg_get_serial_sequence('contacts','id'), COALESCE((SELECT MAX(id) FROM contacts), 1), true)"
    );

    const requests = sqlite.prepare("SELECT id, contact_id, requested_at FROM contact_requests ORDER BY id ASC").all();
    for (const row of requests) {
      await client.query(
        "INSERT INTO contact_requests (id, contact_id, requested_at) VALUES ($1, $2, $3)",
        [row.id, row.contact_id, row.requested_at]
      );
    }
    await client.query(
      "SELECT setval(pg_get_serial_sequence('contact_requests','id'), COALESCE((SELECT MAX(id) FROM contact_requests), 1), true)"
    );

    const pending = sqlite
      .prepare("SELECT id, name_ar, phone, category_slug, message, handled, created_at FROM pending_requests ORDER BY id ASC")
      .all();
    for (const row of pending) {
      await client.query(
        `INSERT INTO pending_requests (id, name_ar, phone, category_slug, message, handled, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [row.id, row.name_ar, row.phone, row.category_slug, row.message, !!row.handled, row.created_at]
      );
    }
    await client.query(
      "SELECT setval(pg_get_serial_sequence('pending_requests','id'), COALESCE((SELECT MAX(id) FROM pending_requests), 1), true)"
    );

    await client.query("COMMIT");
    console.log("Migration to Postgres completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main();
