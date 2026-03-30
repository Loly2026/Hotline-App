import fs from "node:fs";
import path from "node:path";
import { db, initSchema } from "./db.js";

// CSV columns:
// name_ar,category_slug,governorate_code,phone,address,notes,source_url,last_verified

const csvPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(process.cwd(), "data", "contacts.csv");

if (!fs.existsSync(csvPath)) {
  console.error(`CSV not found: ${csvPath}`);
  process.exit(1);
}

initSchema();

const raw = fs.readFileSync(csvPath, "utf8").trim();
const lines = raw.split(/\r?\n/);
const [header, ...rows] = lines;
const columns = header.split(",").map((x) => x.trim());

const required = ["name_ar", "category_slug", "phone"];
for (const key of required) {
  if (!columns.includes(key)) {
    console.error(`Missing required column: ${key}`);
    process.exit(1);
  }
}

const selectCategory = db.prepare("SELECT id FROM categories WHERE slug = ?");
const selectGovernorate = db.prepare("SELECT id FROM governorates WHERE code = ?");
const insertContact = db.prepare(`
  INSERT INTO contacts
  (name_ar, category_id, governorate_id, phone, address, notes, source_url, last_verified)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const tx = db.transaction(() => {
  for (const row of rows) {
    if (!row.trim()) continue;
    const parts = row.split(",");
    const record = {};

    columns.forEach((col, i) => {
      record[col] = (parts[i] ?? "").trim() || null;
    });

    const category = selectCategory.get(record.category_slug);
    if (!category) continue;

    let governorateId = null;
    if (record.governorate_code) {
      const g = selectGovernorate.get(record.governorate_code);
      governorateId = g?.id ?? null;
    }

    insertContact.run(
      record.name_ar,
      category.id,
      governorateId,
      record.phone,
      record.address,
      record.notes,
      record.source_url,
      record.last_verified
    );
  }
});

tx();

const count = db.prepare("SELECT COUNT(*) AS total FROM contacts").get();
console.log(`Import finished. Total contacts in DB: ${count.total}`);
