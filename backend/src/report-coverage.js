import { db, initSchema } from "./db.js";

initSchema();

const rows = db.prepare(`
  SELECT
    cat.name_ar AS category_name,
    g.name_ar AS governorate_name,
    COUNT(c.id) AS contacts_count
  FROM categories cat
  CROSS JOIN governorates g
  LEFT JOIN contacts c
    ON c.category_id = cat.id
   AND c.governorate_id = g.id
  GROUP BY cat.id, g.id
  ORDER BY cat.name_ar ASC, g.name_ar ASC
`).all();

const missing = rows.filter((r) => r.contacts_count === 0);

console.log(`Total category-governorate pairs: ${rows.length}`);
console.log(`Missing pairs: ${missing.length}`);

for (const item of missing.slice(0, 80)) {
  console.log(`- ${item.category_name} | ${item.governorate_name}`);
}

if (missing.length > 80) {
  console.log(`... and ${missing.length - 80} more missing pairs`);
}
