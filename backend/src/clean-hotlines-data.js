import fs from "node:fs";
import path from "node:path";
import { db, initSchema } from "./db.js";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalCategoryDisplay(name) {
  return String(name || "")
    .replace(/\s*\((?:إضافي|اضافي)[^)]+\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryKey(name) {
  return normalizeText(canonicalCategoryDisplay(name));
}

function normalizeEntityName(name) {
  return normalizeText(String(name || "").replace(/\([^)]*\)/g, " "));
}

function isNonPhoneValue(phone) {
  const text = String(phone || "").trim();
  if (!text) return true;
  const hasDigits = /\d/.test(text);
  if (!hasDigits) return true;
  if (/عبر\s*التطبيق|دعم\s*عبر\s*التطبيق|application|app/i.test(text)) return true;
  return false;
}

function mergeSimilarCategories() {
  const categories = db.prepare("SELECT id, slug, name_ar FROM categories ORDER BY id ASC").all();
  const groups = new Map();

  for (const cat of categories) {
    const key = categoryKey(cat.name_ar);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cat);
  }

  const updateCategoryForContacts = db.prepare("UPDATE contacts SET category_id = ? WHERE category_id = ?");
  const deleteCategory = db.prepare("DELETE FROM categories WHERE id = ?");
  const updateCategoryName = db.prepare("UPDATE categories SET name_ar = ? WHERE id = ?");

  let mergedCategories = 0;

  for (const [, list] of groups) {
    if (list.length <= 1) continue;

    list.sort((a, b) => {
      const aExtra = /\((?:إضافي|اضافي)/i.test(a.name_ar) ? 1 : 0;
      const bExtra = /\((?:إضافي|اضافي)/i.test(b.name_ar) ? 1 : 0;
      if (aExtra !== bExtra) return aExtra - bExtra;
      return a.name_ar.length - b.name_ar.length;
    });

    const primary = list[0];
    const canonical = canonicalCategoryDisplay(primary.name_ar) || primary.name_ar;
    updateCategoryName.run(canonical, primary.id);

    for (let i = 1; i < list.length; i += 1) {
      const duplicate = list[i];
      updateCategoryForContacts.run(primary.id, duplicate.id);
      deleteCategory.run(duplicate.id);
      mergedCategories += 1;
    }
  }

  return mergedCategories;
}

function markNonPhoneRecords() {
  const rows = db.prepare("SELECT id, phone, notes FROM contacts").all();
  const markStmt = db.prepare("UPDATE contacts SET is_non_phone = 1, notes = ? WHERE id = ?");
  const unmarkStmt = db.prepare("UPDATE contacts SET is_non_phone = 0 WHERE id = ?");

  let nonPhoneCount = 0;

  for (const row of rows) {
    if (isNonPhoneValue(row.phone)) {
      nonPhoneCount += 1;
      const note = row.notes ? `${row.notes} | غير هاتفي/عبر التطبيق` : "غير هاتفي/عبر التطبيق";
      markStmt.run(note, row.id);
    } else {
      unmarkStmt.run(row.id);
    }
  }

  return nonPhoneCount;
}

function detectNearDuplicates() {
  const rows = db
    .prepare(
      `
      SELECT c.id, c.name_ar, c.phone, c.category_id, cat.name_ar AS category_name
      FROM contacts c
      JOIN categories cat ON c.category_id = cat.id
      ORDER BY c.category_id ASC, c.name_ar ASC
    `
    )
    .all();

  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.category_id}|${normalizeEntityName(row.name_ar)}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  const exactGroups = [];
  for (const [key, list] of grouped) {
    if (list.length > 1) {
      const [categoryId] = key.split("|");
      exactGroups.push({
        category_id: Number(categoryId),
        category_name: list[0].category_name,
        normalized_name: key.split("|")[1],
        items: list
      });
    }
  }

  const nearPairs = [];
  const byCategory = new Map();
  for (const row of rows) {
    if (!byCategory.has(row.category_id)) byCategory.set(row.category_id, []);
    byCategory.get(row.category_id).push(row);
  }

  for (const [categoryId, list] of byCategory) {
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      const na = normalizeEntityName(a.name_ar).replace(/\s/g, "");
      if (!na) continue;
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j];
        const nb = normalizeEntityName(b.name_ar).replace(/\s/g, "");
        if (!nb || na === nb) continue;

        const containsRelation = na.includes(nb) || nb.includes(na);
        const lenDiff = Math.abs(na.length - nb.length);

        if (containsRelation && lenDiff <= 6) {
          nearPairs.push({
            category_id: categoryId,
            category_name: a.category_name,
            a: { id: a.id, name_ar: a.name_ar, phone: a.phone },
            b: { id: b.id, name_ar: b.name_ar, phone: b.phone }
          });
        }
      }
    }
  }

  return { exactGroups, nearPairs };
}

function writeDuplicateReport(report) {
  const reportsDir = path.join(process.cwd(), "data", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const jsonPath = path.join(reportsDir, "duplicates-report.json");
  const mdPath = path.join(reportsDir, "duplicates-report.md");

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const lines = [];
  lines.push("# Duplicate Detection Report");
  lines.push("");
  lines.push(`Exact duplicate groups: ${report.exactGroups.length}`);
  lines.push(`Near-duplicate pairs: ${report.nearPairs.length}`);
  lines.push("");

  lines.push("## Exact Groups");
  for (const group of report.exactGroups.slice(0, 200)) {
    lines.push(`- [${group.category_name}] ${group.normalized_name}`);
    for (const item of group.items) {
      lines.push(`  - (${item.id}) ${item.name_ar} | ${item.phone}`);
    }
  }

  lines.push("");
  lines.push("## Near Pairs");
  for (const pair of report.nearPairs.slice(0, 200)) {
    lines.push(`- [${pair.category_name}] (${pair.a.id}) ${pair.a.name_ar} <-> (${pair.b.id}) ${pair.b.name_ar}`);
  }

  fs.writeFileSync(mdPath, lines.join("\n"), "utf8");

  return { jsonPath, mdPath };
}

function main() {
  initSchema();

  const tx = db.transaction(() => {
    const mergedCategories = mergeSimilarCategories();
    const nonPhoneCount = markNonPhoneRecords();
    const report = detectNearDuplicates();
    const reportFiles = writeDuplicateReport(report);

    const totals = db
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM categories) AS categories,
          (SELECT COUNT(*) FROM contacts) AS contacts,
          (SELECT COUNT(*) FROM contacts WHERE is_non_phone = 1) AS non_phone
      `
      )
      .get();

    return {
      merged_categories: mergedCategories,
      non_phone_marked: nonPhoneCount,
      exact_duplicate_groups: report.exactGroups.length,
      near_duplicate_pairs: report.nearPairs.length,
      totals,
      reports: reportFiles
    };
  });

  const result = tx();
  console.log(JSON.stringify(result, null, 2));
}

main();
