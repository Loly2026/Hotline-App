import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "hotline.db");

export const db = new Database(dbPath);

export function initSchema() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS governorates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name_ar TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name_ar TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      governorate_id INTEGER,
      phone TEXT NOT NULL,
      address TEXT,
      notes TEXT,
      source_url TEXT,
      last_verified TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
      FOREIGN KEY (governorate_id) REFERENCES governorates (id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts (name_ar);
    CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts (phone);
    CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts (category_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_governorate ON contacts (governorate_id);

    CREATE TABLE IF NOT EXISTS contact_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_contact_requests_contact ON contact_requests (contact_id);
    CREATE INDEX IF NOT EXISTS idx_contact_requests_time ON contact_requests (requested_at);

    CREATE TABLE IF NOT EXISTS pending_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar TEXT NOT NULL,
      phone TEXT NOT NULL,
      category_slug TEXT,
      message TEXT,
      handled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Backfill schema changes safely for existing DB files.
  const contactColumns = db.prepare("PRAGMA table_info(contacts)").all();
  const hasIsNonPhone = contactColumns.some((c) => c.name === "is_non_phone");
  if (!hasIsNonPhone) {
    db.exec("ALTER TABLE contacts ADD COLUMN is_non_phone INTEGER NOT NULL DEFAULT 0;");
    db.exec("CREATE INDEX IF NOT EXISTS idx_contacts_non_phone ON contacts (is_non_phone);");
  }
  const hasIsFeatured = contactColumns.some((c) => c.name === "is_featured");
  if (!hasIsFeatured) {
    db.exec("ALTER TABLE contacts ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;");
    db.exec("CREATE INDEX IF NOT EXISTS idx_contacts_featured ON contacts (is_featured);");
  }
  const hasIsVerified = contactColumns.some((c) => c.name === "is_verified");
  if (!hasIsVerified) {
    db.exec("ALTER TABLE contacts ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0;");
    db.exec("CREATE INDEX IF NOT EXISTS idx_contacts_verified ON contacts (is_verified);");
  }
  const hasPriorityRank = contactColumns.some((c) => c.name === "priority_rank");
  if (!hasPriorityRank) {
    db.exec("ALTER TABLE contacts ADD COLUMN priority_rank INTEGER NOT NULL DEFAULT 0;");
    db.exec("CREATE INDEX IF NOT EXISTS idx_contacts_priority_rank ON contacts (priority_rank);");
  }
}
