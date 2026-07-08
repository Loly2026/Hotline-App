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

    async ensureCategories(definitions = []) {
      const stmt = sqliteDb.prepare("INSERT OR IGNORE INTO categories (slug, name_ar) VALUES (?, ?)");
      for (const item of definitions) {
        if (!item?.slug || !item?.name_ar) continue;
        stmt.run(String(item.slug).trim(), String(item.name_ar).trim());
      }
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
             c.phone_labels,
             c.logo_url,
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

    async getContactById(id) {
      return mapContactRow(
        sqliteDb
          .prepare(
            `SELECT
               c.id,
               c.name_ar,
               c.phone,
               c.phone_labels,
               c.logo_url,
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
             WHERE c.id = ?`
          )
          .get(id)
      );
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
          IFNULL(c.phone_labels, '') LIKE @q OR
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
             c.phone_labels,
             c.logo_url,
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
          `INSERT INTO contacts (name_ar, phone, phone_labels, logo_url, address, notes, is_non_phone, is_featured, is_verified, priority_rank, category_id, governorate_id)
           VALUES (@name_ar, @phone, @phone_labels, @logo_url, @address, @notes, @is_non_phone, @is_featured, @is_verified, @priority_rank, @category_id, @governorate_id)`
        )
        .run(payload);
      return { id: result.lastInsertRowid };
    },

    async getAdminContacts({ q = "", category = "", limit = 10000, offset = 0 }) {
      const where = [];
      const params = {
        q: `%${String(q).trim()}%`,
        category: String(category).trim(),
        limit,
        offset
      };
      if (params.category) where.push("cat.slug = @category");
      if (String(q).trim()) {
        where.push("(c.name_ar LIKE @q OR c.phone LIKE @q OR IFNULL(c.phone_labels,'') LIKE @q OR IFNULL(c.notes,'') LIKE @q OR cat.name_ar LIKE @q)");
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      return sqliteDb
        .prepare(
          `SELECT
             c.id,
             c.name_ar,
             c.phone,
             c.phone_labels,
             c.logo_url,
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
           SET name_ar=@name_ar, phone=@phone, phone_labels=@phone_labels, logo_url=@logo_url, address=@address, notes=@notes,
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
    },

    async upsertPushToken(payload) {
      sqliteDb
        .prepare(
          `INSERT INTO push_tokens (token, platform, device_id, ui_language, screen_size, enabled, updated_at)
           VALUES (@token, @platform, @device_id, @ui_language, @screen_size, 1, datetime('now'))
           ON CONFLICT(token) DO UPDATE SET
             platform = excluded.platform,
             device_id = excluded.device_id,
             ui_language = excluded.ui_language,
             screen_size = excluded.screen_size,
             enabled = 1,
             updated_at = datetime('now')`
        )
        .run(payload);
    },

    async getPushTokenStats() {
      return sqliteDb
        .prepare(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS active,
             SUM(CASE WHEN platform = 'android' AND enabled = 1 THEN 1 ELSE 0 END) AS android,
             SUM(CASE WHEN platform = 'ios' AND enabled = 1 THEN 1 ELSE 0 END) AS ios
           FROM push_tokens`
        )
        .get();
    },

    async getRecentPushTokens(limit = 20) {
      return sqliteDb
        .prepare(
          `SELECT token, platform, device_id, ui_language, screen_size, enabled, updated_at
           FROM push_tokens
           ORDER BY updated_at DESC
           LIMIT ?`
        )
        .all(limit);
    },

    async listActivePushTokens(filters = {}) {
      const where = ["enabled = 1"];
      const params = {};
      if (filters.platform && filters.platform !== "all") {
        where.push("platform = @platform");
        params.platform = filters.platform;
      }
      if (filters.ui_language && filters.ui_language !== "all") {
        where.push("ui_language = @ui_language");
        params.ui_language = filters.ui_language;
      }
      return sqliteDb
        .prepare(`SELECT token FROM push_tokens WHERE ${where.join(" AND ")} ORDER BY updated_at DESC`)
        .all(params)
        .map((row) => row.token);
    },

    async createNotificationCampaign(payload) {
      const result = sqliteDb
        .prepare(
          `INSERT INTO notification_campaigns (
             title, body, message_type, audience_platform, audience_language,
             target_screen, target_group, target_category_slug, target_store_url, service_contact_id,
             service_name, service_phone, service_logo_url, scheduled_at,
             status, sent_count, failed_count, disabled_count, updated_at
           )
           VALUES (
             @title, @body, @message_type, @audience_platform, @audience_language,
             @target_screen, @target_group, @target_category_slug, @target_store_url, @service_contact_id,
             @service_name, @service_phone, @service_logo_url, @scheduled_at,
             @status, @sent_count, @failed_count, @disabled_count, datetime('now')
           )`
        )
        .run(payload);
      return result.lastInsertRowid;
    },

    async updateNotificationCampaign(id, payload) {
      sqliteDb
        .prepare(
          `UPDATE notification_campaigns
           SET status = @status,
               sent_count = @sent_count,
               failed_count = @failed_count,
               disabled_count = @disabled_count,
               updated_at = datetime('now')
           WHERE id = @id`
        )
        .run({ id, ...payload });
    },

    async getPendingNotificationCampaigns() {
      return sqliteDb
        .prepare(
          `SELECT *
           FROM notification_campaigns
           WHERE status = 'scheduled' AND scheduled_at IS NOT NULL
           ORDER BY scheduled_at ASC`
        )
        .all();
    },

    async getRecentNotificationCampaigns(limit = 20) {
      return sqliteDb
        .prepare(
          `SELECT *
           FROM notification_campaigns
           ORDER BY created_at DESC
           LIMIT ?`
        )
        .all(limit);
    },

    async listAppUpdates(filters = {}) {
      const limit = Math.min(Math.max(Number.parseInt(String(filters.limit || "30"), 10) || 30, 1), 100);
      const where = ["status = 'internal'", "message_type = 'update_center'"];
      const params = { limit };
      if (filters.platform && filters.platform !== "all") {
        where.push("(audience_platform IS NULL OR audience_platform = '' OR audience_platform = 'all' OR audience_platform = @platform)");
        params.platform = filters.platform;
      }
      if (filters.language && filters.language !== "all") {
        where.push("(audience_language IS NULL OR audience_language = '' OR audience_language = 'all' OR audience_language = @language)");
        params.language = filters.language;
      }
      return sqliteDb
        .prepare(
          `SELECT *
           FROM notification_campaigns
           WHERE ${where.join(" AND ")}
           ORDER BY updated_at DESC, created_at DESC
           LIMIT @limit`
        )
        .all(params);
    },

    async createAppUpdate(payload) {
      return this.createNotificationCampaign({
        title: payload.title,
        body: payload.body,
        message_type: "update_center",
        audience_platform: payload.audience_platform || "all",
        audience_language: payload.audience_language || "all",
        target_screen: payload.target_screen || "updates",
        target_group: payload.target_group || "",
        target_category_slug: payload.target_category_slug || "",
        target_store_url: payload.target_store_url || "",
        service_contact_id: null,
        service_name: "",
        service_phone: "",
        service_logo_url: "",
        scheduled_at: null,
        status: "internal",
        sent_count: 0,
        failed_count: 0,
        disabled_count: 0
      });
    },

    async updateAppUpdate(id, payload) {
      sqliteDb
        .prepare(
          `UPDATE notification_campaigns
           SET title = @title,
               body = @body,
               audience_platform = @audience_platform,
               audience_language = @audience_language,
               target_screen = @target_screen,
               target_group = @target_group,
               target_category_slug = @target_category_slug,
               target_store_url = @target_store_url,
               updated_at = datetime('now')
           WHERE id = @id AND status = 'internal' AND message_type = 'update_center'`
        )
        .run({
          id,
          title: payload.title,
          body: payload.body,
          audience_platform: payload.audience_platform || "all",
          audience_language: payload.audience_language || "all",
          target_screen: payload.target_screen || "updates",
          target_group: payload.target_group || "",
          target_category_slug: payload.target_category_slug || "",
          target_store_url: payload.target_store_url || ""
        });
    },

    async deleteAppUpdate(id) {
      sqliteDb
        .prepare("DELETE FROM notification_campaigns WHERE id = ? AND status = 'internal' AND message_type = 'update_center'")
        .run(id);
    },

    async deleteNotificationCampaign(id) {
      sqliteDb.prepare("DELETE FROM notification_campaigns WHERE id = ?").run(id);
    },

    async disablePushTokens(tokens = []) {
      const uniqueTokens = [...new Set(tokens.filter(Boolean))];
      if (!uniqueTokens.length) return;
      const stmt = sqliteDb.prepare("UPDATE push_tokens SET enabled = 0, updated_at = datetime('now') WHERE token = ?");
      uniqueTokens.forEach((token) => stmt.run(token));
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
          phone_labels TEXT,
          logo_url TEXT,
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

        CREATE TABLE IF NOT EXISTS push_tokens (
          id SERIAL PRIMARY KEY,
          token TEXT UNIQUE NOT NULL,
          platform TEXT,
          device_id TEXT,
          ui_language TEXT,
          screen_size TEXT,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS notification_campaigns (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          message_type TEXT,
          audience_platform TEXT,
          audience_language TEXT,
          target_screen TEXT,
          target_group TEXT,
          target_category_slug TEXT,
          target_store_url TEXT,
          service_contact_id INTEGER,
          service_name TEXT,
          service_phone TEXT,
          service_logo_url TEXT,
          scheduled_at TIMESTAMPTZ,
          status TEXT NOT NULL DEFAULT 'sent',
          sent_count INTEGER NOT NULL DEFAULT 0,
          failed_count INTEGER NOT NULL DEFAULT 0,
          disabled_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
        CREATE INDEX IF NOT EXISTS idx_push_tokens_enabled ON push_tokens (enabled);
        CREATE INDEX IF NOT EXISTS idx_push_tokens_device ON push_tokens (device_id);
        CREATE INDEX IF NOT EXISTS idx_notification_campaigns_status ON notification_campaigns (status);
        CREATE INDEX IF NOT EXISTS idx_notification_campaigns_scheduled_at ON notification_campaigns (scheduled_at);
      `);
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS logo_url TEXT`);
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_labels TEXT`);
      await query(`ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS target_store_url TEXT`);
      await query(`ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS service_contact_id INTEGER`);
      await query(`ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS service_name TEXT`);
      await query(`ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS service_phone TEXT`);
      await query(`ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS service_logo_url TEXT`);
    },

    async getGovernorates() {
      const { rows } = await query("SELECT id, code, name_ar FROM governorates ORDER BY name_ar ASC");
      return rows;
    },

    async getCategories() {
      const { rows } = await query("SELECT id, slug, name_ar FROM categories ORDER BY name_ar ASC");
      return rows;
    },

    async ensureCategories(definitions = []) {
      for (const item of definitions) {
        if (!item?.slug || !item?.name_ar) continue;
        await query(
          "INSERT INTO categories (slug, name_ar) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING",
          [String(item.slug).trim(), String(item.name_ar).trim()]
        );
      }
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
           c.phone_labels,
           c.logo_url,
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
          COALESCE(c.phone_labels, '') ILIKE $${index} OR
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
           c.phone_labels,
           c.logo_url,
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
           (name_ar, phone, phone_labels, logo_url, address, notes, is_non_phone, is_featured, is_verified, priority_rank, category_id, governorate_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          payload.name_ar,
          payload.phone,
          payload.phone_labels,
          payload.logo_url,
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

    async getAdminContacts({ q = "", category = "", limit = 10000, offset = 0 }) {
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
          COALESCE(c.phone_labels, '') ILIKE $${index} OR
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
           c.phone_labels,
           c.logo_url,
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
         SET name_ar = $1, phone = $2, logo_url = $3, address = $4, notes = $5,
             phone_labels = $6, is_non_phone = $7, is_featured = $8, is_verified = $9,
             priority_rank = $10, category_id = $11, governorate_id = $12
         WHERE id = $13`,
        [
          payload.name_ar,
          payload.phone,
          payload.logo_url,
          payload.address,
          payload.notes,
          payload.phone_labels,
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
    },

    async upsertPushToken(payload) {
      await query(
        `INSERT INTO push_tokens (token, platform, device_id, ui_language, screen_size, enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
         ON CONFLICT (token) DO UPDATE SET
           platform = EXCLUDED.platform,
           device_id = EXCLUDED.device_id,
           ui_language = EXCLUDED.ui_language,
           screen_size = EXCLUDED.screen_size,
           enabled = TRUE,
           updated_at = NOW()`,
        [payload.token, payload.platform, payload.device_id, payload.ui_language, payload.screen_size]
      );
    },

    async getPushTokenStats() {
      const { rows } = await query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE enabled = TRUE)::int AS active,
           COUNT(*) FILTER (WHERE platform = 'android' AND enabled = TRUE)::int AS android,
           COUNT(*) FILTER (WHERE platform = 'ios' AND enabled = TRUE)::int AS ios
         FROM push_tokens`
      );
      return rows[0];
    },

    async getRecentPushTokens(limit = 20) {
      const { rows } = await query(
        `SELECT token, platform, device_id, ui_language, screen_size, enabled, updated_at
         FROM push_tokens
         ORDER BY updated_at DESC
         LIMIT $1`,
        [limit]
      );
      return rows;
    },

    async listActivePushTokens(filters = {}) {
      const where = ["enabled = TRUE"];
      const values = [];
      let index = 1;
      if (filters.platform && filters.platform !== "all") {
        where.push(`platform = $${index++}`);
        values.push(filters.platform);
      }
      if (filters.ui_language && filters.ui_language !== "all") {
        where.push(`ui_language = $${index++}`);
        values.push(filters.ui_language);
      }
      const { rows } = await query(
        `SELECT token FROM push_tokens WHERE ${where.join(" AND ")} ORDER BY updated_at DESC`,
        values
      );
      return rows.map((row) => row.token);
    },

    async createNotificationCampaign(payload) {
      const { rows } = await query(
        `INSERT INTO notification_campaigns (
           title, body, message_type, audience_platform, audience_language,
           target_screen, target_group, target_category_slug, target_store_url, service_contact_id,
           service_name, service_phone, service_logo_url, scheduled_at,
           status, sent_count, failed_count, disabled_count, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
         RETURNING id`,
        [
          payload.title,
          payload.body,
          payload.message_type,
          payload.audience_platform,
          payload.audience_language,
          payload.target_screen,
          payload.target_group,
          payload.target_category_slug,
          payload.target_store_url,
          payload.service_contact_id,
          payload.service_name,
          payload.service_phone,
          payload.service_logo_url,
          payload.scheduled_at,
          payload.status,
          payload.sent_count,
          payload.failed_count,
          payload.disabled_count
        ]
      );
      return rows[0]?.id;
    },

    async updateNotificationCampaign(id, payload) {
      await query(
        `UPDATE notification_campaigns
         SET status = $1,
             sent_count = $2,
             failed_count = $3,
             disabled_count = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [payload.status, payload.sent_count, payload.failed_count, payload.disabled_count, id]
      );
    },

    async getPendingNotificationCampaigns() {
      const { rows } = await query(
        `SELECT *
         FROM notification_campaigns
         WHERE status = 'scheduled' AND scheduled_at IS NOT NULL
         ORDER BY scheduled_at ASC`
      );
      return rows;
    },

    async getRecentNotificationCampaigns(limit = 20) {
      const { rows } = await query(
        `SELECT *
         FROM notification_campaigns
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return rows;
    },

    async listAppUpdates(filters = {}) {
      const values = [];
      let index = 1;
      const limit = Math.min(Math.max(Number.parseInt(String(filters.limit || "30"), 10) || 30, 1), 100);
      const where = ["status = 'internal'", "message_type = 'update_center'"];
      if (filters.platform && filters.platform !== "all") {
        where.push(`(audience_platform IS NULL OR audience_platform = '' OR audience_platform = 'all' OR audience_platform = $${index++})`);
        values.push(filters.platform);
      }
      if (filters.language && filters.language !== "all") {
        where.push(`(audience_language IS NULL OR audience_language = '' OR audience_language = 'all' OR audience_language = $${index++})`);
        values.push(filters.language);
      }
      values.push(limit);
      const { rows } = await query(
        `SELECT *
         FROM notification_campaigns
         WHERE ${where.join(" AND ")}
         ORDER BY updated_at DESC, created_at DESC
         LIMIT $${index}`,
        values
      );
      return rows;
    },

    async createAppUpdate(payload) {
      return this.createNotificationCampaign({
        title: payload.title,
        body: payload.body,
        message_type: "update_center",
        audience_platform: payload.audience_platform || "all",
        audience_language: payload.audience_language || "all",
        target_screen: payload.target_screen || "updates",
        target_group: payload.target_group || "",
        target_category_slug: payload.target_category_slug || "",
        target_store_url: payload.target_store_url || "",
        service_contact_id: null,
        service_name: "",
        service_phone: "",
        service_logo_url: "",
        scheduled_at: null,
        status: "internal",
        sent_count: 0,
        failed_count: 0,
        disabled_count: 0
      });
    },

    async updateAppUpdate(id, payload) {
      await query(
        `UPDATE notification_campaigns
         SET title = $1,
             body = $2,
             audience_platform = $3,
             audience_language = $4,
             target_screen = $5,
             target_group = $6,
             target_category_slug = $7,
             target_store_url = $8,
             updated_at = NOW()
         WHERE id = $9 AND status = 'internal' AND message_type = 'update_center'`,
        [
          payload.title,
          payload.body,
          payload.audience_platform || "all",
          payload.audience_language || "all",
          payload.target_screen || "updates",
          payload.target_group || "",
          payload.target_category_slug || "",
          payload.target_store_url || "",
          id
        ]
      );
    },

    async deleteAppUpdate(id) {
      await query(
        "DELETE FROM notification_campaigns WHERE id = $1 AND status = 'internal' AND message_type = 'update_center'",
        [id]
      );
    },

    async deleteNotificationCampaign(id) {
      await query("DELETE FROM notification_campaigns WHERE id = $1", [id]);
    },

    async disablePushTokens(tokens = []) {
      const uniqueTokens = [...new Set(tokens.filter(Boolean))];
      if (!uniqueTokens.length) return;
      await query("UPDATE push_tokens SET enabled = FALSE, updated_at = NOW() WHERE token = ANY($1::text[])", [uniqueTokens]);
    },

    async getContactById(id) {
      const { rows } = await query(
        `SELECT
           c.id,
           c.name_ar,
           c.phone,
           c.phone_labels,
           c.logo_url,
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
           CASE WHEN c.governorate_id IS NULL THEN TRUE ELSE FALSE END AS is_national
         FROM contacts c
         JOIN categories cat ON c.category_id = cat.id
         LEFT JOIN governorates g ON c.governorate_id = g.id
         WHERE c.id = $1`,
        [id]
      );
      return mapContactRow(rows[0]);
    }
  };
}

export function createStore() {
  if (process.env.DATABASE_URL) {
    return createPostgresStore();
  }
  return createSqliteStore();
}
