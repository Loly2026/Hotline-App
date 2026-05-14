import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { createStore } from "./store.js";
import { importEmbassies } from "./import-visahq-embassies.js";
import { fileURLToPath } from "url";

const store = createStore();
await store.initSchema();
await store.ensureCategories([
  { slug: "sportswear", name_ar: "ملابس رياضية" },
  { slug: "gym", name_ar: "جيم" },
  { slug: "sports-equipment", name_ar: "أجهزة رياضية" },
  { slug: "supplements", name_ar: "مكملات غذائية" },
  { slug: "sports-clubs", name_ar: "أندية رياضية" },
  { slug: "tourist-attractions", name_ar: "مزارات سياحية" },
  { slug: "translation-services", name_ar: "خدمات ترجمة" },
  { slug: "travel-agencies", name_ar: "شركات سياحة" },
  { slug: "tourist-help", name_ar: "مساعدة سياحية" },
  { slug: "residency-immigration", name_ar: "إقامة وهجرة" }
]);

const app = express();
const port = process.env.PORT || 4000;
const host = "0.0.0.0";
const feedbackReceiver = process.env.FEEDBACK_TO_EMAIL || "mesho190@gmail.com";
const adminUser = process.env.ADMIN_USER || "admin";
const adminPass = process.env.ADMIN_PASS || "";
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || "";
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || "";
const cloudinaryConfigured = !!cloudinaryCloudName && !!cloudinaryApiKey && !!cloudinaryApiSecret;
const paidAiAssistantEnabled = String(process.env.ENABLE_PAID_AI_ASSISTANT || "false") === "true";
const openaiApiKey = process.env.OPENAI_API_KEY || "";
const openaiModel = process.env.OPENAI_MODEL || "gpt-5.2";
const openaiReasoningEffort = process.env.OPENAI_REASONING_EFFORT || "low";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const LOGOS_DIR = path.resolve(PUBLIC_DIR, "logos");
const scheduledCampaignTimers = new Map();

app.use(cors());
app.use(express.json({ limit: "8mb" }));
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

function sanitizeLogoName(name = "logo") {
  return String(name)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "logo";
}

