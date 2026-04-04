import { Pool } from "pg";
import { db as sqliteDb, initSchema as initSqliteSchema } from "./db.js";

function normalizeFlag(value) {
  return value ? 1 : 0;
}

function mapContactRow(row) {
  if (!row) return row;
  return {
    ...row,
    is_non_phone: normalizeFlag(row.is_non_phone),
    is_featured: normalizeFlag(row.is_featured),
    is_verified: normalizeFlag(row.is_verified),
    is_national: normalizeFlag(row.is_national)
  };
}

function mapRequestRow(row) {
  if (!row) return row;
  return {
    ...row,
    handled: normalizeFlag(row.handled)
  };
}

function createSqliteStore() {
  return {
    async initSchema() {
      initSqliteSchema();
    },

    async getGovernorates() {
      return sqliteDb.prepare("SELECT id, code, name_ar FROM governorates ORDER BY name_ar ASC").all();
    },

    async getCategories() {
      return sqliteDb.prepare("SELECT id, slug, name_ar FROM categories ORDER BY name_ar ASC").all();
    },

    async getCoverage() {
      const totals = sqliteDb
        .prepare(
          `SELECT
             COUNT(*) AS total_contacts,
             SUM(CASE WHEN governorate_id IS NULL THEN 1 ELSE 0 END) AS national_contacts
           FROM contacts`
        )
        .get();

      const byCategory = sqliteDb
        .prepare(
          `SELECT
             cat.slug,
             cat.name_ar,
             COUNT(c.id) AS contacts_count,
             COUNT(DISTINCT c.governorate_id) AS covered_governorates
           FROM categories cat
           LEFT JOIN contacts c ON c.category_id = cat.id
           GROUP BY cat.id
           ORDER BY cat.name_ar ASC`
        )
        .all();

      const byGovernorate = sqliteDb
        .prepare(
          `SELECT
             g.code,
             g.name_ar,
             COUNT(c.id) AS contacts_count
           FROM governorates g
           LEFT JOIN contacts c ON c.governorate_id = g.id
           GROUP BY g.id
           ORDER BY g.name_ar ASC`
        )
        .all();

      return { totals, byCategory, byGovernorate };
    },

    async getPopularContacts(limit) {
      return sqliteDb
        .prepare(
          `SELECT
             c.id,
             c.name_ar,
             c.phone,
             c.address,
             c.notes,
             c.source_url,
             c.last_verified,
             c.is_non_phone,
             c.is_featured,
             c.is_verified,
             c.priority_rank,
             cat.slug AS category_slug,
             cat.name_ar AS category_name_ar,
             g.code AS governorate_code,
             g.name_ar AS governorate_name_ar,
             CASE WHEN c.governorate_id IS NULL THEN 1 ELSE 0 END AS is_national,
             COUNT(cr.id) AS requests_count
           FROM contact_requests cr
           JOIN contacts c ON cr.contact_id = c.id
           JOIN categories cat ON c.category_id = cat.id
           LEFT JOIN governorates g ON c.governorate_id = g.id
           GROUP BY c.id
           ORDER BY requests_count DESC, c.name_ar ASC
           LIMIT ?`
        )
        .all(limit)
        .map(mapContactRow);
    },

    async contactExists(id) {
      return sqliteDb.prepare("SELECT id FROM contacts WHERE id = ?").get(id) || null;
    },

    async insertContactRequest(contactId) {
      sqliteDb.prepare("INSERT INTO contact_requests (contact_id) VALUES (?)").run(contactId);
    },

    async searchContacts({ q = "", category = "", governorate = "", limit = 100, offset = 0 }) {
      const where = [];
      const params = {
        q: `%${String(q).trim()}%`,
        category: String(category).trim(),
        governorate: String(governorate).trim(),
        limit,
        offset
      };

      if (params.category) where.push("cat.slug = @category");
      if (params.governorate) where.push("(g.code = @governorate OR c.governorate_id IS NULL)");
      if (String(q).trim()) {
        where.push(`(
          c.name_ar LIKE @q OR
          c.phone LIKE @q OR
          IFNULL(c.address, '') LIKE @q OR
          IFNULL(c.notes, '') LIKE @q OR
          cat.name_ar LIKE @q
        )`);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const rows = sqliteDb
        .prepare(
          `SELECT
             c.id,
             c.name_ar,
             c.phone,
             c.address,
             c.notes,
             c.source_url,
             c.last_verified,
             c.is_non_phone,
             c.is_featured,
             c.is_verified,
             c.priority_rank,
             cat.slug AS category_slug,
             cat.name_ar AS category_name_ar,
             g.code AS governorate_code,
             g.name_ar AS governorate_name_ar,
             CASE WHEN c.governorate_id IS NULL THEN 1 ELSE 0 END AS is_national
           FROM contacts c
           JOIN categories cat ON c.category_id = cat.id
           LEFT JOIN governorates g ON c.governorate_id = g.id
           ${whereSql}
           ORDER BY c.is_featured DESC, c.priority_rank DESC, c.is_verified DESC, is_national DESC, c.name_ar ASC
           LIMIT @limit OFFSET @offset`
        )
        .all(params)
        .map(mapContactRow);
      return rows;
    },

    async insertPending(payload) {
      sqliteDb
        .prepare("INSERT INTO pending_requests (name_ar, phone, category_slug, message) VALUES (@name_ar, @phone, @category_slug, @message)")
        .run(payload);
    },

    async getCategoryBySlug(slug) {
      return sqliteDb.prepare("SELECT id FROM categories WHERE slug = ?").get(slug) || null;
    },

    async getGovernorateByCode(code) {
      return sqliteDb.prepare("SELECT id FROM governorates WHERE code = ?").get(code) || null;
    },

    async getPendingById(id) {
      return mapRequestRow(
        sqliteDb
          .prepare("SELECT id, name_ar, phone, category_slug, message, handled, created_at FROM pending_requests WHERE id = ?")
          .get(id)
      );
    },

    async markPendingHandled(id) {
      sqliteDb.prepare("UPDATE pending_requests SET handled = 1 WHERE id = ?").run(id);
    },

    async deletePending(id) {
      sqliteDb.prepare("DELETE FROM pending_requests WHERE id = ?").run(id);
    },

    async createContact(payload) {
      const result = sqliteDb
        .prepare(
          `INSERT INTO contacts (name_ar, phone, address, notes, is_non_phone, is_featured, is_verified, priority_rank, category_id, governorate_id)
           VALUES (@name_ar, @phone, @address, @notes, @is_non_phone, @is_featured, @is_verified, @priority_rank, @category_id, @governorate_id)`
        )
        .run(payload);
      return { id: result.lastInsertRowid };
    },

    async getAdminContacts({ q = "", category = "", limit = 200, offset = 0 }) {
      const where = [];
      const params = {
        q: `%${String(q).trim()}%`,
        category: String(category).trim(),
        limit,
        offset
      };
      if (params.category) where.push("cat.slug = @category");
      if (String(q).trim()) {
        where.push("(c.name_ar LIKE @q OR c.phone LIKE @q OR IFNULL(c.notes,'') LIKE @q OR cat.name_ar LIKE @q)");
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      return sqliteDb
        .prepare(
          `SELECT
             c.id,
             c.name_ar,
             c.phone,
             c.address,
             c.notes,
             c.is_non_phone,
             c.is_featured,
             c.is_verified,
             c.priority_rank,
             cat.slug AS category_slug,
             cat.name_ar AS category_name_ar,
             g.code AS governorate_code,
             g.name_ar AS governorate_name_ar
           FROM contacts c
           JOIN categories cat ON c.category_id = cat.id
           LEFT JOIN governorates g ON c.governorate_id = g.id
           ${whereSql}
           ORDER BY c.is_featured DESC, c.priority_rank DESC, c.is_verified DESC, c.id DESC
           LIMIT @limit OFFSET @offset`
        )
        .all(params)
        .map(mapContactRow);
    },

    async updateContact(id, payload) {
      sqliteDb
        .prepare(
          `UPDATE contacts
           SET name_ar=@name_ar, phone=@phone, address=@address, notes=@notes,
               is_non_phone=@is_non_phone, is_featured=@is_featured, is_verified=@is_verified,
               priority_rank=@priority_rank, category_id=@category_id, governorate_id=@governorate_id
           WHERE id=@id`
        )
        .run({ id, ...payload });
    },

    async deleteContact(id) {
      sqliteDb.prepare("DELETE FROM contacts WHERE id = ?").run(id);
    },

    async getAdminRequests(handled) {
      return sqliteDb
        .prepare(
          `SELECT id, name_ar, phone, category_slug, message, handled, created_at
           FROM pending_requests
           WHERE handled = @handled
           ORDER BY created_at DESC`
        )
        .all({ handled: handled ? 1 : 0 })
        .map(mapRequestRow);
    },

    async updateRequest(id, payload) {
      sqliteDb
        .prepare(
          `UPDATE pending_requests
           SET name_ar = @name_ar, phone = @phone, category_slug = @category_slug, message = @message, handled = @handled
           WHERE id = @id`
        )
        .run({ id, ...payload });
    }
  };
}

function createPostgresStore() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  async function query(text, params = []) {
    return pool.query(text, params);
  }

  return {
    async initSchema() {
      await query(`
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

        CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts (name_ar);
        CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts (phone);
        CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts (category_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_governorate ON contacts (governorate_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_non_phone ON contacts (is_non_phone);
        CREATE INDEX IF NOT EXISTS idx_contacts_featured ON contacts (is_featured);
        CREATE INDEX IF NOT EXISTS idx_contacts_verified ON contacts (is_verified);
        CREATE INDEX IF NOT EXISTS idx_contacts_priority_rank ON contacts (priority_rank);
        CREATE INDEX IF NOT EXISTS idx_contact_requests_contact ON contact_requests (contact_id);
        CREATE INDEX IF NOT EXISTS idx_contact_requests_time ON contact_requests (requested_at);
      `);
    },

    async getGovernorates() {
      const { rows } = await query("SELECT id, code, name_ar FROM governorates ORDER BY name_ar ASC");
      return rows;
    },

    async getCategories() {
      const { rows } = await query("SELECT id, slug, name_ar FROM categories ORDER BY name_ar ASC");
      return rows;
    },

    async getCoverage() {
      const totalsResult = await query(
        `SELECT
           COUNT(*)::int AS total_contacts,
           COALESCE(SUM(CASE WHEN governorate_id IS NULL THEN 1 ELSE 0 END), 0)::int AS national_contacts
         FROM contacts`
      );
      const byCategoryResult = await query(
        `SELECT
           cat.slug,
           cat.name_ar,
           COUNT(c.id)::int AS contacts_count,
           COUNT(DISTINCT c.governorate_id)::int AS covered_governorates
         FROM categories cat
         LEFT JOIN contacts c ON c.category_id = cat.id
         GROUP BY cat.id
         ORDER BY cat.name_ar ASC`
      );
      const byGovernorateResult = await query(
        `SELECT
           g.code,
           g.name_ar,
           COUNT(c.id)::int AS contacts_count
         FROM governorates g
         LEFT JOIN contacts c ON c.governorate_id = g.id
         GROUP BY g.id
         ORDER BY g.name_ar ASC`
      );
      return {
        totals: totalsResult.rows[0],
        byCategory: byCategoryResult.rows,
        byGovernorate: byGovernorateResult.rows
      };
    },

    async getPopularContacts(limit) {
      const { rows } = await query(
        `SELECT
           c.id,
           c.name_ar,
           c.phone,
           c.address,
           c.notes,
           c.source_url,
           c.last_verified,
           c.is_non_phone,
           c.is_featured,
           c.is_verified,
           c.priority_rank,
           cat.slug AS category_slug,
           cat.name_ar AS category_name_ar,
           g.code AS governorate_code,
           g.name_ar AS governorate_name_ar,
           CASE WHEN c.governorate_id IS NULL THEN 1 ELSE 0 END AS is_national,
           COUNT(cr.id)::int AS requests_count
         FROM contact_requests cr
         JOIN contacts c ON cr.contact_id = c.id
         JOIN categories cat ON c.category_id = cat.id
         LEFT JOIN governorates g ON c.governorate_id = g.id
         GROUP BY c.id, cat.slug, cat.name_ar, g.code, g.name_ar
         ORDER BY requests_count DESC, c.name_ar ASC
         LIMIT $1`,
        [limit]
      );
      return rows.map(mapContactRow);
    },

    async contactExists(id) {
      const { rows } = await query("SELECT id FROM contacts WHERE id = $1", [id]);
      return rows[0] || null;
    },

    async insertContactRequest(contactId) {
      await query("INSERT INTO contact_requests (contact_id) VALUES ($1)", [contactId]);
    },

    async searchContacts({ q = "", category = "", governorate = "", limit = 100, offset = 0 }) {
      const where = [];
      const values = [];
      let index = 1;

      if (category) {
        where.push(`cat.slug = $${index++}`);
        values.push(category);
      }
      if (governorate) {
        where.push(`(g.code = $${index++} OR c.governorate_id IS NULL)`);
        values.push(governorate);
      }
      if (String(q).trim()) {
        where.push(`(
          c.name_ar ILIKE $${index} OR
          c.phone ILIKE $${index} OR
          COALESCE(c.address, '') ILIKE $${index} OR
          COALESCE(c.notes, '') ILIKE $${index} OR
          cat.name_ar ILIKE $${index}
        )`);
        values.push(`%${String(q).trim()}%`);
        index += 1;
      }

      values.push(limit, offset);
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const { rows } = await query(
        `SELECT
           c.id,
           c.name_ar,
           c.phone,
           c.address,
           c.notes,
           c.source_url,
           c.last_verified,
           c.is_non_phone,
           c.is_featured,
           c.is_verified,
           c.priority_rank,
           cat.slug AS category_slug,
           cat.name_ar AS category_name_ar,
           g.code AS governorate_code,
           g.name_ar AS governorate_name_ar,
           CASE WHEN c.governorate_id IS NULL THEN 1 ELSE 0 END AS is_national
         FROM contacts c
         JOIN categories cat ON c.category_id = cat.id
         LEFT JOIN governorates g ON c.governorate_id = g.id
         ${whereSql}
         ORDER BY c.is_featured DESC, c.priority_rank DESC, c.is_verified DESC, is_national DESC, c.name_ar ASC
         LIMIT $${index++} OFFSET $${index}`,
        values
      );
      return rows.map(mapContactRow);
    },

    async insertPending(payload) {
      await query(
        "INSERT INTO pending_requests (name_ar, phone, category_slug, message) VALUES ($1, $2, $3, $4)",
        [payload.name_ar, payload.phone, payload.category_slug, payload.message]
      );
    },

    async getCategoryBySlug(slug) {
      const { rows } = await query("SELECT id FROM categories WHERE slug = $1", [slug]);
      return rows[0] || null;
    },

    async getGovernorateByCode(code) {
      const { rows } = await query("SELECT id FROM governorates WHERE code = $1", [code]);
      return rows[0] || null;
    },

    async getPendingById(id) {
      const { rows } = await query(
        "SELECT id, name_ar, phone, category_slug, message, handled, created_at FROM pending_requests WHERE id = $1",
        [id]
      );
      return mapRequestRow(rows[0]);
    },

    async markPendingHandled(id) {
      await query("UPDATE pending_requests SET handled = TRUE WHERE id = $1", [id]);
    },

    async deletePending(id) {
      await query("DELETE FROM pending_requests WHERE id = $1", [id]);
    },

    async createContact(payload) {
      const { rows } = await query(
        `INSERT INTO contacts
           (name_ar, phone, address, notes, is_non_phone, is_featured, is_verified, priority_rank, category_id, governorate_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          payload.name_ar,
          payload.phone,
          payload.address,
          payload.notes,
          !!payload.is_non_phone,
          !!payload.is_featured,
          !!payload.is_verified,
          payload.priority_rank,
          payload.category_id,
          payload.governorate_id
        ]
      );
      return { id: rows[0].id };
    },

    async getAdminContacts({ q = "", category = "", limit = 200, offset = 0 }) {
      const where = [];
      const values = [];
      let index = 1;

      if (category) {
        where.push(`cat.slug = $${index++}`);
        values.push(category);
      }
      if (String(q).trim()) {
        where.push(`(
          c.name_ar ILIKE $${index} OR
          c.phone ILIKE $${index} OR
          COALESCE(c.notes, '') ILIKE $${index} OR
          cat.name_ar ILIKE $${index}
        )`);
        values.push(`%${String(q).trim()}%`);
        index += 1;
      }

      values.push(limit, offset);
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const { rows } = await query(
        `SELECT
           c.id,
           c.name_ar,
           c.phone,
           c.address,
           c.notes,
           c.is_non_phone,
           c.is_featured,
           c.is_verified,
           c.priority_rank,
           cat.slug AS category_slug,
           cat.name_ar AS category_name_ar,
           g.code AS governorate_code,
           g.name_ar AS governorate_name_ar
         FROM contacts c
         JOIN categories cat ON c.category_id = cat.id
         LEFT JOIN governorates g ON c.governorate_id = g.id
         ${whereSql}
         ORDER BY c.is_featured DESC, c.priority_rank DESC, c.is_verified DESC, c.id DESC
         LIMIT $${index++} OFFSET $${index}`,
        values
      );
      return rows.map(mapContactRow);
    },

    async updateContact(id, payload) {
      await query(
        `UPDATE contacts
         SET name_ar = $1, phone = $2, address = $3, notes = $4,
             is_non_phone = $5, is_featured = $6, is_verified = $7,
             priority_rank = $8, category_id = $9, governorate_id = $10
         WHERE id = $11`,
        [
          payload.name_ar,
          payload.phone,
          payload.address,
          payload.notes,
          !!payload.is_non_phone,
          !!payload.is_featured,
          !!payload.is_verified,
          payload.priority_rank,
          payload.category_id,
          payload.governorate_id,
          id
        ]
      );
    },

    async deleteContact(id) {
      await query("DELETE FROM contacts WHERE id = $1", [id]);
    },

    async getAdminRequests(handled) {
      const { rows } = await query(
        `SELECT id, name_ar, phone, category_slug, message, handled, created_at
         FROM pending_requests
         WHERE handled = $1
         ORDER BY created_at DESC`,
        [handled]
      );
      return rows.map(mapRequestRow);
    },

    async updateRequest(id, payload) {
      await query(
        `UPDATE pending_requests
         SET name_ar = $1, phone = $2, category_slug = $3, message = $4, handled = $5
         WHERE id = $6`,
        [payload.name_ar, payload.phone, payload.category_slug, payload.message, !!payload.handled, id]
      );
    }
  };
}

export function createStore() {
  if (process.env.DATABASE_URL) {
    return createPostgresStore();
  }
  return createSqliteStore();
}
