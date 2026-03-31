import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import "dotenv/config";
import { db, initSchema } from "./db.js";

initSchema();

const app = express();
const port = process.env.PORT || 4000;
const host = "0.0.0.0";
const feedbackReceiver = process.env.FEEDBACK_TO_EMAIL || "mesho190@gmail.com";
const adminUser = process.env.ADMIN_USER || "admin";
const adminPass = process.env.ADMIN_PASS || "";

const smtpConfigured =
  !!process.env.SMTP_HOST &&
  !!process.env.SMTP_PORT &&
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS;

const mailTransporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const adminAuth = (req, res, next) => {
  if (!adminPass) {
    res.status(503).json({ error: "Admin credentials not configured" });
    return;
  }
  const header = req.headers.authorization || "";
  const token = header.startsWith("Basic ") ? header.slice(6) : "";
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const [user, pass] = decoded.split(":");
  if (user === adminUser && pass === adminPass) return next();
  res.set("WWW-Authenticate", 'Basic realm="admin"');
  res.status(401).json({ error: "Unauthorized" });
};

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "hotline-backend" });
});

app.get("/api/governorates", (_req, res) => {
  const rows = db.prepare("SELECT id, code, name_ar FROM governorates ORDER BY name_ar ASC").all();
  res.json(rows);
});

app.get("/api/categories", (_req, res) => {
  const rows = db.prepare("SELECT id, slug, name_ar FROM categories ORDER BY name_ar ASC").all();
  res.json(rows);
});