function getLogoExtension(filename = "", contentType = "") {
  const normalizedType = String(contentType || "").toLowerCase();
  const normalizedName = String(filename || "").toLowerCase();

  if (normalizedType.includes("png") || normalizedName.endsWith(".png")) return "png";
  if (normalizedType.includes("jpeg") || normalizedType.includes("jpg") || normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg")) return "jpg";
  if (normalizedType.includes("webp") || normalizedName.endsWith(".webp")) return "webp";
  if (normalizedType.includes("svg") || normalizedName.endsWith(".svg")) return "svg";
  return "";
}

function createCloudinarySignature(params) {
  const toSign = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${toSign}${cloudinaryApiSecret}`).digest("hex");
}

function buildContactPayload(body, categoryId, governorateId) {
  return {
    name_ar: String(body.name_ar || "").trim(),
    phone: String(body.phone || "").trim(),
    phone_labels: String(body.phone_labels || "").trim(),
    logo_url: String(body.logo_url || "").trim(),
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

function isExpoPushToken(token) {
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(String(token || "").trim());
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function sendExpoPushNotifications(tokens, notification) {
  const validTokens = [...new Set(tokens.filter(isExpoPushToken))];
  const invalidTokens = tokens.filter((token) => !isExpoPushToken(token));
  const disabledTokens = [...invalidTokens];
  let sent = 0;
  let failed = invalidTokens.length;

  for (const chunk of chunkArray(validTokens, 100)) {
    const messages = chunk.map((to) => ({
      to,
      sound: "default",
      title: notification.title,
      body: notification.body,
      richContent: notification.image ? { image: notification.image } : undefined,
      data: notification.data || {},
      channelId: "default"
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(messages)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      failed += chunk.length;
      console.error("expo push send error:", payload);
      continue;
    }

    const results = Array.isArray(payload?.data) ? payload.data : [];
    results.forEach((result, index) => {
      if (result?.status === "ok") {
        sent += 1;
        return;
      }
      failed += 1;
      if (result?.details?.error === "DeviceNotRegistered") {
        disabledTokens.push(chunk[index]);
      }
    });
  }

  return { sent, failed, disabledTokens };
}

function normalizeNotificationTarget(body) {
  return {
    target_screen: String(body?.target_screen || "home").trim() || "home",
    target_group: String(body?.target_group || "").trim(),
    target_category_slug: String(body?.target_category_slug || "").trim()
  };
}

function applyNotificationTemplate(value, service) {
  const raw = String(value || "");
  if (!service) return raw;
  return raw
    .replace(/\{service\}/gi, String(service.name_ar || "").trim())
    .replace(/\{phone\}/gi, String(service.phone || "").trim())
    .replace(/\{category\}/gi, String(service.category_name_ar || "").trim());
}

function extractOpenAIText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const chunks = [];
  const output = Array.isArray(payload?.output) ? payload.output : [];
  output.forEach((item) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((part) => {
      if (typeof part?.text === "string") chunks.push(part.text);
      if (typeof part?.content === "string") chunks.push(part.content);
    });
  });
  return chunks.join("\n").trim();
}

function parseAssistantJson(rawText) {
  const text = String(rawText || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
}

async function getAssistantContactContext(message) {
  const compactQuery = String(message || "")
    .replace(/[^\p{L}\p{N}\s&-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (!compactQuery) return [];

  try {
    return await store.searchContacts({
      q: compactQuery,
      category: "",
      governorate: "",
      limit: 8,
      offset: 0
    });
  } catch (err) {
    console.error("assistant contact context error:", err);
    return [];
  }
}

async function executeNotificationCampaign(campaign) {
  const filters = {
    platform: String(campaign.audience_platform || "all").trim() || "all",
    ui_language: String(campaign.audience_language || "all").trim() || "all"
  };
  const target = {
    target_screen: String(campaign.target_screen || "home").trim() || "home",
    target_group: String(campaign.target_group || "").trim(),
    target_category_slug: String(campaign.target_category_slug || "").trim()
  };
  const service = campaign.service_contact_id
    ? {
        id: Number(campaign.service_contact_id),
        name_ar: String(campaign.service_name || "").trim(),
        phone: String(campaign.service_phone || "").trim(),
        logo_url: String(campaign.service_logo_url || "").trim(),
        category_slug: String(campaign.target_category_slug || "").trim()
      }
    : null;

  const tokens = await store.listActivePushTokens(filters);
  if (!tokens.length) {
    await store.updateNotificationCampaign(campaign.id, {
      status: "sent",
      sent_count: 0,
      failed_count: 0,
      disabled_count: 0
    });
    return { sent: 0, failed: 0, activeTokens: 0, disabled: 0 };
  }

  const result = await sendExpoPushNotifications(tokens, {
    title: String(campaign.title || "").slice(0, 120),
    body: String(campaign.body || "").slice(0, 500),
    image: service?.logo_url || "",
    data: {
      source: "hotline-admin",
      sentAt: new Date().toISOString(),
      messageType: String(campaign.message_type || "update").trim() || "update",
      targetScreen: target.target_screen,
      targetGroup: target.target_group,
      targetCategorySlug: target.target_category_slug,
      serviceContactId: service?.id || null,
      serviceName: service?.name_ar || "",
      servicePhone: service?.phone || "",
      serviceLogoUrl: service?.logo_url || ""
    }
  });

  if (result.disabledTokens.length) {
    await store.disablePushTokens(result.disabledTokens);
  }

  await store.updateNotificationCampaign(campaign.id, {
    status: "sent",
    sent_count: result.sent,
    failed_count: result.failed,
    disabled_count: result.disabledTokens.length
  });

  return {
    sent: result.sent,
    failed: result.failed,
    activeTokens: tokens.length,
    disabled: result.disabledTokens.length
  };
}

function scheduleNotificationCampaign(campaign) {
  const id = Number(campaign?.id || 0);
  if (!id) return;
  const when = new Date(campaign.scheduled_at || "").getTime();
  if (!Number.isFinite(when)) return;

  const existingTimer = scheduledCampaignTimers.get(id);
  if (existingTimer) clearTimeout(existingTimer);

  const delay = Math.max(when - Date.now(), 0);
  const timer = setTimeout(async () => {
    scheduledCampaignTimers.delete(id);
    try {
      await executeNotificationCampaign(campaign);
    } catch (err) {
      console.error("scheduled notification error:", err);
      await store.updateNotificationCampaign(id, {
        status: "failed",
        sent_count: 0,
        failed_count: 0,
        disabled_count: 0
      });
    }
  }, delay);

  scheduledCampaignTimers.set(id, timer);
}

async function bootstrapScheduledNotificationCampaigns() {
  const campaigns = await store.getPendingNotificationCampaigns();
  campaigns.forEach(scheduleNotificationCampaign);
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

app.post("/api/push/register", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!isExpoPushToken(token)) {
      return res.status(400).json({ error: "Invalid Expo push token" });
    }

    await store.upsertPushToken({
      token,
      platform: String(req.body?.platform || "").trim().slice(0, 30),
      device_id: String(req.body?.device_id || "").trim().slice(0, 120),
      ui_language: String(req.body?.ui_language || "").trim().slice(0, 20),
      screen_size: String(req.body?.screen_size || "").trim().slice(0, 40)
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("push register error:", err);
    res.status(500).json({ error: "Failed to register push token" });
  }
});

app.post("/api/assistant/chat", async (req, res) => {
  try {
    if (!paidAiAssistantEnabled) {
      return res.status(503).json({ error: "Paid AI assistant is disabled" });
    }

    if (!openaiApiKey) {
      return res.status(503).json({ error: "AI assistant is not configured" });
    }

    const message = String(req.body?.message || "").trim().slice(0, 1200);
    if (!message) return res.status(400).json({ error: "message is required" });

    const language = String(req.body?.language || req.body?.app_language || "ar").trim() === "en" ? "en" : "ar";
    const contactContext = await getAssistantContactContext(message);
    const contactContextText = contactContext.length
      ? contactContext
          .map((item, index) => {
            const name = String(item.name_ar || "").trim();
            const phone = String(item.phone || "").trim();
            const category = String(item.category_name_ar || item.category_slug || "").trim();
            return `${index + 1}. ${name}${phone ? ` - ${phone}` : ""}${category ? ` (${category})` : ""}`;
          })
          .join("\n")
      : "No matching verified contact rows were provided.";

    const systemPrompt = `
You are the smart assistant inside Hotline Egypt, a mobile app for finding hotlines and useful service numbers in Egypt.
Answer with warmth, clarity, and practical steps. Prefer ${language === "ar" ? "Arabic" : "English"} unless the user clearly uses another language.
You can help with app navigation, finding categories, adding a number, business promotion, support requests, and general service guidance.
When giving phone numbers, use only the verified contact rows provided below. Never invent phone numbers, addresses, prices, legal advice, medical advice, or embassy details.
If the user needs the app team, tell them to press Send request and include the needed details.
Return only valid JSON with this shape:
{"answerAr":"...","answerEn":"...","action":"","actionLabelAr":"","actionLabelEn":""}
Allowed action values are "", "focus-message", "add-number", "promote", "send-support".

Verified contact rows available for this message:
${contactContextText}
`.trim();

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: openaiModel,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: message }]
          }
        ],
        reasoning: { effort: openaiReasoningEffort },
        max_output_tokens: 650
      })
    });

    const payload = await openaiRes.json().catch(() => ({}));
    if (!openaiRes.ok) {
      console.error("openai assistant error:", payload);
      return res.status(502).json({ error: "AI assistant failed to respond" });
    }

    const rawText = extractOpenAIText(payload);
    const parsed = parseAssistantJson(rawText);
    const answerAr = String(parsed?.answerAr || "").trim();
    const answerEn = String(parsed?.answerEn || "").trim();
    const action = String(parsed?.action || "").trim();

    if (!answerAr && !answerEn) {
      return res.status(502).json({ error: "AI assistant returned an empty response" });
    }

    res.json({
      ok: true,
      answerAr: answerAr || answerEn,
      answerEn: answerEn || answerAr,
      action: ["focus-message", "add-number", "promote", "send-support"].includes(action) ? action : "",
      actionLabelAr: String(parsed?.actionLabelAr || "").trim(),
      actionLabelEn: String(parsed?.actionLabelEn || "").trim()
    });
  } catch (err) {
    console.error("assistant chat error:", err);
    res.status(500).json({ error: "Failed to answer with AI assistant" });
  }
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

app.get("/api/admin/push/stats", adminAuth, async (_req, res) => {
  const stats = await store.getPushTokenStats();
  res.json({
    total: Number(stats?.total || 0),
    active: Number(stats?.active || 0),
    android: Number(stats?.android || 0),
    ios: Number(stats?.ios || 0)
  });
});

app.get("/api/admin/push/recent", adminAuth, async (req, res) => {
  const rawLimit = Number.parseInt(String(req.query.limit || "20"), 10);
  const limit = Math.min(Math.max(rawLimit || 20, 1), 100);
  const rows = await store.getRecentPushTokens(limit);
  res.json(
    rows.map((row) => ({
      token_preview: String(row.token || "").slice(0, 20),
      platform: row.platform || "-",
      device_id: row.device_id || "-",
      ui_language: row.ui_language || "-",
      screen_size: row.screen_size || "-",
      enabled: Boolean(row.enabled),
      updated_at: row.updated_at || "-"
    }))
  );
});

app.get("/api/admin/push/campaigns", adminAuth, async (req, res) => {
  const rawLimit = Number.parseInt(String(req.query.limit || "20"), 10);
  const limit = Math.min(Math.max(rawLimit || 20, 1), 100);
  const rows = await store.getRecentNotificationCampaigns(limit);
  res.json(rows);
});

app.delete("/api/admin/push/campaigns/:id", adminAuth, async (req, res) => {
  const campaignId = Number.parseInt(String(req.params.id || "0"), 10);
  if (!Number.isInteger(campaignId) || campaignId <= 0) return res.status(400).json({ error: "Invalid campaign id" });
  const timer = scheduledCampaignTimers.get(campaignId);
  if (timer) {
    clearTimeout(timer);
    scheduledCampaignTimers.delete(campaignId);
  }
  await store.deleteNotificationCampaign(campaignId);
  res.json({ ok: true });
});

app.post("/api/admin/push/send", adminAuth, async (req, res) => {
  try {
    const serviceContactId = Number.parseInt(String(req.body?.service_contact_id || "0"), 10) || 0;
    const serviceContact = serviceContactId > 0 ? await store.getContactById(serviceContactId) : null;
    const title = applyNotificationTemplate(String(req.body?.title || "").trim(), serviceContact).trim();
    const body = applyNotificationTemplate(String(req.body?.body || "").trim(), serviceContact).trim();
    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }

    const audience_platform = String(req.body?.audience_platform || "all").trim() || "all";
    const audience_language = String(req.body?.audience_language || "all").trim() || "all";
    const message_type = String(req.body?.message_type || "update").trim() || "update";
    const scheduledAtRaw = String(req.body?.scheduled_at || "").trim();
    const target = normalizeNotificationTarget(req.body);
    if (serviceContact) {
      target.target_screen = "service";
      target.target_category_slug = serviceContact.category_slug || target.target_category_slug;
    }
    const scheduled_at = scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : null;
    const status = scheduled_at && new Date(scheduled_at).getTime() > Date.now() ? "scheduled" : "sending";

    const campaignId = await store.createNotificationCampaign({
      title: title.slice(0, 120),
      body: body.slice(0, 500),
      message_type,
      audience_platform,
      audience_language,
      target_screen: target.target_screen,
      target_group: target.target_group,
      target_category_slug: target.target_category_slug,
      service_contact_id: serviceContact?.id || null,
      service_name: serviceContact?.name_ar || "",
      service_phone: serviceContact?.phone || "",
      service_logo_url: serviceContact?.logo_url || "",
      scheduled_at,
      status,
      sent_count: 0,
      failed_count: 0,
      disabled_count: 0
    });

    const campaign = {
      id: campaignId,
      title,
      body,
      message_type,
      audience_platform,
      audience_language,
      target_screen: target.target_screen,
      target_group: target.target_group,
      target_category_slug: target.target_category_slug,
      service_contact_id: serviceContact?.id || null,
      service_name: serviceContact?.name_ar || "",
      service_phone: serviceContact?.phone || "",
      service_logo_url: serviceContact?.logo_url || "",
      scheduled_at
    };

    if (status === "scheduled") {
      scheduleNotificationCampaign(campaign);
      return res.json({
        ok: true,
        scheduled: true,
        campaignId,
        scheduledAt: scheduled_at
      });
    }

    const result = await executeNotificationCampaign(campaign);
    res.json({ ok: true, campaignId, scheduled: false, ...result });
  } catch (err) {
    console.error("push send error:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

app.post("/api/admin/upload-logo", adminAuth, async (req, res) => {
  try {
    const filename = String(req.body?.filename || "").trim();
    const contentType = String(req.body?.contentType || "").trim();
    const dataBase64 = String(req.body?.dataBase64 || "").trim();
    const ext = getLogoExtension(filename, contentType);

    if (!dataBase64 || !ext) {
      return res.status(400).json({ error: "Valid image file is required" });
    }
    const baseName = sanitizeLogoName(filename || "logo");
    const imageBuffer = Buffer.from(dataBase64, "base64");

    if (!imageBuffer.length) {
      return res.status(400).json({ error: "Invalid image data" });
    }

    if (cloudinaryConfigured) {
      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = `${baseName}-${Date.now()}`;
      const signature = createCloudinarySignature({
        folder: "hotline-logos",
        public_id: publicId,
        timestamp
      });

      const form = new FormData();
      form.append("file", `data:${contentType || `image/${ext}`};base64,${dataBase64}`);
      form.append("api_key", cloudinaryApiKey);
      form.append("timestamp", String(timestamp));
      form.append("folder", "hotline-logos");
      form.append("public_id", publicId);
      form.append("signature", signature);

      const cloudinaryRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`,
        {
          method: "POST",
          body: form
        }
      );
      const cloudinaryData = await cloudinaryRes.json().catch(() => ({}));
      if (!cloudinaryRes.ok || !cloudinaryData.secure_url) {
        console.error("cloudinary upload error:", cloudinaryData);
        return res.status(500).json({
          error:
            cloudinaryData?.error?.message ||
            cloudinaryData?.message ||
            "Failed to upload logo to cloud storage"
        });
      }

      return res.status(201).json({
        ok: true,
        storage: "cloudinary",
        fileName: cloudinaryData.public_id || publicId,
        url: cloudinaryData.secure_url
      });
    }

    await fs.mkdir(LOGOS_DIR, { recursive: true });
    const safeFileName = `${baseName}-${Date.now()}.${ext}`;
    const absolutePath = path.join(LOGOS_DIR, safeFileName);
    await fs.writeFile(absolutePath, imageBuffer);
    const origin = `${req.protocol}://${req.get("host")}`;
    return res.status(201).json({
      ok: true,
      storage: "local",
      fileName: safeFileName,
      url: `${origin}/logos/${safeFileName}`
    });
  } catch (err) {
    console.error("logo upload error:", err);
    res.status(500).json({ error: "Failed to upload logo" });
  }
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

app.post("/api/admin/import/embassies", adminAuth, async (req, res) => {
  try {
    const result = await importEmbassies({
      maxPages: req.body?.maxPages,
      delayMs: req.body?.delayMs,
      skipExisting: req.body?.skipExisting
    });
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
    logo_url: req.body?.logo_url ?? "",
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

bootstrapScheduledNotificationCampaigns().catch((err) => {
  console.error("scheduled notification bootstrap error:", err);
});
