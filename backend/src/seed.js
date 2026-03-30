import { db, initSchema } from "./db.js";
import { categories, governorates } from "./data/governorates.js";
import { contacts } from "./data/contacts.js";

initSchema();

db.exec(`
  DELETE FROM contacts;
  DELETE FROM categories;
  DELETE FROM governorates;
  DELETE FROM sqlite_sequence WHERE name IN ('contacts', 'categories', 'governorates');
`);

const insertGovernorate = db.prepare(
  "INSERT INTO governorates (code, name_ar) VALUES (@code, @name_ar)"
);
const insertCategory = db.prepare(
  "INSERT INTO categories (slug, name_ar) VALUES (@slug, @name_ar)"
);
const insertContact = db.prepare(`
  INSERT INTO contacts
  (name_ar, category_id, governorate_id, phone, address, notes, source_url, last_verified)
  VALUES
  (@name_ar, @category_id, @governorate_id, @phone, @address, @notes, @source_url, @last_verified)
`);

const tx = db.transaction(() => {
  for (const item of governorates) insertGovernorate.run(item);
  for (const item of categories) insertCategory.run(item);

  const governorateMap = new Map(
    db.prepare("SELECT id, code FROM governorates").all().map((row) => [row.code, row.id])
  );
  const categoryMap = new Map(
    db.prepare("SELECT id, slug FROM categories").all().map((row) => [row.slug, row.id])
  );

  for (const item of contacts) {
    const category_id = categoryMap.get(item.category_slug);
    const governorate_id = item.governorate_code
      ? governorateMap.get(item.governorate_code) ?? null
      : null;

    insertContact.run({
      name_ar: item.name_ar,
      category_id,
      governorate_id,
      phone: item.phone,
      address: item.address ?? null,
      notes: item.notes ?? null,
      source_url: item.source_url ?? null,
      last_verified: item.last_verified ?? null
    });
  }
});

tx();

const count = db.prepare("SELECT COUNT(*) AS total FROM contacts").get();
console.log(`Seed complete. Contacts: ${count.total}`);
