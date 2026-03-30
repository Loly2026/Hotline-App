import { db, initSchema } from "./db.js";

const BASE_URL = "https://www.hotlinesegypt.com";
const START_URL = `${BASE_URL}/ar/`;
const MAX_PAGES = 900;

const CATEGORY_KEYWORDS = [
  { slug: "restaurant", words: ["مطاعم", "مأكولات", "مشروبات", "كوفي", "قهوة", "كافيه"] },
  { slug: "pharmacy", words: ["صيدليات", "صيدليه", "دواء"] },
  { slug: "car_maintenance", words: ["سيارات", "مراكز خدمة", "صيانة سيارات", "قطع غيار"] },
  { slug: "mobile_maintenance", words: ["موبايل", "هاتف", "سمارت فون", "صيانة موبايل"] },
  { slug: "mobile", words: ["اتصالات", "شبكات", "محمول", "فودافون", "اورنج", "اتصالات", "وي"] },
  { slug: "internet", words: ["انترنت", "dsl", "adsl"] },
  { slug: "hospital", words: ["مستشفيات", "مستشفى", "عيادات", "مراكز طبية"] },
  { slug: "bank", words: ["بنوك", "بنك"] },
  { slug: "police", words: ["شرطة", "امن", "نجدة"] },
  { slug: "utilities", words: ["كهرباء", "مياه", "غاز", "خدمات"] }
];

function normalizeText(value) {
  return String(value || "")
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function detectCategorySlug(categoryText) {
  const t = normalizeText(categoryText);
  for (const row of CATEGORY_KEYWORDS) {
    for (const w of row.words) {
      if (t.includes(normalizeText(w))) return row.slug;
    }
  }
  return "utilities";
}

function toAbs(href, base = BASE_URL) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isSameHost(url) {
  try {
    return new URL(url).host === new URL(BASE_URL).host;
  } catch {
    return false;
  }
}

function isContentLink(url) {
  const u = url.toLowerCase();
  if (!isSameHost(u)) return false;
  if (u.includes(".jpg") || u.includes(".png") || u.includes(".jpeg") || u.includes(".svg")) return false;
  return u.includes("/ar/");
}

function extractPhones(bodyText) {
  const clean = String(bodyText || "");
  const set = new Set();

  const short = clean.match(/(^|[^\d])(1\d{2,5})(?=[^\d]|$)/g) || [];
  for (const m of short) {
    const n = (m.match(/1\d{2,5}/) || [])[0];
    if (n) set.add(n);
  }

  const long = clean.match(/\+?\d[\d\s\-()]{6,18}\d/g) || [];
  for (const raw of long) {
    const compact = raw.replace(/[^\d+]/g, "");
    const digits = compact.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) set.add(compact);
  }

  return [...set];
}

function findAllLinks(html, baseUrl) {
  const links = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = regex.exec(html))) {
    const abs = toAbs(m[1], baseUrl);
    if (abs) links.push(abs);
  }
  return links;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; HotlineEgyptImporter/1.0)"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function getCategoryId(slug) {
  const row = db.prepare("SELECT id FROM categories WHERE slug = ?").get(slug);
  return row?.id ?? null;
}

function contactExists(name_ar, phone, category_id) {
  const row = db
    .prepare(
      `
      SELECT id
      FROM contacts
      WHERE name_ar = ?
        AND phone = ?
        AND category_id = ?
        AND governorate_id IS NULL
      LIMIT 1
    `
    )
    .get(name_ar, phone, category_id);
  return Boolean(row);
}

function insertContact({ name_ar, phone, category_id, source_url, notes }) {
  db.prepare(
    `
    INSERT INTO contacts
    (name_ar, category_id, governorate_id, phone, address, notes, source_url, last_verified)
    VALUES (?, ?, NULL, ?, NULL, ?, ?, date('now'))
  `
  ).run(name_ar, category_id, phone, notes, source_url);
}

function extractPageName(html) {
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  if (stripTags(h1)) return stripTags(h1);
  const og = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || [])[1];
  if (og) return stripTags(og);
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  return stripTags(title);
}

function extractCategoryText(html) {
  const bread = [];
  const breadRegex = /<(?:a|span)[^>]*(?:breadcrumb|breadcrumbs|cat)[^>]*>([\s\S]*?)<\/(?:a|span)>/gi;
  let m;
  while ((m = breadRegex.exec(html))) bread.push(stripTags(m[1]));
  if (bread.join(" ").trim()) return bread.join(" ");
  const meta = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || [])[1];
  return stripTags(meta || "");
}

async function crawl() {
  const queue = [START_URL];
  const visited = new Set();
  const candidates = [];
  const seenContactKey = new Set();

  while (queue.length && visited.size < MAX_PAGES) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    let html;
    try {
      html = await fetchHtml(current);
    } catch {
      continue;
    }

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyText = stripTags(bodyMatch ? bodyMatch[1] : html);
    const phones = extractPhones(bodyText);

    if (phones.length) {
      const name = extractPageName(html);
      const categoryText = extractCategoryText(html);
      const slug = detectCategorySlug(categoryText || name);
      for (const phone of phones) {
        const key = `${name}|${phone}|${slug}`;
        if (!name || seenContactKey.has(key)) continue;
        seenContactKey.add(key);
        candidates.push({
          name_ar: name,
          phone,
          category_slug: slug,
          source_url: current,
          notes: "Imported from hotlinesegypt.com. Verify periodically."
        });
      }
    }

    const links = findAllLinks(html, current);
    for (const abs of links) {
      if (!abs) continue;
      if (!isContentLink(abs)) continue;
      if (!visited.has(abs)) queue.push(abs);
    }
  }

  return candidates;
}

async function main() {
  initSchema();

  const results = await crawl();
  if (!results.length) {
    console.log("No contacts found from hotlinesegypt.com");
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const row of results) {
    const category_id = getCategoryId(row.category_slug);
    if (!category_id) {
      skipped += 1;
      continue;
    }
    if (contactExists(row.name_ar, row.phone, category_id)) {
      skipped += 1;
      continue;
    }
    insertContact({
      name_ar: row.name_ar,
      phone: row.phone,
      category_id,
      source_url: row.source_url,
      notes: row.notes
    });
    inserted += 1;
  }

  console.log(`hotlinesegypt import complete. Crawled: ${results.length}, inserted: ${inserted}, skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
