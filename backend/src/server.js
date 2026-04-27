import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import "dotenv/config";
import { createStore } from "./store.js";
import { importEmbassies } from "./import-visahq-embassies.js";

const store = createStore();
await store.initSchema();

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

function queueFeedbackEmail(message) {
  if (!mailTransporter) return;
  mailTransporter.sendMail(message).catch((err) => {
    console.error("feedback email error:", err);
  });
}

function buildContactPayload(body, categoryId, governorateId) {
  return {
    name_ar: String(body.name_ar || "").trim(),
    phone: String(body.phone || "").trim(),
    address: String(body.address || "").trim(),
    notes: String(body.notes || "").trim(),
    is_non_phone: !!body.is_non_phone,
    is_featured: !!body.is_featured,
    is_verified: !!body.is_verified,
    priority_rank: Math.max(Number.parseInt(body.priority_rank, 10) || 0, 0),
    category_id: categoryId,
    governorate_id: governorateId
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "hotline-backend" });
});

app.get("/api/governorates", async (_req, res) => {
  const rows = await store.getGovernorates();
  res.json(rows);
});

app.get("/api/categories", async (_req, res) => {
  const rows = await store.getCategories();
  res.json(rows);
});

app.get("/api/stats/coverage", async (_req, res) => {
  const result = await store.getCoverage();
  res.json(result);
});

app.get("/api/contacts/popular", async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
  const rows = await store.getPopularContacts(limit);
  res.json(rows);
});

app.post("/api/contacts/:id/request", async (req, res) => {
  const contactId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(contactId) || contactId <= 0) {
    res.status(400).json({ error: "Invalid contact id" });
    return;
  }

  const exists = await store.contactExists(contactId);
  if (!exists) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  await store.insertContactRequest(contactId);
  res.status(201).json({ ok: true });
});

app.get("/api/contacts", async (req, res) => {
  const { q = "", category = "", governorate = "", limit = "100", offset = "0" } = req.query;
  const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 3000);
  const parsedOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);

  const rows = await store.searchContacts({
    q: String(q).trim(),
    category: String(category).trim(),
    governorate: String(governorate).trim(),
    limit: parsedLimit,
    offset: parsedOffset
  });

  res.json(rows);
});

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
      if (!name || !hotline) {
        return res.status(400).json({ error: "organization_name and hotline_number are required" });
      }

      await store.insertPending({ name_ar: name, phone: hotline, category_slug: null, message: "" });

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

      await store.insertPending({ name_ar: "suggestion", phone: "", category_slug: null, message: msg });

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

      await store.insertPending({
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

app.get("/api/admin/categories", adminAuth, async (_req, res) => {
  const rows = await store.getCategories();
  res.json(rows);
});

app.get("/api/admin/contacts", adminAuth, async (req, res) => {
  const { q = "", category = "", limit = "200", offset = "0" } = req.query;
  const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 500);
  const parsedOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
  const rows = await store.getAdminContacts({
    q: String(q).trim(),
    category: String(category).trim(),
    limit: parsedLimit,
    offset: parsedOffset
  });
  res.json(rows);
});

app.post("/api/admin/contacts", adminAuth, async (req, res) => {
  const categorySlug = String(req.body?.category_slug || "").trim();
  const governorateCode = String(req.body?.governorate_code || "").trim();
  const catRow = await store.getCategoryBySlug(categorySlug);
  if (!catRow) return res.status(400).json({ error: "Invalid category_slug" });
  const govRow = governorateCode ? await store.getGovernorateByCode(governorateCode) : null;
  const result = await store.createContact(buildContactPayload(req.body || {}, catRow.id, govRow ? govRow.id : null));
  res.status(201).json({ ok: true, id: result.id });
});

app.put("/api/admin/contacts/:id", adminAuth, async (req, res) => {
  const contactId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(contactId) || contactId <= 0) return res.status(400).json({ error: "Invalid id" });

  const categorySlug = String(req.body?.category_slug || "").trim();
  const governorateCode = String(req.body?.governorate_code || "").trim();
  const catRow = await store.getCategoryBySlug(categorySlug);
  if (!catRow) return res.status(400).json({ error: "Invalid category_slug" });
  const govRow = governorateCode ? await store.getGovernorateByCode(governorateCode) : null;
  const exists = await store.contactExists(contactId);
  if (!exists) return res.status(404).json({ error: "Contact not found" });

  await store.updateContact(contactId, buildContactPayload(req.body || {}, catRow.id, govRow ? govRow.id : null));
  res.json({ ok: true });
});

app.delete("/api/admin/contacts/:id", adminAuth, async (req, res) => {
  const contactId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(contactId) || contactId <= 0) return res.status(400).json({ error: "Invalid id" });
  const exists = await store.contactExists(contactId);
  if (!exists) return res.status(404).json({ error: "Contact not found" });
  await store.deleteContact(contactId);
  res.json({ ok: true });
});

app.get("/api/admin/requests", adminAuth, async (req, res) => {
  const rows = await store.getAdminRequests(Number(req.query.handled) ? 1 : 0);
  res.json(rows);
});

app.post("/api/admin/requests/:id/resolve", adminAuth, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const exists = await store.getPendingById(id);
  if (!exists) return res.status(404).json({ error: "Request not found" });
  await store.markPendingHandled(id);
  res.json({ ok: true });
});

app.put("/api/admin/requests/:id", adminAuth, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const exists = await store.getPendingById(id);
  if (!exists) return res.status(404).json({ error: "Request not found" });

  await store.updateRequest(id, {
    name_ar: String(req.body?.name_ar || "").trim(),
    phone: String(req.body?.phone || "").trim(),
    category_slug: String(req.body?.category_slug || "").trim(),
    message: String(req.body?.message || "").trim(),
    handled: !!req.body?.handled
  });
  res.json({ ok: true });
});

app.delete("/api/admin/requests/:id", adminAuth, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const exists = await store.getPendingById(id);
  if (!exists) return res.status(404).json({ error: "Request not found" });
  await store.deletePending(id);
  res.json({ ok: true });
});

app.post("/api/admin/import/embassies", adminAuth, async (_req, res) => {
  try {
    const result = await importEmbassies();
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("embassy import error:", error);
    res.status(500).json({ error: "Failed to import embassies" });
  }
});

app.post("/api/admin/requests/:id/approve", adminAuth, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const pending = await store.getPendingById(id);
  if (!pending) return res.status(404).json({ error: "Request not found" });

  const body = {
    name_ar: req.body?.name_ar ?? pending.name_ar ?? "",
    phone: req.body?.phone ?? pending.phone ?? "",
    category_slug: req.body?.category_slug ?? pending.category_slug ?? "",
    governorate_code: req.body?.governorate_code ?? "",
    is_non_phone: !!req.body?.is_non_phone,
    is_featured: !!req.body?.is_featured,
    is_verified: !!req.body?.is_verified,
    priority_rank: req.body?.priority_rank ?? 0,
    address: req.body?.address ?? "",
    notes: req.body?.notes ?? pending.message ?? ""
  };

  const catRow = await store.getCategoryBySlug(String(body.category_slug).trim());
  if (!catRow) return res.status(400).json({ error: "Invalid category_slug" });
  const govRow = body.governorate_code ? await store.getGovernorateByCode(String(body.governorate_code).trim()) : null;
  const result = await store.createContact(buildContactPayload(body, catRow.id, govRow ? govRow.id : null));
  await store.markPendingHandled(id);
  res.status(201).json({ ok: true, id: result.id });
});

app.listen(port, host, () => {
  console.log(`Hotline backend running on http://localhost:${port} (LAN: http://<your-ip>:${port})`);
});
