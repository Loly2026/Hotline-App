import "dotenv/config";
import { Pool } from "pg";
import { fileURLToPath } from "node:url";
import { db, initSchema as initSqliteSchema } from "./db.js";

const INDEX_URL = "https://www.visahq.com.eg/en/embassies/";
const CATEGORY = { slug: "embassies", name_ar: "سفارات" };
const TODAY = new Date().toISOString().slice(0, 10);
const ENGLISH_GOVERNORATE_MAP = {
  cairo: "CAI",
  alexandria: "ALX",
  giza: "GIZ",
  suez: "SUZ",
  ismailia: "ISM",
  portsaid: "PTS",
  "port-said": "PTS",
  "sharm-el-sheikh": "SHS",
  luxor: "LXR"
};

function decodeHtml(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function stripTags(text) {
  return decodeHtml(String(text || "").replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePhone(text) {
  return stripTags(text).replace(/\s+/g, " ").trim();
}

function buildNotes({ email, website, mapUrl }) {
  const parts = [];
  if (email) parts.push(email);
  if (website) parts.push(`Website: ${website}`);
  if (mapUrl) parts.push(`Map: ${mapUrl}`);
  return parts.join(" | ");
}

function extractGovernorateCode(address) {
  const firstLine = String(address || "")
    .split("\n")[0]
    .replace(/^in\s+/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, "-");
  return ENGLISH_GOVERNORATE_MAP[firstLine] || null;
}

function extractEmbassyUrls(indexHtml) {
  return [...new Set(indexHtml.match(/\/en\/[^" ]+\/embassy\/egypt\//g) || [])].map(
    (path) => new URL(path, INDEX_URL).toString()
  );
}

function extractFirstEmbassyRecord(html, url) {
  const blockMatch = html.match(
    /<h2 class="embassy__name">([^<]+)<\/h2><div class="embassy__list__wrap">([\s\S]*?)<a href="" class="notify_us"/i
  );
  if (!blockMatch) return null;

  const [, rawName, block] = blockMatch;
  const addressMatch = block.match(/<span class="adr">([\s\S]*?)<\/span>/i);
  const phoneMatch = block.match(/<strong class="tel">([\s\S]*?)<\/strong>/i);
  const emailMatch = block.match(/<strong class="email">([\s\S]*?)<\/strong>/i);
  const websiteMatch = block.match(/<strong class="url">([\s\S]*?)<\/strong>/i);
  const mapMatch = block.match(/class="embassy__map-link"[^>]*href="([^"]+)"/i);

  const name = stripTags(rawName);
  const address = addressMatch ? stripTags(addressMatch[1]) : "";
  const phone = phoneMatch ? normalizePhone(phoneMatch[1]) : "";
  const email = emailMatch ? stripTags(emailMatch[1]) : "";
  const website = websiteMatch ? stripTags(websiteMatch[1]) : "";
  const mapUrl = mapMatch ? decodeHtml(mapMatch[1]) : "";

  if (!name || !phone) return null;

  return {
    name_ar: name,
    phone,
    address,
    notes: buildNotes({ email, website, mapUrl }),
    source_url: url,
    last_verified: TODAY,
    governorate_code: extractGovernorateCode(address)
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 HotlineAppImporter/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed ${response.status} for ${url}`);
  }
  return response.text();
}

function createSqliteImporter() {
  initSqliteSchema();

  const ensureCategoryStmt = db.prepare(
    "INSERT OR IGNORE INTO categories (slug, name_ar) VALUES (?, ?)"
  );
  const categoryBySlugStmt = db.prepare("SELECT id FROM categories WHERE slug = ?");
  const governorateByCodeStmt = db.prepare("SELECT id FROM governorates WHERE code = ?");
  const existingBySourceStmt = db.prepare("SELECT id FROM contacts WHERE source_url = ?");
  const existingByNameStmt = db.prepare(
    "SELECT c.id FROM contacts c JOIN categories cat ON cat.id = c.category_id WHERE c.name_ar = ? AND cat.slug = ?"
  );
  const insertStmt = db.prepare(
    `INSERT INTO contacts
      (name_ar, category_id, governorate_id, phone, address, notes, source_url, last_verified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const updateStmt = db.prepare(
    `UPDATE contacts
     SET name_ar = ?, phone = ?, address = ?, notes = ?, source_url = ?, last_verified = ?, governorate_id = ?, category_id = ?
     WHERE id = ?`
  );

  return {
    async ensureCategory() {
      ensureCategoryStmt.run(CATEGORY.slug, CATEGORY.name_ar);
      return categoryBySlugStmt.get(CATEGORY.slug)?.id || null;
    },
    async upsertContact(categoryId, record) {
      const governorateId = record.governorate_code
        ? governorateByCodeStmt.get(record.governorate_code)?.id || null
        : null;
      const existing =
        existingBySourceStmt.get(record.source_url) ||
        existingByNameStmt.get(record.name_ar, CATEGORY.slug);

      if (existing?.id) {
        updateStmt.run(
          record.name_ar,
          record.phone,
          record.address,
          record.notes,
          record.source_url,
          record.last_verified,
          governorateId,
          categoryId,
          existing.id
        );
        return "updated";
      }

      insertStmt.run(
        record.name_ar,
        categoryId,
        governorateId,
        record.phone,
        record.address,
        record.notes,
        record.source_url,
        record.last_verified
      );
      return "inserted";
    }
  };
}

function createPostgresImporter() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  async function query(text, params = []) {
    return pool.query(text, params);
  }

  return {
    async ensureCategory() {
      await query(
        "INSERT INTO categories (slug, name_ar) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING",
        [CATEGORY.slug, CATEGORY.name_ar]
      );
      const { rows } = await query("SELECT id FROM categories WHERE slug = $1", [CATEGORY.slug]);
      return rows[0]?.id || null;
    },
    async upsertContact(categoryId, record) {
      const governorateRows = record.governorate_code
        ? (await query("SELECT id FROM governorates WHERE code = $1", [record.governorate_code])).rows
        : [];
      const governorateId = governorateRows[0]?.id || null;

      const existing =
        (
          await query("SELECT id FROM contacts WHERE source_url = $1", [record.source_url])
        ).rows[0] ||
        (
          await query(
            `SELECT c.id
             FROM contacts c
             JOIN categories cat ON cat.id = c.category_id
             WHERE c.name_ar = $1 AND cat.slug = $2
             LIMIT 1`,
            [record.name_ar, CATEGORY.slug]
          )
        ).rows[0];

      if (existing?.id) {
        await query(
          `UPDATE contacts
           SET name_ar = $1, phone = $2, address = $3, notes = $4,
               source_url = $5, last_verified = $6, governorate_id = $7, category_id = $8
           WHERE id = $9`,
          [
            record.name_ar,
            record.phone,
            record.address,
            record.notes,
            record.source_url,
            record.last_verified,
            governorateId,
            categoryId,
            existing.id
          ]
        );
        return "updated";
      }

      await query(
        `INSERT INTO contacts
          (name_ar, category_id, governorate_id, phone, address, notes, source_url, last_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          record.name_ar,
          categoryId,
          governorateId,
          record.phone,
          record.address,
          record.notes,
          record.source_url,
          record.last_verified
        ]
      );
      return "inserted";
    },
    async close() {
      await pool.end();
    }
  };
}

export async function importEmbassies() {
  const importer = process.env.DATABASE_URL ? createPostgresImporter() : createSqliteImporter();
  const categoryId = await importer.ensureCategory();
  if (!categoryId) {
    throw new Error("Could not create or find the embassies category.");
  }

  const indexHtml = await fetchText(INDEX_URL);
  const embassyUrls = extractEmbassyUrls(indexHtml);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const url of embassyUrls) {
    try {
      const html = await fetchText(url);
      const record = extractFirstEmbassyRecord(html, url);
      if (!record) {
        skipped += 1;
        continue;
      }
      const result = await importer.upsertContact(categoryId, record);
      if (result === "inserted") inserted += 1;
      if (result === "updated") updated += 1;
    } catch (error) {
      skipped += 1;
      console.warn(`Skipped ${url}: ${error.message}`);
    }
  }

  if (typeof importer.close === "function") {
    await importer.close();
  }

  return {
    inserted,
    updated,
    skipped,
    totalPages: embassyUrls.length
  };
}

async function main() {
  const result = await importEmbassies();
  console.log(
    `Embassy import complete. Inserted: ${result.inserted}, Updated: ${result.updated}, Skipped: ${result.skipped}, Total pages: ${result.totalPages}`
  );
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