app.get("/api/stats/coverage", (_req, res) => {
  const totals = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total_contacts,
        SUM(CASE WHEN governorate_id IS NULL THEN 1 ELSE 0 END) AS national_contacts
      FROM contacts
    `
    )
    .get();

  const byCategory = db
    .prepare(
      `
      SELECT
        cat.slug,
        cat.name_ar,
        COUNT(c.id) AS contacts_count,
        COUNT(DISTINCT c.governorate_id) AS covered_governorates
      FROM categories cat
      LEFT JOIN contacts c ON c.category_id = cat.id
      GROUP BY cat.id
      ORDER BY cat.name_ar ASC
    `
    )
    .all();

  const byGovernorate = db
    .prepare(
      `
      SELECT
        g.code,
        g.name_ar,
        COUNT(c.id) AS contacts_count
      FROM governorates g
      LEFT JOIN contacts c ON c.governorate_id = g.id
      GROUP BY g.id
      ORDER BY g.name_ar ASC
    `
    )
    .all();

  res.json({ totals, byCategory, byGovernorate });
});

app.get("/api/contacts/popular", (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);

  const rows = db
    .prepare(
      `
      SELECT
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
      LIMIT ?
    `
    )
    .all(limit);

  res.json(rows);
});

app.post("/api/contacts/:id/request", (req, res) => {
  const contactId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(contactId) || contactId <= 0) {
    res.status(400).json({ error: "Invalid contact id" });
    return;
  }

  const exists = db.prepare("SELECT id FROM contacts WHERE id = ?").get(contactId);
  if (!exists) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  db.prepare("INSERT INTO contact_requests (contact_id) VALUES (?)").run(contactId);
  res.status(201).json({ ok: true });
});

app.get("/api/contacts", (req, res) => {
  const { q = "", category = "", governorate = "", limit = "100", offset = "0" } = req.query;

  const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 3000);
  const parsedOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);

  const where = [];
  const params = {
    q: `%${String(q).trim()}%`,
    category: String(category).trim(),
    governorate: String(governorate).trim(),
    limit: parsedLimit,
    offset: parsedOffset
  };

  if (params.category) {
    where.push("cat.slug = @category");
  }

  if (params.governorate) {
    where.push("(g.code = @governorate OR c.governorate_id IS NULL)");
  }

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

  const sql = `
    SELECT
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
    LIMIT @limit OFFSET @offset
  `;

  const rows = db.prepare(sql).all(params);
  res.json(rows);
});

const insertPending = db.prepare(
  `INSERT INTO pending_requests (name_ar, phone, category_slug, message) VALUES (@name_ar, @phone, @category_slug, @message)`
);

function queueFeedbackEmail(message) {
  if (!mailTransporter) return;
  mailTransporter.sendMail(message).catch((err) => {
    console.error("feedback email error:", err);
  });
}

app.post("/api/feedback", async (req, res) => {
  const {
    type = "",
    organization_name = "",
    hotline_number = "",
    requester_name = "",
    business_name = "",
    contact_phone = "",
    plan = "",
    message = ""
  } = req.body || {};

  try {
    if (type === "add_hotline") {
      const name = String(organization_name).trim();
      const hotline = String(hotline_number).trim();
      if (!name || !hotline) return res.status(400).json({ error: "organization_name and hotline_number are required" });

      insertPending.run({ name_ar: name, phone: hotline, category_slug: null, message: "" });

      queueFeedbackEmail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: feedbackReceiver,
        subject: "New Hotline Request",
        text: `Please add this hotline:\n\nName: ${name}\nHotline: ${hotline}`
      });

      return res.status(201).json({ ok: true });
    }

    if (type === "suggestion") {
      const msg = String(message).trim();
      if (!msg) return res.status(400).json({ error: "message is required" });

      insertPending.run({ name_ar: "suggestion", phone: "", category_slug: null, message: msg });

      queueFeedbackEmail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: feedbackReceiver,
        subject: "Hotline App Suggestion",
        text: `User suggestion:\n\n${msg}`
      });

      return res.status(201).json({ ok: true });
    }

    if (type === "business_inquiry") {
      const requester = String(requester_name).trim();
      const business = String(business_name).trim();
      const phone = String(contact_phone).trim();
      const selectedPlan = String(plan).trim();
      const note = String(message).trim();

      if (!requester || !business || !phone || !selectedPlan) {
        return res.status(400).json({ error: "requester_name, business_name, contact_phone, and plan are required" });
      }

      insertPending.run({
        name_ar: `${requester} / ${business}`,
        phone,
        category_slug: "business-plan",
        message: `Plan: ${selectedPlan}${note ? `\nNote: ${note}` : ""}`
      });

      queueFeedbackEmail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: feedbackReceiver,
        subject: "Business Plan Request",
        text: `Business inquiry received:\n\nRequester: ${requester}\nBusiness: ${business}\nPhone: ${phone}\nPlan: ${selectedPlan}\n${note ? `Note: ${note}\n` : ""}`
      });

      return res.status(201).json({ ok: true });
    }

    res.status(400).json({ error: "Unsupported type" });
  } catch (err) {
    console.error("feedback request error:", err);
    res.status(500).json({ error: "Failed to send feedback" });
  }
});

// ---------- Admin APIs ----------
const selectCategoryId = db.prepare("SELECT id FROM categories WHERE slug = ?");
const selectGovernorateId = db.prepare("SELECT id FROM governorates WHERE code = ?");
const selectPendingById = db.prepare("SELECT id, name_ar, phone, category_slug, message, handled, created_at FROM pending_requests WHERE id = ?");
const markPendingHandled = db.prepare("UPDATE pending_requests SET handled = 1 WHERE id = ?");
const deletePendingStmt = db.prepare("DELETE FROM pending_requests WHERE id = ?");
const insertContactStmt = db.prepare(
  `INSERT INTO contacts (name_ar, phone, address, notes, is_non_phone, is_featured, is_verified, priority_rank, category_id, governorate_id)
   VALUES (@name_ar, @phone, @address, @notes, @is_non_phone, @is_featured, @is_verified, @priority_rank, @category_id, @governorate_id)`
);

app.get("/api/admin/categories", adminAuth, (_req, res) => {
  const rows = db.prepare("SELECT id, slug, name_ar FROM categories ORDER BY name_ar ASC").all();
  res.json(rows);
});

app.get("/api/admin/contacts", adminAuth, (req, res) => {
  const { q = "", category = "", limit = "200", offset = "0" } = req.query;
  const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 500);
  const parsedOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
  const where = [];
  const params = {
    q: `%${String(q).trim()}%`,
    category: String(category).trim(),
    limit: parsedLimit,
    offset: parsedOffset
  };
  if (params.category) where.push("cat.slug = @category");
  if (String(q).trim()) {
    where.push("(c.name_ar LIKE @q OR c.phone LIKE @q OR IFNULL(c.notes,'') LIKE @q OR cat.name_ar LIKE @q)");
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `
      SELECT
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
      LIMIT @limit OFFSET @offset
    `
    )
    .all(params);
  res.json(rows);
});

app.post("/api/admin/contacts", adminAuth, (req, res) => {
  const {
    name_ar = "",
    phone = "",
    category_slug = "",
    governorate_code = "",
    is_non_phone = false,
    is_featured = false,
    is_verified = false,
    priority_rank = 0,
    address = "",
    notes = ""
  } =
    req.body || {};
  const catIdRow = selectCategoryId.get(String(category_slug).trim());
  if (!catIdRow) return res.status(400).json({ error: "Invalid category_slug" });
  const govRow = governorate_code ? selectGovernorateId.get(String(governorate_code).trim()) : null;
  const result = insertContactStmt.run({
    name_ar: String(name_ar).trim(),
    phone: String(phone).trim(),
    address: String(address || "").trim(),
    notes: String(notes || "").trim(),
    is_non_phone: !!is_non_phone ? 1 : 0,
    is_featured: !!is_featured ? 1 : 0,
    is_verified: !!is_verified ? 1 : 0,
    priority_rank: Math.max(Number.parseInt(priority_rank, 10) || 0, 0),
    category_id: catIdRow.id,
    governorate_id: govRow ? govRow.id : null
  });
  res.status(201).json({ ok: true, id: result.lastInsertRowid });
});

app.put("/api/admin/contacts/:id", adminAuth, (req, res) => {
  const contactId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(contactId) || contactId <= 0) return res.status(400).json({ error: "Invalid id" });
  const {
    name_ar = "",
    phone = "",
    category_slug = "",
    governorate_code = "",
    is_non_phone = false,
    is_featured = false,
    is_verified = false,
    priority_rank = 0,
    address = "",
    notes = ""
  } =
    req.body || {};
  const catIdRow = selectCategoryId.get(String(category_slug).trim());
  if (!catIdRow) return res.status(400).json({ error: "Invalid category_slug" });
  const govRow = governorate_code ? selectGovernorateId.get(String(governorate_code).trim()) : null;
  const exists = db.prepare("SELECT id FROM contacts WHERE id = ?").get(contactId);
  if (!exists) return res.status(404).json({ error: "Contact not found" });

  db.prepare(
    `UPDATE contacts
     SET name_ar=@name_ar, phone=@phone, address=@address, notes=@notes,
         is_non_phone=@is_non_phone, is_featured=@is_featured, is_verified=@is_verified,
         priority_rank=@priority_rank, category_id=@category_id, governorate_id=@governorate_id
     WHERE id=@id`
  ).run({
    id: contactId,
    name_ar: String(name_ar).trim(),
    phone: String(phone).trim(),
    address: String(address || "").trim(),
    notes: String(notes || "").trim(),
    is_non_phone: !!is_non_phone ? 1 : 0,
    is_featured: !!is_featured ? 1 : 0,
    is_verified: !!is_verified ? 1 : 0,
    priority_rank: Math.max(Number.parseInt(priority_rank, 10) || 0, 0),
    category_id: catIdRow.id,
    governorate_id: govRow ? govRow.id : null
  });
  res.json({ ok: true });
});

app.delete("/api/admin/contacts/:id", adminAuth, (req, res) => {
  const contactId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(contactId) || contactId <= 0) return res.status(400).json({ error: "Invalid id" });
  const exists = db.prepare("SELECT id FROM contacts WHERE id = ?").get(contactId);
  if (!exists) return res.status(404).json({ error: "Contact not found" });
  db.prepare("DELETE FROM contacts WHERE id = ?").run(contactId);
  res.json({ ok: true });
});

app.get("/api/admin/requests", adminAuth, (req, res) => {
  const { handled = "0" } = req.query;
  const rows = db
    .prepare(
      `SELECT id, name_ar, phone, category_slug, message, handled, created_at
       FROM pending_requests
       WHERE handled = @handled
       ORDER BY created_at DESC`
    )
    .all({ handled: Number(handled) ? 1 : 0 });
  res.json(rows);
});

app.post("/api/admin/requests/:id/resolve", adminAuth, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const exists = selectPendingById.get(id);
  if (!exists) return res.status(404).json({ error: "Request not found" });
  markPendingHandled.run(id);
  res.json({ ok: true });
});

app.put("/api/admin/requests/:id", adminAuth, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const exists = selectPendingById.get(id);
  if (!exists) return res.status(404).json({ error: "Request not found" });

  const { name_ar = "", phone = "", category_slug = "", message = "", handled = false } = req.body || {};
  db.prepare(
    `UPDATE pending_requests
     SET name_ar = @name_ar, phone = @phone, category_slug = @category_slug, message = @message, handled = @handled
     WHERE id = @id`
  ).run({
    id,
    name_ar: String(name_ar || "").trim(),
    phone: String(phone || "").trim(),
    category_slug: String(category_slug || "").trim(),
    message: String(message || "").trim(),
    handled: handled ? 1 : 0
  });
  res.json({ ok: true });
});

app.delete("/api/admin/requests/:id", adminAuth, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const exists = selectPendingById.get(id);
  if (!exists) return res.status(404).json({ error: "Request not found" });
  deletePendingStmt.run(id);
  res.json({ ok: true });
});

app.post("/api/admin/requests/:id/approve", adminAuth, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const exists = selectPendingById.get(id);
  if (!exists) return res.status(404).json({ error: "Request not found" });

  const pending = exists;
  const {
    name_ar = pending.name_ar || "",
    phone = pending.phone || "",
    category_slug = pending.category_slug || "",
    governorate_code = "",
    is_non_phone = false,
    is_featured = false,
    is_verified = false,
    priority_rank = 0,
    address = "",
    notes = pending.message || ""
  } = req.body || {};

  const catIdRow = selectCategoryId.get(String(category_slug).trim());
  if (!catIdRow) return res.status(400).json({ error: "Invalid category_slug" });
  const govRow = governorate_code ? selectGovernorateId.get(String(governorate_code).trim()) : null;

  const result = insertContactStmt.run({
    name_ar: String(name_ar).trim(),
    phone: String(phone).trim(),
    address: String(address || "").trim(),
    notes: String(notes || "").trim(),
    is_non_phone: !!is_non_phone ? 1 : 0,
    is_featured: !!is_featured ? 1 : 0,
    is_verified: !!is_verified ? 1 : 0,
    priority_rank: Math.max(Number.parseInt(priority_rank, 10) || 0, 0),
    category_id: catIdRow.id,
    governorate_id: govRow ? govRow.id : null
  });

  markPendingHandled.run(id);
  res.status(201).json({ ok: true, id: result.lastInsertRowid });
});

app.listen(port, host, () => {
  console.log(`Hotline backend running on http://localhost:${port} (LAN: http://<your-ip>:${port})`);
});
