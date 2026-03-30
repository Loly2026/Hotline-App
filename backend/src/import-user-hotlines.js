import fs from "node:fs";
import path from "node:path";
import { db, initSchema } from "./db.js";

const inputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(process.cwd(), "data", "user-hotlines.txt");

function slugifyCategory(name, index) {
  const normalized = String(name || "")
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return `usercat_${index}_${normalized || "category"}`;
}

function splitCsvTriple(line) {
  const first = line.indexOf(",");
  if (first === -1) return null;
  const second = line.indexOf(",", first + 1);
  if (second === -1) return null;

  const category = line.slice(0, first).trim();
  const name = line.slice(first + 1, second).trim();
  const phone = line.slice(second + 1).trim();

  if (!category || !name || !phone) return null;
  return { category, name, phone };
}

function expandPhones(phoneField) {
  const value = String(phoneField || "").trim();
  if (!value) return [];

  const candidates = value
    .split(/\s*\/\s*|\s*\|\s*/g)
    .map((x) => x.trim())
    .filter(Boolean);

  return candidates.length ? candidates : [value];
}

function isHeaderLike(line) {
  const t = line.trim();
  return (
    !t ||
    t === "Hotlines" ||
    t === "الفئة,اسم الجهة,رقم الهاتف" ||
    t.startsWith("الفئة,اسم الجهة,رقم الهاتف")
  );
}

function main() {
  initSchema();

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const lines = raw.split(/\r?\n/);

  const parsed = [];
  const badLines = [];

  lines.forEach((line, i) => {
    if (isHeaderLike(line)) return;
    const row = splitCsvTriple(line);
    if (!row) {
      badLines.push({ line: i + 1, text: line });
      return;
    }
    parsed.push(row);
  });

  const uniqueCategories = [...new Set(parsed.map((r) => r.category))];

  db.exec(`
    DELETE FROM contact_requests;
    DELETE FROM contacts;
    DELETE FROM categories;
    DELETE FROM sqlite_sequence WHERE name IN ('contacts','categories','contact_requests');
  `);

  const insertCategory = db.prepare("INSERT INTO categories (slug, name_ar) VALUES (?, ?)");
  const selectCategoryId = db.prepare("SELECT id FROM categories WHERE slug = ?");
  const insertContact = db.prepare(`
    INSERT INTO contacts
    (name_ar, category_id, governorate_id, phone, address, notes, source_url, last_verified)
    VALUES (?, ?, NULL, ?, NULL, ?, ?, date('now'))
  `);

  const categoryMap = new Map();
  uniqueCategories.forEach((name, idx) => {
    const slug = slugifyCategory(name, idx + 1);
    insertCategory.run(slug, name);
    const id = selectCategoryId.get(slug)?.id;
    if (id) categoryMap.set(name, id);
  });

  const seen = new Set();
  let inserted = 0;

  for (const row of parsed) {
    const categoryId = categoryMap.get(row.category);
    if (!categoryId) continue;

    const phones = expandPhones(row.phone);
    for (const phone of phones) {
      const key = `${row.category}|${row.name}|${phone}`;
      if (seen.has(key)) continue;
      seen.add(key);

      insertContact.run(
        row.name,
        categoryId,
        phone,
        "Imported from user provided list",
        "user-uploaded"
      );
      inserted += 1;
    }
  }

  const totalCategories = db.prepare("SELECT COUNT(*) AS n FROM categories").get().n;
  const totalContacts = db.prepare("SELECT COUNT(*) AS n FROM contacts").get().n;

  console.log(
    JSON.stringify(
      {
        input: inputPath,
        parsed_rows: parsed.length,
        bad_lines: badLines.length,
        inserted_contacts: inserted,
        total_categories: totalCategories,
        total_contacts: totalContacts
      },
      null,
      2
    )
  );

  if (badLines.length) {
    console.log("Sample bad lines:");
    badLines.slice(0, 10).forEach((b) => {
      console.log(`- line ${b.line}: ${b.text}`);
    });
  }
}

main();
