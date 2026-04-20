import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Easing,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  PanResponder,
  ImageBackground,
  Dimensions,
  useWindowDimensions
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { API_BASE_URL } from "./src/config/api";
import FALLBACK_CONTACTS from "./src/data/fallbackContacts";

const GROUPS = [
  { key: "gov", title: "Emergency", icon: "🚨" },
  { key: "health", title: "Hospital", icon: "🏨" },
  { key: "food", title: "Food & Malls", icon: "🍽️" },
  { key: "finance", title: "Finance & Realty", icon: "💳" },
  { key: "mobility", title: "Cars & Transport", icon: "🚗" },
  { key: "retail", title: "Services", icon: "🧰" }
];
const GROUP_AR = {
  gov: "طوارئ وخدمات حكومية",
  health: "مستشفيات وخدمات طبية",
  food: "مطاعم ومولات",
  finance: "مال وعقارات",
  mobility: "سيارات ومواصلات وشحن",
  retail: "خدمات متنوعة"
};
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

function levenshtein(a, b) {
  const s = normalizeText(a);
  const t = normalizeText(b);
  if (!s) return t.length;
  if (!t) return s.length;

  const dp = Array.from({ length: s.length + 1 }, () => Array(t.length + 1).fill(0));
  for (let i = 0; i <= s.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= t.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[s.length][t.length];
}

function detectGroup(categoryName) {
  const n = normalizeText(categoryName);
  if (n.includes("طوارئ") || n.includes("حكومي") || n.includes("مبادرات") || n.includes("هيئات")) return "gov";
  if (n.includes("مستشفيات") || n.includes("طبيه") || n.includes("معامل") || n.includes("صيدليات") || n.includes("ادويه")) return "health";
  if (n.includes("مطاعم") || n.includes("كافيهات") || n.includes("مخابز") || n.includes("حلويات")) return "food";
  if (n.includes("بنوك") || n.includes("تمويل") || n.includes("تأمين") || n.includes("ماليه") || n.includes("تداول")) return "finance";
  if (n.includes("سيارات") || n.includes("نقل") || n.includes("مواصلات") || n.includes("طيران") || n.includes("وقود")) return "mobility";
  return "retail";
}

const GROUP_BY_KEY = GROUPS.reduce((acc, group) => {
  acc[group.key] = group;
  return acc;
}, {});

const ICONS = {
  gov: { set: "ion", name: "alert-circle", color: "#d0004f" },
  health: { set: "ion", name: "medical", color: "#e91e63" },
  food: { set: "ion", name: "fast-food", color: "#ff9800" },
  finance: { set: "ion", name: "cash", color: "#0ea5e9" },
  mobility: { set: "ion", name: "car-sport", color: "#22c55e" },
  retail: { set: "mci", name: "toolbox-outline", color: "#8b5cf6" }
};
const GROUP_COLORS = {
  gov: { accent: "#ef4444", card: "#fde2e2", cardActive: "#f9c9c9" },
  health: { accent: "#ec4899", card: "#fde1ef", cardActive: "#f9c7e0" },
  food: { accent: "#f59e0b", card: "#feedd1", cardActive: "#f9ddb0" },
  finance: { accent: "#0ea5e9", card: "#dcedfb", cardActive: "#c2e2fb" },
  mobility: { accent: "#22c55e", card: "#deefe0", cardActive: "#cae8d0" },
  retail: { accent: "#8b5cf6", card: "#ebe0ff", cardActive: "#dbcafc" }
};
const CATEGORY_GROUP_OVERRIDES = {
  emergency: "gov",
  hospitals: "health",
  labs: "health",
  pharmacies: "health",
  restaurants: "food",
  "cafes-desserts": "food",
  banks: "finance",
  "finance-payments": "finance",
  "mobile-internet": "retail",
  shipping: "mobility",
  "auto-service": "mobility",
  airlines: "mobility",
  furniture: "retail",
  appliances: "retail",
  supermarkets: "food",
  hotels: "retail",
  realestate: "finance",
  apps: "retail",
  charity: "retail",
  syndicates: "retail",
  education: "retail"
};
const CATEGORY_ORDER_BY_GROUP = {
  retail: {
    "mobile-internet": 1,
    appliances: 2,
    apps: 3
  }
};
const CONTACT_ASSISTANT_TOPICS = [
  {
    key: "greeting",
    questionEn: "Hello",
    questionAr: "السلام عليكم",
    answerEn: "Hello and welcome. I’m here to help you with search, adding numbers, business promotion, and support inside the app.",
    answerAr: "وعليكم السلام وأهلاً بك. أنا هنا لمساعدتك في البحث، وإضافة الأرقام، وترويج النشاط، والدعم داخل التطبيق."
  },
  {
    key: "thanks",
    questionEn: "Thank you",
    questionAr: "شكرًا",
    answerEn: "You’re welcome. If you need anything else, I’m here to help.",
    answerAr: "العفو. إذا احتجت أي شيء آخر فأنا هنا للمساعدة."
  },
  {
    key: "about",
    questionEn: "What is this app?",
    questionAr: "ما هو هذا التطبيق؟",
    answerEn: "Hotline App is a fast directory for important hotlines and service numbers in Egypt, organized into clear categories for quick access.",
    answerAr: "Hotline App هو دليل سريع لأهم الخطوط الساخنة وأرقام الخدمات في مصر، مع تصنيفات واضحة للوصول السريع."
  },
  {
    key: "services",
    questionEn: "What services can it help me with?",
    questionAr: "ما الخدمات التي يمكن أن يوفرها لي؟",
    answerEn: "The app helps with emergency numbers, hospitals, food, finance, transport, telecom, and many other useful services.",
    answerAr: "التطبيق يساعدك في أرقام الطوارئ، المستشفيات، الطعام، الخدمات المالية، النقل، الاتصالات، وخدمات مفيدة أخرى كثيرة."
  },
  {
    key: "search",
    questionEn: "How do I search quickly?",
    questionAr: "كيف أبحث بسرعة؟",
    answerEn: "Use the search bar at the top to search by service name or hotline number. You can also tap the search icon to open the best matching result.",
    answerAr: "استخدم شريط البحث في الأعلى للبحث باسم الخدمة أو رقم الخط الساخن. ويمكنك أيضًا الضغط على أيقونة البحث لفتح أقرب نتيجة مناسبة."
  },
  {
    key: "add-number",
    questionEn: "How can I add a new number?",
    questionAr: "كيف أضيف رقمًا جديدًا؟",
    answerEn: "You can use Add Number to suggest a new hotline or service, and we will review it before adding it to the app.",
    answerAr: "يمكنك استخدام Add Number لاقتراح رقم أو خدمة جديدة، وسنراجعها قبل إضافتها إلى التطبيق.",
    action: "add-number",
    actionLabelEn: "Open Add Number",
    actionLabelAr: "افتح إضافة رقم"
  },
  {
    key: "update-number",
    questionEn: "What if I find a wrong or old number?",
    questionAr: "ماذا أفعل إذا وجدت رقمًا خطأ أو قديمًا؟",
    answerEn: "Write your correction request and press Send request so we can review it before publishing the update in the app.",
    answerAr: "اكتب طلبك واضغط على إرسال الطلب لنراجعه قبل نشر التحديث داخل التطبيق."
  },
  {
    key: "verified",
    questionEn: "What is the difference between plans?",
    questionAr: "ما الفرق بين الباقات؟",
    answerEn: "Verified gives trusted status, Featured improves visibility, and Premium combines stronger visibility with top priority inside the app.",
    answerAr: "موثقة تعطي حالة موثوقة، ومميزة تزيد الظهور، وبريميوم تجمع بين قوة الظهور والأولوية الأعلى داخل التطبيق.",
    action: "promote",
    actionLabelEn: "Open Promote",
    actionLabelAr: "افتح ترويج"
  },
  {
    key: "promote",
    questionEn: "How can my business appear here?",
    questionAr: "كيف أجعل رقمي أو نشاطي يظهر هنا بشكل مميز؟",
    answerEn: "Use Promote to view featured business plans, verified listing options, and stronger visibility inside the app.",
    answerAr: "استخدم Promote لعرض باقات الظهور المميز، وخيارات التوثيق، وزيادة الظهور داخل التطبيق.",
    action: "promote",
    actionLabelEn: "Open Promote",
    actionLabelAr: "افتح ترويج"
  },
  {
    key: "language",
    questionEn: "Does the app support Arabic and English?",
    questionAr: "هل التطبيق يدعم العربية والإنجليزية؟",
    answerEn: "Yes. The app is designed to stay easy for Arabic users and still understandable for English-speaking users in key places.",
    answerAr: "نعم. التطبيق مصمم ليكون سهلًا للمستخدم العربي، وفي نفس الوقت مفهومًا للمستخدم الذي يفضل الإنجليزية في الأجزاء المهمة."
  },
  {
    key: "support",
    questionEn: "I still need help",
    questionAr: "ما زلت أحتاج مساعدة",
    answerEn: "You can write your message below and send it directly to us. We review suggestions and support requests regularly.",
    answerAr: "يمكنك كتابة رسالتك بالأسفل وإرسالها مباشرة لنا. نحن نراجع الاقتراحات وطلبات المساعدة بشكل منتظم.",
    action: "focus-message",
    actionLabelEn: "Write your message",
    actionLabelAr: "ابدأ الكتابة"
  },
  {
    key: "technical-support",
    questionEn: "I need technical support",
    questionAr: "أحتاج دعمًا فنيًا",
    answerEn: "If you have a problem in the app, describe it briefly and send it to us. You can also mention what screen or feature caused the issue so we can help faster.",
    answerAr: "إذا كانت لديك مشكلة داخل التطبيق، اكتبها باختصار وأرسلها لنا. ويمكنك أيضًا ذكر الشاشة أو الميزة التي ظهرت فيها المشكلة حتى نساعدك بشكل أسرع.",
    action: "focus-message",
    actionLabelEn: "Describe the problem",
    actionLabelAr: "اكتب المشكلة"
  },
  {
    key: "problem",
    questionEn: "I have a problem",
    questionAr: "عندي مشكلة",
    answerEn: "I’m sorry you ran into a problem. I can help you with guidance here, or you can write the issue below and send it directly to our team.",
    answerAr: "آسف لوجود مشكلة عندك. أقدر أساعدك بالإرشاد هنا، أو يمكنك كتابة المشكلة بالأسفل وإرسالها مباشرة إلى فريقنا.",
    action: "focus-message",
    actionLabelEn: "Write the problem",
    actionLabelAr: "اكتب المشكلة"
  },
  {
    key: "respect",
    questionEn: "I’m upset",
    questionAr: "أنا منزعج",
    answerEn: "I’m sorry if something caused frustration. I’ll still try to help as clearly as possible. Tell me the issue and I’ll guide you to the best next step.",
    answerAr: "أنا آسف إذا كان هناك شيء سبب لك انزعاجًا. سأحاول مساعدتك بأوضح طريقة ممكنة. اكتب المشكلة وسأرشدك لأفضل خطوة تالية.",
    action: "focus-message",
    actionLabelEn: "Tell me the issue",
    actionLabelAr: "اكتب المشكلة"
  }
];
const CONTACT_ASSISTANT_VISIBLE_TOPIC_KEYS = [
  "about",
  "services",
  "search",
  "add-number",
  "update-number",
  "verified",
  "promote",
  "language",
  "support"
];
const CONTACT_ASSISTANT_INTENTS = [
  {
    topicKey: "greeting",
    keywords: [
      "سلام عليكم",
      "السلام عليكم",
      "وعليكم السلام",
      "اهلا",
      "أهلا",
      "اهلا بيك",
      "مرحبا",
      "صباح الخير",
      "صباح الورد",
      "مساء الخير",
      "مساء النور",
      "hello",
      "hi",
      "hey",
      "good morning",
      "good evening"
    ]
  },
  {
    topicKey: "thanks",
    keywords: [
      "شكرا",
      "شكرًا",
      "متشكر",
      "تسلم",
      "thank you",
      "thanks",
      "thx"
    ]
  },
  {
    topicKey: "add-number",
    keywords: [
      "اضيف رقم",
      "اضافه رقم",
      "اريد اضافه رقم",
      "عايز اضيف رقم",
      "عاوز اضيف رقم",
      "محتاج اضيف رقم",
      "اضيف رقمي",
      "اضافة رقمي",
      "رقم جديد",
      "add number",
      "add my number",
      "i want to add a number",
      "new number",
      "suggest number",
      "add hotline"
    ]
  },
  {
    topicKey: "update-number",
    keywords: [
      "رقم غلط",
      "رقم خطا",
      "رقم قديم",
      "تصحيح رقم",
      "اعدل رقمي",
      "تعديل رقمي",
      "عايز اعدل رقمي",
      "عاوز اعدل رقمي",
      "تعديل الرقم",
      "صحح الرقم",
      "مش شغال",
      "الرقم مش شغال",
      "الرقم خطأ",
      "wrong number",
      "old number",
      "edit my number",
      "change my number",
      "update number",
      "incorrect number"
    ]
  },
  {
    topicKey: "promote",
    keywords: [
      "اظهر نشاطي",
      "اظهر رقمي",
      "ارقي نشاطي",
      "ترقيه نشاطي",
      "ترقية نشاطي",
      "عايز اروج",
      "عاوز اروج",
      "اروج نشاطي",
      "اخلي نشاطي يظهر",
      "اعمل اعلان",
      "اعلن",
      "ترويج",
      "promote",
      "featured",
      "upgrade my business",
      "promote my business",
      "show my number",
      "show my listing",
      "list my business",
      "show my business",
      "advertise"
    ]
  },
  {
    topicKey: "verified",
    keywords: [
      "فرق الباقات",
      "الباقات",
      "ايه الباقات",
      "ما هي الباقات",
      "اسعار الباقات",
      "الاسعار",
      "سعر الباقات",
      "موثقه",
      "مميزه",
      "بريميوم",
      "plans",
      "pricing",
      "prices",
      "plan price",
      "business plans",
      "verified",
      "premium",
      "featured plan"
    ]
  },
  {
    topicKey: "search",
    keywords: [
      "ابحث",
      "بحث",
      "ادور",
      "ازاي ابحث",
      "كيف ابحث",
      "ادور ازاي",
      "ابحث ازاي",
      "search",
      "how to search",
      "how do i search",
      "find",
      "look up"
    ]
  },
  {
    topicKey: "services",
    keywords: [
      "الخدمات",
      "ايه الخدمات",
      "ايه المطلوب",
      "المطلوب ايه",
      "الخدمات اللي عندكم",
      "ايه اللي التطبيق بيقدمه",
      "التطبيق بيعمل ايه",
      "ممكن يساعدني في ايه",
      "يوفر ايه",
      "services",
      "what do you offer",
      "what can you help me with",
      "what can it do",
      "what services"
    ]
  },
  {
    topicKey: "about",
    keywords: [
      "ايه التطبيق",
      "ما هو التطبيق",
      "انتم مين",
      "انتو مين",
      "مين انتو",
      "من انتم",
      "عن التطبيق",
      "what is this app",
      "who are you",
      "what are you",
      "about app",
      "what is hotline app"
    ]
  },
  {
    topicKey: "language",
    keywords: [
      "عربي",
      "انجليزي",
      "اللغة",
      "غير اللغة",
      "اختار اللغة",
      "arabic",
      "english",
      "change language",
      "language option",
      "language"
    ]
  },
  {
    topicKey: "support",
    keywords: [
      "محتاج مساعده",
      "محتاج مساعدة",
      "عايز مساعده",
      "عايز مساعدة",
      "عاوز مساعدة",
      "ساعدني",
      "ساعدنى",
      "لو سمحت ساعدني",
      "لو سمحت ساعدنى",
      "ممكن تساعدني",
      "ممكن تساعدنى",
      "help",
      "help me",
      "i need help",
      "support",
      "contact support"
    ]
  },
  {
    topicKey: "technical-support",
    keywords: [
      "دعم فني",
      "الدعم الفني",
      "customer service",
      "technical support",
      "tech support",
      "support team",
      "خدمة العملاء",
      "كوستمر سيرفيس"
    ]
  },
  {
    topicKey: "problem",
    keywords: [
      "عندي مشكلة",
      "في مشكلة",
      "مشكلة ظهرت",
      "المشكلة",
      "في عطل",
      "التطبيق واقف",
      "حصل خطأ",
      "error",
      "bug",
      "issue",
      "problem",
      "something went wrong"
    ]
  },
  {
    topicKey: "respect",
    keywords: [
      "غلط",
      "زفت",
      "سيء",
      "مش عاجبني",
      "bad",
      "stupid",
      "useless",
      "annoying"
    ]
  }
];
const introLocal = require("./assets/intro.png");
const CONTACTS_CACHE_PATH = `${FileSystem.cacheDirectory}contacts-cache.json`;
const SUGGEST_HINT_PATH = `${FileSystem.documentDirectory}suggest-hint-seen.txt`;

function resolveGroupForCategory(contact) {
  if (contact?.category_slug && CATEGORY_GROUP_OVERRIDES[contact.category_slug]) {
    return CATEGORY_GROUP_OVERRIDES[contact.category_slug];
  }
  return detectGroup(contact?.category_name_ar);
}

function sortContacts(items) {
  return [...items].sort((a, b) => {
    const featuredDiff = Number(b?.is_featured || 0) - Number(a?.is_featured || 0);
    if (featuredDiff) return featuredDiff;
    const priorityDiff = Number(b?.priority_rank || 0) - Number(a?.priority_rank || 0);
    if (priorityDiff) return priorityDiff;
    const verifiedDiff = Number(b?.is_verified || 0) - Number(a?.is_verified || 0);
    if (verifiedDiff) return verifiedDiff;
    const nationalDiff = Number(b?.is_national || 0) - Number(a?.is_national || 0);
    if (nationalDiff) return nationalDiff;
    return String(a?.name_ar || "").localeCompare(String(b?.name_ar || ""), "ar");
  });
}

function findAssistantTopicByKey(topicKey) {
  return CONTACT_ASSISTANT_TOPICS.find((item) => item.key === topicKey) || null;
}

function detectAssistantTopic(message) {
  const normalized = normalizeText(message);
  if (!normalized) return null;
  const messageWords = normalized.split(" ").filter(Boolean);
  let bestMatch = null;
  let bestScore = 0;

  CONTACT_ASSISTANT_INTENTS.forEach((intent) => {
    let score = 0;
    intent.keywords.forEach((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword) return;

      if (normalized.includes(normalizedKeyword)) {
        score += normalizedKeyword.includes(" ") ? 4 : 3;
        return;
      }

      const keywordWords = normalizedKeyword.split(" ").filter(Boolean);
      const matchedWords = keywordWords.filter(
        (word) =>
          messageWords.includes(word) ||
          messageWords.some((msgWord) => msgWord.includes(word) || word.includes(msgWord))
      ).length;

      if (matchedWords > 0) {
        score += matchedWords / keywordWords.length;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = intent;
    }
  });

  if (!bestMatch || bestScore < 1.1) return null;
  return findAssistantTopicByKey(bestMatch.topicKey);
}

function extractAssistantName(message) {
  const arabicNameMatch =
    message.match(/(?:انا اسمي|اسمي|انا اسمى|اسمى)\s+([^\n\r,.!؟]+)/i) ||
    message.match(/(?:أنا اسمي|إسمي|انا|أنا|معاك|معاكي)\s+([^\n\r,.!؟]+)/i);
  const englishNameMatch = message.match(/(?:my name is|i am|i'm|this is)\s+([a-zA-Z][a-zA-Z\s'-]{1,40})/i);
  return (arabicNameMatch?.[1] || englishNameMatch?.[1] || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

function getAssistantNameReply(message) {
  const detectedName = extractAssistantName(message);
  if (!detectedName) return null;
  return {
    answerEn: `Welcome, ${detectedName}. I’m your smart assistant. How can I help you today?`,
    answerAr: `أهلاً وسهلاً بك يا ${detectedName}. أنا مساعدك الذكي، أقدر أساعدك إزاي؟`
  };
}

function getAssistantReplyForMessage(message, topic) {
  const normalized = normalizeText(message);
  if (!topic || !normalized) return null;

  if (topic.key === "greeting") {
    if (normalized.includes("السلام عليكم") || normalized.includes("سلام عليكم")) {
      return {
        answerEn: "Wa alaikum assalam. Welcome, I’m here to help you.",
        answerAr: "وعليكم السلام. أهلاً بك، أنا هنا لمساعدتك."
      };
    }
    if (normalized.includes("صباح الورد")) {
      return {
        answerEn: "Good morning to you too. Wishing you a lovely day.",
        answerAr: "صباح الفل والورد. يومك جميل إن شاء الله."
      };
    }
    if (normalized.includes("صباح الخير")) {
      return {
        answerEn: "Good morning. How can I help you today?",
        answerAr: "صباح النور. كيف أستطيع مساعدتك اليوم؟"
      };
    }
    if (normalized.includes("مساء الخير")) {
      return {
        answerEn: "Good evening. How can I help you tonight?",
        answerAr: "مساء النور. كيف أستطيع مساعدتك الليلة؟"
      };
    }
    if (normalized.includes("hello") || normalized === "hi" || normalized.includes("hey")) {
      return {
        answerEn: "Hello. I’m here to help you with anything inside the app.",
        answerAr: "مرحبًا. أنا هنا لمساعدتك في أي شيء داخل التطبيق."
      };
    }
  }

  if (topic.key === "support") {
    if (
      normalized.includes("ساعدني") ||
      normalized.includes("ساعدنى") ||
      normalized.includes("لو سمحت") ||
      normalized.includes("لو سمحتى") ||
      normalized.includes("محتاج دعم") ||
      normalized.includes("اريد مساعده") ||
      normalized.includes("احتاج مساعده") ||
      normalized.includes("محتاج مساعده") ||
      normalized.includes("محتاج مساعدة") ||
      normalized.includes("عايز مساعدة") ||
      normalized.includes("عايز مساعده") ||
      normalized.includes("عاوز مساعدة") ||
      normalized.includes("عاوز مساعده") ||
      normalized.includes("help me")
    ) {
      return {
        answerEn: "How can I help you? Write your request or problem and we’ll solve it together.",
        answerAr: "كيف يمكن أن أساعدك؟ اكتب طلبك أو مشكلتك لنحلها سويًا."
      };
    }
  }

  return null;
}

function sortCategoriesForGroup(a, b, groupKey) {
  const orderMap = CATEGORY_ORDER_BY_GROUP[groupKey] || {};
  const aOrder = orderMap[a.slug] || 999;
  const bOrder = orderMap[b.slug] || 999;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return String(a.name || "").localeCompare(String(b.name || ""), "ar");
}

export default function App() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const isLargeTablet = screenWidth >= 1024;
  const isAndroid = Platform.OS === "android";
  const widthScale = Math.min(Math.max(screenWidth / (isTablet ? 900 : 390), 0.88), isTablet ? 1.08 : 1.12);
  const heightScale = Math.min(Math.max(screenHeight / (isTablet ? 1180 : 844), 0.9), 1.08);
  const uiScale = Math.min(widthScale, heightScale);
  const physicalScreenHeight = Dimensions.get("screen").height;
  const androidSystemInset = isAndroid ? Math.max(physicalScreenHeight - screenHeight, 0) : 0;
  const androidBottomSafeOffset = isAndroid
    ? Math.max(androidSystemInset, Math.round((isTablet ? 28 : 22) * heightScale))
    : 0;
  const contentHorizontalInset = Math.round((isLargeTablet ? 32 : isTablet ? 22 : 14) * widthScale);
  const swipeThreshold = screenWidth * 0.25;
  const heroContentWidth = isLargeTablet
    ? Math.min(screenWidth - contentHorizontalInset * 2, 920)
    : isTablet
      ? Math.min(screenWidth - contentHorizontalInset * 2, 780)
      : screenWidth;
  const bodyContentWidth = isLargeTablet
    ? Math.min(screenWidth - contentHorizontalInset * 2, 980)
    : isTablet
      ? Math.min(screenWidth - contentHorizontalInset * 2, 800)
      : screenWidth;
  const categoryColumns = isLargeTablet ? 2 : isTablet ? 3 : 2;
  const categoryRowCount = Math.ceil(GROUPS.length / categoryColumns);
  const heroIconSize = Math.round((isLargeTablet ? 46 : 38) * uiScale);
  const heroInfoIconSize = Math.round((isLargeTablet ? 22 : 20) * uiScale);
  const categoryIconSize = Math.round((isLargeTablet ? 40 : isTablet ? 36 : 50) * uiScale);
  const bottomSideIconSize = Math.round((isLargeTablet ? 28 : isTablet ? 26 : 32) * uiScale);
  const bottomCenterIconSize = Math.round((isLargeTablet ? 22 : isTablet ? 20 : 24) * uiScale);
  const largeTabletGridGap = Math.round(22 * heightScale);
  const largeTabletGridAvailableHeight = Math.max(
    screenHeight -
      Math.round(320 * heightScale) -
      Math.round(150 * heightScale) -
      androidBottomSafeOffset,
    Math.round(620 * heightScale)
  );
  const largeTabletCardHeight = Math.round(
    Math.min(
      Math.max(
        (largeTabletGridAvailableHeight - largeTabletGridGap * Math.max(categoryRowCount - 1, 0)) /
          Math.max(categoryRowCount, 1),
        180 * heightScale
      ),
      238 * heightScale
    )
  );
  const scrollRef = useRef(null);
  const searchInputRef = useRef(null);
  const contactAssistantScrollRef = useRef(null);
  const contactComposerInputRef = useRef(null);
  const assistantReplyTimersRef = useRef([]);
  const scrollY = useRef(new Animated.Value(0)).current;
  const phoneAnim = useRef(new Animated.Value(0)).current;
  const swipeBackX = useRef(new Animated.Value(0)).current;
  const searchResultsAnim = useRef(new Animated.Value(0)).current;
  const [allContacts, setAllContacts] = useState([]);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState("all");
  const [activeCategorySlug, setActiveCategorySlug] = useState("");
  const [quickResult, setQuickResult] = useState(null);
  const [resultsAnchorY, setResultsAnchorY] = useState(0);
  const [pendingScrollContactId, setPendingScrollContactId] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [assistantLanguage, setAssistantLanguage] = useState("ar");
  const [selectedContactTopic, setSelectedContactTopic] = useState("");
  const [quickQuestionsExpanded, setQuickQuestionsExpanded] = useState(false);
  const [contactAssistantHistory, setContactAssistantHistory] = useState([]);
  const [assistantTypingId, setAssistantTypingId] = useState(null);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [businessModalVisible, setBusinessModalVisible] = useState(false);
  const [businessRequestVisible, setBusinessRequestVisible] = useState(false);
  const [newHotlineName, setNewHotlineName] = useState("");
  const [newHotlinePhone, setNewHotlinePhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [pendingSupportMessage, setPendingSupportMessage] = useState("");
  const [businessRequesterName, setBusinessRequesterName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessNote, setBusinessNote] = useState("");
  const [selectedBusinessPlan, setSelectedBusinessPlan] = useState("Premium");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const focusAnim = useRef(new Animated.Value(0)).current;
  const detailAnim = useRef(new Animated.Value(0)).current;
  const addSheetAnim = useRef(new Animated.Value(0)).current;
  const addSheetDrag = useRef(new Animated.Value(0)).current;
  const hasLoadedContactsRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const lastContactsRefreshRef = useRef(0);
  const detailCategoryPositionsRef = useRef({});
  const [detailGroup, setDetailGroup] = useState("");
  const [detailCategory, setDetailCategory] = useState("");
  const lastDetail = useRef({ group: "", category: "" });
  const [showIntro, setShowIntro] = useState(true);
  const [introLoaded, setIntroLoaded] = useState(true);
  const [suggestHintReady, setSuggestHintReady] = useState(false);
  const [showSuggestHint, setShowSuggestHint] = useState(false);
  const canNavigateBack =
    showIntro ||
    showSuggestHint ||
    businessRequestVisible ||
    businessModalVisible ||
    aboutModalVisible ||
    contactModalVisible ||
    addModalVisible ||
    !!detailGroup ||
    !!activeCategorySlug ||
    !!quickResult;

  const closeDetailView = () => {
    setDetailGroup("");
    setActiveGroup("all");
    setActiveCategorySlug("");
    setDetailCategory("");
    setQuickResult(null);
    setPendingScrollContactId(null);
    lastDetail.current = { group: "", category: "" };
  };

  const navigateBackOneStep = useCallback(() => {
    if (showIntro) {
      setShowIntro(false);
      return true;
    }

    if (showSuggestHint) {
      dismissSuggestHint();
      return true;
    }

    if (businessRequestVisible) {
      setBusinessRequestVisible(false);
      return true;
    }

    if (businessModalVisible) {
      setBusinessModalVisible(false);
      return true;
    }

    if (aboutModalVisible) {
      setAboutModalVisible(false);
      return true;
    }

    if (contactModalVisible) {
      setContactModalVisible(false);
      return true;
    }

    if (addModalVisible) {
      setAddModalVisible(false);
      return true;
    }

    if (detailGroup || activeCategorySlug || quickResult) {
      handleHomePress();
      return true;
    }

    return false;
  }, [
    showIntro,
    showSuggestHint,
    businessRequestVisible,
    businessModalVisible,
    aboutModalVisible,
    contactModalVisible,
    addModalVisible,
    detailGroup,
    activeCategorySlug,
    quickResult
  ]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (e, g) => {
        if (!detailGroup) return false;
        return e.nativeEvent.pageX <= 36 && g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy);
      },
      onMoveShouldSetPanResponder: (e, g) => {
        if (!detailGroup) return false;
        return e.nativeEvent.pageX <= 36 && g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy);
      },
      onPanResponderMove: (_e, g) => {
        if (!detailGroup) return;
        swipeBackX.setValue(Math.max(0, g.dx));
      },
      onPanResponderRelease: (_e, g) => {
        if (!detailGroup) return;
        if (g.dx > swipeThreshold || g.vx > 0.75) {
          Animated.timing(swipeBackX, {
            toValue: screenWidth,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }).start(() => {
            swipeBackX.setValue(0);
            closeDetailView();
          });
          return;
        }

        Animated.spring(swipeBackX, {
          toValue: 0,
          tension: 120,
          friction: 14,
          useNativeDriver: true
        }).start();
      }
    })
  ).current;

  const iosBackSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (e, g) => {
        if (Platform.OS !== "ios" || !canNavigateBack) return false;
        return e.nativeEvent.pageX <= 28 && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy);
      },
      onMoveShouldSetPanResponder: (e, g) => {
        if (Platform.OS !== "ios" || !canNavigateBack) return false;
        return e.nativeEvent.pageX <= 28 && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx > swipeThreshold || g.vx > 0.65) {
          navigateBackOneStep();
        }
      }
    })
  ).current;

  const addSheetResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        addSheetDrag.setValue(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 120 || g.vy > 1.1) {
          Animated.timing(addSheetDrag, {
            toValue: 420,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }).start(() => {
            addSheetDrag.setValue(0);
            setAddModalVisible(false);
          });
          return;
        }

        Animated.spring(addSheetDrag, {
          toValue: 0,
          tension: 120,
          friction: 12,
          useNativeDriver: true
        }).start();
      }
    })
  ).current;

  const loadContacts = useCallback(async ({ seedFromCache = false, silent = false } = {}) => {
    let seededFromLocal = false;

    if (seedFromCache) {
      try {
        const cacheInfo = await FileSystem.getInfoAsync(CONTACTS_CACHE_PATH);
        if (cacheInfo.exists) {
          const rawCache = await FileSystem.readAsStringAsync(CONTACTS_CACHE_PATH);
          const parsedCache = JSON.parse(rawCache);
          if (Array.isArray(parsedCache) && parsedCache.length > 0) {
            setAllContacts(sortContacts(parsedCache));
            setError("");
            seededFromLocal = true;
          }
        }
      } catch {
        // Ignore cache read failures and continue to fallback/network.
      }

      if (!seededFromLocal) {
        setAllContacts(sortContacts(FALLBACK_CONTACTS));
        setError("يتم عرض نسخة محلية من البيانات حالياً.");
      }
    }

    if (!silent && !hasLoadedContactsRef.current) {
      setLoading(false);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${API_BASE_URL}/api/contacts?limit=3000&t=${Date.now()}`, {
        signal: controller.signal,
        headers: {
          "Cache-Control": "no-cache"
        }
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const sorted = sortContacts(data);
        setAllContacts(sorted);
        setError("");
        lastContactsRefreshRef.current = Date.now();
        await FileSystem.writeAsStringAsync(CONTACTS_CACHE_PATH, JSON.stringify(sorted));
      } else if (!seededFromLocal) {
        setError("يتم عرض آخر نسخة محفوظة من البيانات حالياً.");
      }
    } catch {
      if (!seededFromLocal) {
        setError(`تعذر تحميل البيانات من ${API_BASE_URL} - يتم عرض آخر نسخة محفوظة.`);
      }
    } finally {
      clearTimeout(timeoutId);
      hasLoadedContactsRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts({ seedFromCache: true });
  }, [loadContacts]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackgrounded = /inactive|background/.test(appStateRef.current);
      if (wasBackgrounded && nextState === "active") {
        const now = Date.now();
        if (now - lastContactsRefreshRef.current > 10000) {
          loadContacts({ silent: true });
        }
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [loadContacts]);

  useEffect(() => {
    setIntroLoaded(true);
  }, []);

  useEffect(() => {
    async function loadSuggestHintState() {
      try {
        const info = await FileSystem.getInfoAsync(SUGGEST_HINT_PATH);
        setSuggestHintReady(!info.exists);
      } catch {
        setSuggestHintReady(true);
      }
    }
    loadSuggestHintState();
  }, []);

  useEffect(() => {
    if (showIntro && introLoaded) {
      const t = setTimeout(() => setShowIntro(false), 4200);
      return () => clearTimeout(t);
    }
  }, [showIntro, introLoaded]);

  useEffect(() => {
    if (!showIntro && suggestHintReady) {
      setShowSuggestHint(true);
    }
  }, [showIntro, suggestHintReady]);

  useEffect(() => {
    if (contactModalVisible) {
      assistantReplyTimersRef.current.forEach(clearTimeout);
      assistantReplyTimersRef.current = [];
      setSelectedContactTopic("");
      setQuickQuestionsExpanded(false);
      setContactAssistantHistory([]);
      setAssistantTypingId(null);
      setPendingSupportMessage("");
    }
  }, [contactModalVisible]);

  useEffect(() => {
    return () => {
      assistantReplyTimersRef.current.forEach(clearTimeout);
      assistantReplyTimersRef.current = [];
    };
  }, []);

  const nameTerms = useMemo(() => {
    const s = new Set();
    allContacts.forEach((c) => {
      if (c.name_ar) s.add(c.name_ar);
    });
    return [...s];
  }, [allContacts]);

  const predictions = useMemo(() => {
    const q = normalizeText(query);
    const raw = query.trim();
    if ((!q || q.length < 2) && raw.length < 2) return [];

    const byName = allContacts.filter((c) => q && normalizeText(c.name_ar).includes(q));
    const byPhone = allContacts.filter((c) => raw && String(c.phone || "").includes(raw));
    const merged = [...byName, ...byPhone].filter(
      (item, index, arr) => arr.findIndex((entry) => entry.id === item.id) === index
    );

    return sortContacts(merged).slice(0, 5);
  }, [query, allContacts]);

  const typoSuggestion = useMemo(() => {
    const q = normalizeText(query);
    if (!q || q.length < 3 || predictions.length) return "";
    let best = "";
    let score = 999;
    for (const t of nameTerms) {
      const d = levenshtein(q, t);
      if (d < score) {
        score = d;
        best = t;
      }
    }
    return score <= 2 ? best : "";
  }, [query, predictions, nameTerms]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return allContacts.filter((c) => {
      const passGroup = detailGroup ? true : activeGroup === "all" || resolveGroupForCategory(c) === activeGroup;
      const passCategory = detailGroup ? true : !activeCategorySlug || c.category_slug === activeCategorySlug;
      if (!passGroup) return false;
      if (!passCategory) return false;
      if (!q) return true;
      return (
        normalizeText(c.name_ar).includes(q) ||
        normalizeText(c.category_name_ar).includes(q) ||
        String(c.phone || "").includes(query.trim())
      );
    });
  }, [allContacts, query, activeGroup, activeCategorySlug]);

  const getDetailContactsForSlug = (slug) => {
    const q = normalizeText(query);
    return allContacts.filter((c) => {
      if (c.category_slug !== slug) return false;
      if (!q) return true;
      return (
        normalizeText(c.name_ar).includes(q) ||
        normalizeText(c.category_name_ar).includes(q) ||
        String(c.phone || "").includes(query.trim())
      );
    });
  };

  const allCategoryList = useMemo(() => {
    const map = new Map();
    allContacts.forEach((c) => {
      if (!map.has(c.category_slug)) {
        map.set(c.category_slug, {
          slug: c.category_slug,
          name: c.category_name_ar,
          group: resolveGroupForCategory(c)
        });
      }
    });
    const arr = [...map.values()];
    const selectedGroup = detailGroup || activeGroup;
    if (selectedGroup === "all") return arr;
    return arr.filter((c) => c.group === selectedGroup);
  }, [allContacts, activeGroup, detailGroup]);

  const groupedCategories = useMemo(() => {
    const grouped = GROUPS.map((group) => ({ ...group, items: [] }));
    const idx = new Map(grouped.map((group, i) => [group.key, i]));

    allCategoryList.forEach((cat) => {
      const index = idx.get(cat.group);
      if (index !== undefined) grouped[index].items.push(cat);
    });

    grouped.forEach((group) => {
      group.items.sort((a, b) => sortCategoriesForGroup(a, b, group.key));
    });

    return grouped.filter((group) => group.items.length > 0);
  }, [allCategoryList]);

  const selectedGroupKey = detailGroup || activeGroup;
  const focusedGroup = useMemo(() => {
    if (!selectedGroupKey || selectedGroupKey === "all") return null;
    return GROUP_BY_KEY[selectedGroupKey] || null;
  }, [selectedGroupKey]);

  const detailCategoryList = useMemo(() => {
    if (!selectedGroupKey || selectedGroupKey === "all") return [];
    return [...allCategoryList]
      .filter((cat) => cat.group === selectedGroupKey)
      .sort((a, b) => sortCategoriesForGroup(a, b, selectedGroupKey));
  }, [allCategoryList, selectedGroupKey]);

  useEffect(() => {
    if (!query.trim()) setQuickResult(null);
  }, [query]);

  useEffect(() => {
    Animated.spring(focusAnim, {
      toValue: activeGroup === "all" ? 0 : 1,
      useNativeDriver: true,
      tension: 120,
      friction: 12
    }).start();
  }, [activeGroup, focusAnim]);

  useEffect(() => {
    detailAnim.stopAnimation();
    detailAnim.setValue(0);
    if (detailGroup) {
      Animated.spring(detailAnim, {
        toValue: 1,
        speed: 14,
        bounciness: 12,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(detailAnim, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
    }
  }, [detailGroup, detailAnim]);

  useEffect(() => {
    Animated.timing(addSheetAnim, {
      toValue: addModalVisible ? 1 : 0,
      duration: addModalVisible ? 280 : 180,
      easing: addModalVisible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true
    }).start();
    if (addModalVisible) {
      addSheetDrag.setValue(0);
    }
  }, [addModalVisible, addSheetAnim, addSheetDrag]);

  useEffect(() => {
    Animated.timing(searchResultsAnim, {
      toValue: predictions.length ? 1 : 0,
      duration: predictions.length ? 220 : 140,
      easing: predictions.length ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [predictions.length, searchResultsAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phoneAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(phoneAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phoneAnim]);

  const callNumber = async (item) => {
    if (item.is_non_phone) return;
    const url = `tel:${item.phone}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
  };

  const handleIntroContinue = async () => {
    setShowIntro(false);
  };

  const renderContactBadges = (item, compact = false) => {
    const badges = [];
    if (item?.is_featured) badges.push({ key: "featured", label: "Featured", style: styles.featuredBadge, text: styles.featuredBadgeText });
    if (item?.is_verified) badges.push({ key: "verified", label: "Verified", style: styles.verifiedBadge, text: styles.verifiedBadgeText });
    if (!badges.length) return null;
    return (
      <View style={[styles.contactBadgeRow, compact && styles.contactBadgeRowCompact]}>
        {badges.map((badge) => (
          <View key={badge.key} style={[styles.contactBadge, contactBadgeResponsive, badge.style]}>
            <Text style={[styles.contactBadgeText, contactBadgeTextResponsive, badge.text]}>{badge.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const dismissSuggestHint = async () => {
    setShowSuggestHint(false);
    setSuggestHintReady(false);
    try {
      await FileSystem.writeAsStringAsync(SUGGEST_HINT_PATH, "seen");
    } catch {
      // Ignore persistence failure; UI already dismissed.
    }
  };

  const scrollToResults = () => {
    if (resultsAnchorY > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: Math.max(resultsAnchorY - 70, 0), animated: true });
      }, 120);
    }
  };

  const scrollToContactCard = (contactId, localY) => {
    if (!contactId || contactId !== pendingScrollContactId) return;
    const absoluteY = Math.max(resultsAnchorY + localY - 28, 0);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: absoluteY, animated: true });
      setTimeout(() => setPendingScrollContactId(null), 220);
    });
  };

  const renderCategory = ({ item }) => {
    const selected = activeGroup === item.key;
    const iconMeta = ICONS[item.key] || {};
    const palette = GROUP_COLORS[item.key] || { accent: "#5d67e8", card: "rgba(255,255,255,0.22)" };
    const IconComp =
      iconMeta.set === "mci" ? MaterialCommunityIcons : Ionicons;
    return (
      <Animated.View style={{ flex: 1, alignItems: "center", transform: [{ scale: selected ? 1.03 : 1 }] }}>
        <Pressable
          android_ripple={{ color: "rgba(255,255,255,0.24)", borderless: false }}
          style={({ pressed }) => [
            styles.categoryCard,
            categoryCardResponsive,
            {
              shadowColor: palette.accent,
              backgroundColor: selected ? palette.cardActive || palette.card : palette.card,
              borderColor: "rgba(255,255,255,0.28)"
            },
            pressed && [styles.categoryCardPressed, { shadowColor: palette.accent }]
          ]}
          onPress={() => {
            setQuery("");
            setQuickResult(null);
            setActiveCategorySlug("");
            setActiveGroup(item.key);
            setDetailGroup(item.key);
            setDetailCategory("");
            lastDetail.current = { group: item.key, category: "" };
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        >
          <View style={styles.cardContent}>
            <View style={[styles.categoryImageWrap, categoryImageWrapResponsive]}>
              <View style={[styles.categoryBadge, categoryBadgeResponsive]}>
                <View style={[styles.categoryIconWrap, categoryIconWrapResponsive]}>
                  <IconComp name={iconMeta.name || "apps"} size={categoryIconSize} color={iconMeta.color || "#6b7280"} />
                </View>
              </View>
            </View>
            <Text
              numberOfLines={2}
              style={[styles.categoryText, categoryTextResponsive, selected && styles.categoryTextActive]}
            >
              {item.title}
            </Text>
            <Text numberOfLines={2} style={[styles.categoryTextSub, categoryTextSubResponsive]}>
              {GROUP_AR[item.key]}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const handlePredictionPress = (value) => {
    const pickedValue = typeof value === "string" ? value : value?.name_ar || "";
    setQuery(pickedValue);
    const q = normalizeText(pickedValue);
    const rawPhone = typeof value === "object" ? String(value.phone || "").trim() : "";
    const match =
      (typeof value === "object" && value?.id ? allContacts.find((c) => c.id === value.id) : null) ||
      allContacts.find((c) => normalizeText(c.name_ar) === q) ||
      allContacts.find((c) => rawPhone && String(c.phone || "").trim() === rawPhone) ||
      allContacts.find((c) => normalizeText(c.name_ar).includes(q));

    if (match) {
      const matchedSlug = typeof match.category_slug === "string" ? match.category_slug : "";
      const groupKey = resolveGroupForCategory(match);
      setQuickResult(null);
      setActiveGroup(groupKey);
      setDetailGroup(groupKey);
      setActiveCategorySlug(matchedSlug);
      setDetailCategory(matchedSlug);
      setPendingScrollContactId(match.id || null);
      setTimeout(() => {
        scrollToResults();
      }, 180);
    } else {
      setQuickResult(null);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setQuickResult(null);
  };

  const handleSearchIconPress = () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      searchInputRef.current?.focus();
      return;
    }

    if (predictions.length) {
      handlePredictionPress(predictions[0]);
      return;
    }

    if (typoSuggestion) {
      handlePredictionPress(typoSuggestion);
      return;
    }

    searchInputRef.current?.focus();
  };

  const isArabicInput = /[\u0600-\u06FF]/.test(query);

  const handleHomePress = () => {
    clearSearch();
    setActiveGroup("all");
    setActiveCategorySlug("");
    setDetailGroup("");
    setDetailCategory("");
    setQuickResult(null);
    setPendingScrollContactId(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const onPrimaryNavPress = () => {
    setBusinessModalVisible(true);
  };

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", navigateBackOneStep);
    return () => subscription.remove();
  }, [
    navigateBackOneStep
  ]);

  const sendFeedback = async (payload) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 65000);
    try {
      const res = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send");
      }
    } catch (err) {
      if (err?.name === "AbortError" || /Network request failed/i.test(String(err?.message || ""))) {
        throw new Error("Server is taking too long to respond. If you are using Render free tier, wait a few seconds and try again.");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleAddHotlineSubmit = async () => {
    const name = newHotlineName.trim();
    const phone = newHotlinePhone.trim();
    if (!name || !phone) {
      Alert.alert("Missing Data", "Please enter both name and hotline number.");
      return;
    }
    try {
      await sendFeedback({
        type: "add_hotline",
        organization_name: name,
        hotline_number: phone
      });
      setAddModalVisible(false);
      setNewHotlineName("");
      setNewHotlinePhone("");
      Alert.alert("Done", "Your request was sent successfully.");
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to send request.");
    }
  };

  const appendAssistantEntry = ({ userText, topic, answerEn, answerAr, action, actionLabelEn, actionLabelAr }) => {
    const entryId = `${topic?.key || "custom"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setContactAssistantHistory((prev) => [
      ...prev,
      {
        id: entryId,
        topicKey: topic?.key || "",
        userText,
        answerEn: answerEn ?? topic?.answerEn ?? "",
        answerAr: answerAr ?? topic?.answerAr ?? "",
        action: action ?? topic?.action ?? "",
        actionLabelEn: actionLabelEn ?? topic?.actionLabelEn ?? "",
        actionLabelAr: actionLabelAr ?? topic?.actionLabelAr ?? "",
        assistantVisible: false
      }
    ]);
    setAssistantTypingId(entryId);
    const replyTimer = setTimeout(() => {
      setContactAssistantHistory((prev) =>
        prev.map((entry) => (entry.id === entryId ? { ...entry, assistantVisible: true } : entry))
      );
      setAssistantTypingId((current) => (current === entryId ? null : current));
      requestAnimationFrame(() => {
        setTimeout(() => {
          contactAssistantScrollRef.current?.scrollToEnd({ animated: true });
        }, 120);
      });
    }, 480);
    assistantReplyTimersRef.current.push(replyTimer);
    requestAnimationFrame(() => {
      setTimeout(() => {
        contactAssistantScrollRef.current?.scrollToEnd({ animated: true });
      }, 160);
    });
  };

  const handleContactSubmit = async () => {
    const msg = contactMessage.trim();
    if (!msg) {
      Alert.alert("Missing Message", "Please write your suggestion first.");
      return;
    }

    const nameReply = getAssistantNameReply(msg);
    if (nameReply) {
      appendAssistantEntry({
        userText: msg,
        answerEn: nameReply.answerEn,
        answerAr: nameReply.answerAr
      });
      setContactMessage("");
      return;
    }

    const matchedTopic = detectAssistantTopic(msg);
    if (matchedTopic) {
      const customReply = getAssistantReplyForMessage(msg, matchedTopic);
      appendAssistantEntry({
        userText: msg,
        topic: matchedTopic,
        answerEn: customReply?.answerEn,
        answerAr: customReply?.answerAr
      });
      setContactMessage("");
      return;
    }

    setPendingSupportMessage(msg);
    appendAssistantEntry({
      userText: msg,
      answerEn:
        "For more questions and details, you can send your request directly to our team.",
      answerAr:
        "لمزيد من الاستفسارات والمعلومات، يمكنك إرسال طلبك مباشرة إلى فريقنا.",
      action: "send-support",
      actionLabelEn: "Send request",
      actionLabelAr: "إرسال الطلب"
    });
    setContactMessage("");
  };

  const handleDirectContactSubmit = async () => {
    const msg = contactMessage.trim();
    if (!msg) {
      Alert.alert("Missing Message", "Please write your message first.");
      return;
    }

    try {
      await sendFeedback({
        type: "suggestion",
        message: msg
      });
      appendAssistantEntry({
        userText: msg,
        answerEn: "Your message was sent directly to our team successfully.",
        answerAr: "تم إرسال رسالتك مباشرة إلى فريقنا بنجاح.",
        action: "focus-message",
        actionLabelEn: "Write another message",
        actionLabelAr: "اكتب رسالة أخرى"
      });
      setPendingSupportMessage("");
      setContactMessage("");
    } catch {
      appendAssistantEntry({
        userText: msg,
        answerEn:
          "The support server is taking longer than usual right now. Because we use a free backend, please wait a few seconds and try sending again.",
        answerAr:
          "خادم الدعم يتأخر الآن أكثر من المعتاد. لأننا نستخدم خادمًا مجانيًا، انتظر بضع ثوانٍ ثم حاول الإرسال مرة أخرى.",
        action: "send-support",
        actionLabelEn: "Try again",
        actionLabelAr: "حاول مرة أخرى"
      });
      setPendingSupportMessage(msg);
      setContactMessage("");
    }
  };

  const handleContactAssistantAction = (action) => {
    if (action === "send-support") {
      const msg = pendingSupportMessage.trim();
      if (!msg) {
        requestAnimationFrame(() => {
          contactAssistantScrollRef.current?.scrollToEnd({ animated: true });
          setTimeout(() => {
            contactComposerInputRef.current?.focus();
          }, 220);
        });
        return;
      }

      sendFeedback({
        type: "suggestion",
        message: msg
      })
        .then(() => {
          appendAssistantEntry({
            userText: assistantLanguage === "ar" ? "إرسال الطلب" : "Send request",
            answerEn: "Thanks, your message was sent to our team successfully.",
            answerAr: "شكرًا، تم إرسال رسالتك إلى فريقنا بنجاح.",
            action: "focus-message",
            actionLabelEn: "Write another message",
            actionLabelAr: "اكتب رسالة أخرى"
          });
          setPendingSupportMessage("");
        })
        .catch(() => {
          appendAssistantEntry({
            userText: assistantLanguage === "ar" ? "إرسال الطلب" : "Send request",
            answerEn:
              "The support server is taking longer than usual right now. Since we are using a free backend, please wait a few seconds and try again.",
            answerAr:
              "خادم الدعم يتأخر الآن أكثر من المعتاد. لأننا نستخدم خادمًا مجانيًا، انتظر بضع ثوانٍ ثم حاول مرة أخرى.",
            action: "send-support",
            actionLabelEn: "Try again",
            actionLabelAr: "حاول مرة أخرى"
          });
        });
      return;
    }

    if (action === "focus-message") {
      requestAnimationFrame(() => {
        contactAssistantScrollRef.current?.scrollToEnd({ animated: true });
        setTimeout(() => {
          contactComposerInputRef.current?.focus();
        }, 220);
      });
      return;
    }

    if (action === "add-number") {
      setContactModalVisible(false);
      setSelectedContactTopic("");
      setAddModalVisible(true);
      return;
    }

    if (action === "promote") {
      setContactModalVisible(false);
      setSelectedContactTopic("");
      setBusinessModalVisible(true);
      return;
    }
  };

  const handleContactTopicPress = (topic) => {
    setSelectedContactTopic((prev) => (prev === topic.key ? "" : topic.key));
  };

  const openBusinessInquiry = (plan = "Premium") => {
    setBusinessModalVisible(false);
    setSelectedBusinessPlan(plan);
    setBusinessNote(
      `Hello, I’m interested in the ${plan} business plan for my listing.\n\nمرحباً، أنا مهتم بباقة ${plan} لنشاطي داخل التطبيق وأريد معرفة التفاصيل.`
    );
    setBusinessRequestVisible(true);
  };

  const handleBusinessRequestSubmit = async () => {
    const requesterName = businessRequesterName.trim();
    const shopName = businessName.trim();
    const phone = businessPhone.trim();
    const note = businessNote.trim();
    const phoneDigits = phone.replace(/[^\d+]/g, "");

    if (!requesterName || !shopName || !phone) {
      Alert.alert("Missing Data", "Please enter your name, business name, and phone or WhatsApp number.");
      return;
    }

    if (phoneDigits.length < 7) {
      Alert.alert("Invalid Contact", "Please enter a valid phone or WhatsApp number so we can contact you.");
      return;
    }

    try {
      await sendFeedback({
        type: "business_inquiry",
        requester_name: requesterName,
        business_name: shopName,
        contact_phone: phone,
        plan: selectedBusinessPlan,
        message: note
      });
      setBusinessRequestVisible(false);
      setBusinessRequesterName("");
      setBusinessName("");
      setBusinessPhone("");
      setBusinessNote("");
      Alert.alert("Done", "Your business request was sent successfully.");
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to send business request.");
    }
  };

  const heroResponsive = {
    alignSelf: "center",
    width: "100%",
    maxWidth: heroContentWidth,
    paddingTop: Math.round((isLargeTablet ? 22 : isTablet ? 18 : isAndroid ? 20 : 26) * heightScale),
    paddingBottom: Math.round((isLargeTablet ? 22 : isTablet ? 18 : isAndroid ? 18 : 26) * heightScale),
    borderBottomLeftRadius: Math.round((isLargeTablet ? 34 : isTablet ? 30 : 36) * uiScale),
    borderBottomRightRadius: Math.round((isLargeTablet ? 34 : isTablet ? 30 : 36) * uiScale)
  };

  const heroAnimatedStyle = {
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [0, 120],
          outputRange: [0, -42],
          extrapolate: "clamp"
        })
      }
    ],
    paddingTop: Animated.add(
      new Animated.Value(Math.round((isLargeTablet ? 22 : isTablet ? 18 : isAndroid ? 20 : 26) * heightScale)),
      scrollY.interpolate({
        inputRange: [0, 120],
        outputRange: [0, Math.round((isLargeTablet ? -12 : isTablet ? -10 : -12) * heightScale)],
        extrapolate: "clamp"
      })
    ),
    paddingBottom: Animated.add(
      new Animated.Value(Math.round((isLargeTablet ? 22 : isTablet ? 18 : isAndroid ? 18 : 26) * heightScale)),
      scrollY.interpolate({
        inputRange: [0, 120],
        outputRange: [0, Math.round((isLargeTablet ? -14 : isTablet ? -12 : -16) * heightScale)],
        extrapolate: "clamp"
      })
    )
  };

  const welcomeTitleResponsive = {
    fontSize: Math.round((isLargeTablet ? 28 : isTablet ? 24 : isAndroid ? 34 : 38) * uiScale)
  };

  const welcomeSubResponsive = {
    fontSize: Math.round((isLargeTablet ? 18 : isTablet ? 16 : isAndroid ? 22 : 24) * uiScale)
  };

  const searchBarResponsive = {
    minHeight: Math.round((isLargeTablet ? 62 : isTablet ? 56 : isAndroid ? 58 : 64) * heightScale),
    borderRadius: Math.round((isLargeTablet ? 24 : isTablet ? 22 : 26) * uiScale),
    paddingHorizontal: Math.round((isLargeTablet ? 18 : 16) * widthScale)
  };

  const searchShellAnimatedStyle = {
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [0, 140],
          outputRange: [0, -18],
          extrapolate: "clamp"
        })
      },
      {
        scale: scrollY.interpolate({
          inputRange: [0, 140],
          outputRange: [1, 0.88],
          extrapolate: "clamp"
        })
      }
    ]
  };

  const searchInputResponsive = {
    fontSize: Math.round((isLargeTablet ? 17 : isTablet ? 15 : 17) * uiScale)
  };

  const searchIconBadgeResponsive = {
    width: Math.round((isLargeTablet ? 40 : isTablet ? 36 : 40) * uiScale),
    height: Math.round((isLargeTablet ? 40 : isTablet ? 36 : 40) * uiScale),
    borderRadius: Math.round((isLargeTablet ? 20 : isTablet ? 18 : 20) * uiScale)
  };

  const searchIconTextResponsive = {
    fontSize: Math.round((isLargeTablet ? 20 : isTablet ? 18 : 20) * uiScale)
  };

  const suggestItemResponsive = {
    paddingHorizontal: Math.round(12 * widthScale),
    paddingVertical: Math.round(10 * heightScale)
  };

  const suggestTextResponsive = {
    fontSize: Math.round((isTablet ? 14 : 15) * uiScale)
  };

  const contactBadgeResponsive = {
    paddingHorizontal: Math.round(8 * widthScale),
    paddingVertical: Math.round(3 * heightScale)
  };

  const contactBadgeTextResponsive = {
    fontSize: Math.round((isTablet ? 10 : 10.5) * uiScale)
  };

  const suggestCategoryPreviewResponsive = {
    fontSize: Math.round((isTablet ? 11 : 11.5) * uiScale)
  };

  const suggestPhoneBadgeResponsive = {
    paddingHorizontal: Math.round(11 * widthScale),
    paddingVertical: Math.round(6 * heightScale),
    borderRadius: Math.round(12 * uiScale)
  };

  const suggestPhonePreviewResponsive = {
    fontSize: Math.round((isTablet ? 14 : 15) * uiScale)
  };

  const contentResponsive = {
    alignItems: "center",
    paddingTop: Math.round((isLargeTablet ? 22 : isTablet ? 18 : 14) * heightScale),
    paddingBottom:
      Math.round((isLargeTablet ? 116 : isTablet ? 108 : isAndroid ? 96 : 116) * heightScale) +
      androidBottomSafeOffset +
      (isTablet ? 14 : 8)
  };

  const fullWidthCard = {
    width: "100%",
    maxWidth: bodyContentWidth,
    alignSelf: "center"
  };

  const gridWrapperResponsive = {
    width: "100%",
    maxWidth: bodyContentWidth,
    alignSelf: "center",
    paddingHorizontal: isLargeTablet ? Math.round(8 * widthScale) : isTablet ? Math.round(4 * widthScale) : 0
  };

  const gridRowResponsive = {
    columnGap: isLargeTablet ? Math.round(22 * widthScale) : Math.round(16 * widthScale),
    marginBottom: isLargeTablet ? largeTabletGridGap : Math.round(18 * heightScale)
  };

  const bottomBarResponsive = isTablet
    ? {
        left: undefined,
        right: undefined,
        width: Math.min(screenWidth - contentHorizontalInset * 2, isLargeTablet ? 760 : 680),
        alignSelf: "center",
        bottom: Math.round((isLargeTablet ? 20 : 16) * heightScale) + androidBottomSafeOffset,
        height: Math.round((isLargeTablet ? 94 : 86) * heightScale),
        paddingBottom: Math.round((isLargeTablet ? 10 : 8) * heightScale),
        paddingTop: Math.round((isLargeTablet ? 10 : 8) * heightScale),
        borderRadius: Math.round((isLargeTablet ? 30 : 28) * uiScale)
      }
    : isAndroid
      ? {
          left: Math.round(10 * widthScale),
          right: Math.round(10 * widthScale),
          bottom: Math.round(8 * heightScale) + androidBottomSafeOffset,
          height: Math.round(92 * heightScale),
          paddingBottom: Math.round(8 * heightScale),
          paddingTop: Math.round(8 * heightScale),
          borderRadius: Math.round(22 * uiScale)
        }
      : {};

  const bottomSideVisualSlotResponsive = {
    width: Math.round((isLargeTablet ? 66 : isTablet ? 60 : 72) * widthScale),
    height: Math.round((isLargeTablet ? 56 : isTablet ? 52 : 64) * heightScale),
    marginBottom: Math.round((isLargeTablet ? 6 : isTablet ? 4 : isAndroid ? 6 : 8) * heightScale)
  };

  const businessPlanVisualSlotResponsive = {
    marginTop: Math.round((isTablet ? 4 : isAndroid ? 5 : 0) * heightScale)
  };

  const bottomTextResponsive = {
    fontSize: Math.round((isLargeTablet ? 12.5 : isTablet ? 11.5 : 13.5) * uiScale),
    marginTop: Math.round((isLargeTablet ? 2 : isTablet ? 1 : isAndroid ? 1 : -2) * heightScale),
    textAlign: "center",
    paddingHorizontal: Math.round((isTablet ? 6 : 4) * widthScale),
    lineHeight: Math.round((isLargeTablet ? 14 : isTablet ? 13 : 15) * uiScale)
  };

  const bottomSideTextResponsive = {
    marginTop: Math.round((isTablet ? -1 : isAndroid ? -1 : -6) * heightScale)
  };

  const bottomSubTextResponsive = {
    fontSize: Math.round((isTablet ? 9 : 10) * uiScale),
    marginTop: 0,
    color: isTablet ? "#ffd7f3" : "#ffd0f0"
  };

  const businessPlanItemResponsive = {
    paddingTop: Math.round((isTablet ? 2 : 4) * heightScale)
  };

  const bottomCenterBadgeResponsive = {
    width: Math.round((isTablet ? 52 : isAndroid ? 58 : 64) * uiScale),
    height: Math.round((isTablet ? 52 : isAndroid ? 58 : 64) * uiScale),
    borderRadius: Math.round((isTablet ? 26 : isAndroid ? 29 : 32) * uiScale),
    marginTop: Math.round((isTablet ? 0 : isAndroid ? -8 : -4) * heightScale)
  };

  const bottomCenterBadgeShadowResponsive = {
    width: Math.round((isTablet ? 60 : isAndroid ? 66 : 74) * uiScale),
    height: Math.round((isTablet ? 60 : isAndroid ? 66 : 74) * uiScale),
    borderRadius: Math.round((isTablet ? 30 : isAndroid ? 33 : 37) * uiScale),
    top: Math.round((isTablet ? -3 : isAndroid ? -6 : -7) * heightScale)
  };

  const bottomCenterTextResponsive = {
    fontSize: Math.round((isTablet ? 10.5 : 12.5) * uiScale),
    marginTop: Math.round((isTablet ? 2 : isAndroid ? 2 : 4) * heightScale),
    textAlign: "center",
    paddingHorizontal: Math.round(6 * widthScale),
    lineHeight: Math.round((isTablet ? 12 : 14) * uiScale)
  };

  const bottomCenterSubTextResponsive = {
    fontSize: Math.round((isTablet ? 8.5 : 9.5) * uiScale),
    marginTop: Math.round((isTablet ? 0 : 1) * heightScale),
    textAlign: "center",
    color: isTablet ? "#ffd7f3" : "#ffd0f0"
  };

  const categoryCardResponsive = {
    height: isLargeTablet ? largeTabletCardHeight : Math.round((isTablet ? 148 : isAndroid ? 146 : 156) * heightScale),
    paddingVertical: Math.round((isLargeTablet ? 18 : isTablet ? 13 : 12) * heightScale),
    borderRadius: Math.round((isTablet ? 22 : 26) * uiScale),
    paddingHorizontal: Math.round((isLargeTablet ? 14 : isTablet ? 10 : 12) * widthScale),
    marginBottom: isLargeTablet ? 0 : Math.round((isTablet ? 4 : 6) * heightScale)
  };

  const categoryBadgeResponsive = {
    width: Math.round((isLargeTablet ? 90 : isTablet ? 74 : 80) * uiScale),
    height: Math.round((isLargeTablet ? 90 : isTablet ? 74 : 80) * uiScale),
    borderRadius: Math.round((isLargeTablet ? 22 : isTablet ? 20 : 22) * uiScale)
  };

  const categoryImageWrapResponsive = {
    width: Math.round((isLargeTablet ? 98 : isTablet ? 78 : 88) * uiScale),
    height: Math.round((isLargeTablet ? 98 : isTablet ? 78 : 88) * uiScale),
    marginBottom: Math.round((isLargeTablet ? 8 : 4) * heightScale)
  };

  const categoryIconWrapResponsive = {
    width: Math.round((isLargeTablet ? 68 : 52) * uiScale),
    height: Math.round((isLargeTablet ? 68 : 52) * uiScale)
  };

  const categoryTextResponsive = {
    fontSize: Math.round((isLargeTablet ? 18 : isTablet ? 14 : 15) * uiScale),
    minHeight: Math.round((isLargeTablet ? 34 : isTablet ? 26 : 28) * heightScale)
  };

  const categoryTextSubResponsive = {
    fontSize: Math.round((isLargeTablet ? 13 : isTablet ? 11 : 12) * uiScale),
    lineHeight: Math.round((isLargeTablet ? 17 : isTablet ? 14 : 16) * uiScale),
    minHeight: Math.round((isLargeTablet ? 26 : isTablet ? 18 : 22) * heightScale)
  };

  const detailPageResponsive = {
    width: "100%",
    maxWidth: bodyContentWidth,
    alignSelf: "center",
    marginTop: Math.round((isTablet ? 4 : 8) * heightScale),
    padding: Math.round((isTablet ? 14 : 16) * uiScale)
  };

  const detailOpenListResponsive = {
    maxHeight: Math.round((isTablet ? screenHeight * 0.44 : screenHeight * 0.4)),
    marginTop: Math.round((isTablet ? 8 : 6) * heightScale)
  };

  const introBrandWrapResponsive = {
    top: Math.round((isTablet ? 32 : 60) * heightScale),
    left: Math.round((isTablet ? 40 : 24) * widthScale),
    right: Math.round((isTablet ? 40 : 24) * widthScale),
    alignItems: isTablet ? "center" : "flex-start"
  };

  const introBrandTitleResponsive = {
    fontSize: Math.round((isTablet ? 24 : 28) * uiScale),
    textAlign: isTablet ? "center" : "left"
  };

  const introBrandSubResponsive = {
    fontSize: Math.round((isTablet ? 13 : 14) * uiScale),
    maxWidth: isTablet ? 320 : 250,
    textAlign: isTablet ? "center" : "left"
  };

  const showIntroBrandOverlay = isTablet;

  const introResizeMode = "stretch";

  const introImageResponsive =
    {
      position: "absolute",
      alignSelf: "stretch",
      width: screenWidth,
      height: screenHeight,
      borderRadius: 0,
      overflow: "hidden"
    };

  const introTintResponsive = {
    backgroundColor: isTablet ? "rgba(34, 0, 48, 0.12)" : "rgba(34, 0, 48, 0.22)"
  };

  const hintOverlayResponsive = {
    paddingBottom: Math.round((isTablet ? 96 : 138) * heightScale),
    paddingHorizontal: Math.round((isTablet ? 20 : 24) * widthScale)
  };

  const hintCardResponsive = {
    maxWidth: isTablet ? 330 : 340,
    paddingHorizontal: Math.round((isTablet ? 16 : 18) * widthScale),
    paddingTop: Math.round((isTablet ? 14 : 16) * heightScale),
    paddingBottom: Math.round((isTablet ? 12 : 14) * heightScale)
  };

  const bottomCenterVisualSlotResponsive = null;

  return (
    <SafeAreaView style={styles.container}>
      {Platform.OS === "ios" && canNavigateBack ? (
        <View style={styles.iosBackSwipeEdge} {...iosBackSwipeResponder.panHandlers} />
      ) : null}
      <StatusBar style="light" />
      {!showIntro ? <View style={styles.appGlowTop} pointerEvents="none" /> : null}
      {!showIntro ? <View style={styles.appGlowBottom} pointerEvents="none" /> : null}
      {!showIntro ? <View style={styles.appGlowMid} pointerEvents="none" /> : null}

      <Animated.View style={[styles.hero, heroResponsive, heroAnimatedStyle, showIntro && styles.screenHidden]}>
        <View style={styles.heroBlob1} />
        <View style={styles.heroBlob2} />
        <View style={styles.welcomeRow}>
          <Animated.View
            style={[
              styles.phoneIconWrap,
              {
                transform: [
                  {
                    translateY: phoneAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -6]
                    })
                  },
                  {
                    rotate: phoneAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["-4deg", "4deg"]
                    })
                  },
                  {
                    scale: phoneAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.08]
                    })
                  }
                ]
              }
            ]}
          >
            <Ionicons name="phone-portrait" size={heroIconSize} color="#fff" />
          </Animated.View>
          <View style={styles.welcomeTextWrap}>
            <Text style={[styles.welcomeTitle, welcomeTitleResponsive]}>Welcome to</Text>
            <Text style={[styles.welcomeSub, welcomeSubResponsive]}>Hotline app</Text>
          </View>
          {detailGroup ? (
            <Pressable style={styles.heroBackBtn} onPress={closeDetailView}>
              <Text style={styles.heroBackText}>Back</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.heroInfoBtn} onPress={() => setAboutModalVisible(true)}>
              <Ionicons name="information-circle" size={heroInfoIconSize} color="#ffffff" />
            </Pressable>
          )}
        </View>

        <Animated.View style={[styles.searchShell, searchShellAnimatedStyle]}>
          <View style={[styles.searchBar, searchBarResponsive]}>
          {query.trim() && isArabicInput ? (
            <TouchableOpacity style={[styles.clearSearchBtn, styles.clearSearchBtnLeft]} onPress={clearSearch}>
              <Text style={styles.clearSearchText}>×</Text>
            </TouchableOpacity>
          ) : null}
          <TextInput
            ref={searchInputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search hotline"
            placeholderTextColor="#8b8b8b"
            style={[styles.searchInput, searchInputResponsive]}
          />
          {query.trim() && !isArabicInput ? (
            <TouchableOpacity style={[styles.clearSearchBtn, styles.clearSearchBtnRight]} onPress={clearSearch}>
              <Text style={styles.clearSearchText}>×</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.searchIconBadge, searchIconBadgeResponsive]} onPress={handleSearchIconPress} activeOpacity={0.85}>
            <Text style={[styles.searchIcon, searchIconTextResponsive]}>🔎</Text>
          </TouchableOpacity>
          </View>
          <Text style={styles.searchCaption}>Search by name or hotline number</Text>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, contentResponsive]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        style={showIntro ? styles.screenHidden : null}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false
        })}
      >
        {predictions.length ? (
          <Animated.View
            style={{
              transform: [
                {
                  translateY: searchResultsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0]
                  })
                }
              ],
              opacity: searchResultsAnim
            }}
          >
          <View style={[styles.suggestBox, fullWidthCard]}>
            {predictions.map((p) => (
              <TouchableOpacity key={p.id} style={[styles.suggestItem, suggestItemResponsive]} onPress={() => handlePredictionPress(p)}>
                <View style={styles.suggestMeta}>
                  <Text style={[styles.suggestText, suggestTextResponsive]}>{p.name_ar}</Text>
                  {renderContactBadges(p, true)}
                  <Text style={[styles.suggestCategoryPreview, suggestCategoryPreviewResponsive]}>{p.category_name_ar}</Text>
                  <View style={styles.suggestBottomRow}>
                    <TouchableOpacity style={[styles.suggestPhoneBadge, suggestPhoneBadgeResponsive]} onPress={() => callNumber(p)} disabled={!!p.is_non_phone}>
                      <Text style={[styles.suggestPhonePreview, suggestPhonePreviewResponsive]}>{p.phone || "--"}</Text>
                    </TouchableOpacity>
                    <Text style={styles.suggestHint}>Tap to view</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          </Animated.View>
        ) : null}

        {!predictions.length && typoSuggestion ? (
          <TouchableOpacity style={[styles.typoBox, fullWidthCard]} onPress={() => handlePredictionPress(typoSuggestion)}>
            <Text style={styles.typoText}>Did you mean: {typoSuggestion} ?</Text>
          </TouchableOpacity>
        ) : null}

        {quickResult ? (
          <View style={[styles.quickResultCard, fullWidthCard]}>
            <Text style={styles.quickResultTitle}>{quickResult.name_ar}</Text>
            {renderContactBadges(quickResult)}
            <Text style={styles.quickResultSub}>{quickResult.category_name_ar}</Text>
            {quickResult.is_non_phone ? (
              <Text style={styles.nonPhone}>غير هاتفي / عبر التطبيق</Text>
            ) : (
              <View style={styles.quickActionRow}>
                <TouchableOpacity style={[styles.callBtn, styles.quickActionBtn]} onPress={() => callNumber(quickResult)}>
                  <Text style={styles.callBtnText}>{quickResult.phone}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        {!detailGroup ? (
          <FlatList
            key={`grid-${categoryColumns}`}
            data={GROUPS}
            renderItem={renderCategory}
            keyExtractor={(item) => item.key}
            numColumns={categoryColumns}
            scrollEnabled={false}
            columnWrapperStyle={categoryColumns > 1 ? [styles.gridRow, gridRowResponsive] : undefined}
            style={gridWrapperResponsive}
          />
        ) : null}

        {detailGroup && focusedGroup ? (
          <Animated.View
            style={[
              styles.detailPage,
              detailPageResponsive,
              {
                transform: [
                  {
                    translateX: Animated.add(
                      detailAnim.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }),
                      swipeBackX
                    )
                  },
                  { scale: detailAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.03] }) }
                ],
                opacity: detailAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
              }
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.focusedHeader}>
              <Text style={styles.focusedIcon}>{focusedGroup.icon}</Text>
              <Text style={styles.focusedTitle} numberOfLines={1} ellipsizeMode="tail">
                {focusedGroup.title} / {GROUP_AR[focusedGroup.key]}
              </Text>
            </View>

            <View style={styles.detailList}>
              <View style={styles.detailAnchor} onLayout={(e) => setResultsAnchorY(e.nativeEvent.layout.y)} />
              {(() => {
                const groupItems = detailCategoryList;
                if (loading) {
                  return <ActivityIndicator size="large" color="#5d67e8" style={styles.loader} />;
                }
                if (!groupItems.length) {
                  return <Text style={styles.error}>لا توجد بيانات متاحة لهذه الفئة حالياً.</Text>;
                }
                return groupItems.map((cat) => {
                  const opened = detailCategory === cat.slug;
                  return (
                    <View
                      key={cat.slug}
                      style={styles.subCard}
                      onLayout={(e) => {
                        detailCategoryPositionsRef.current[cat.slug] = e.nativeEvent.layout.y;
                      }}
                    >
                      <Pressable
                        style={({ pressed }) => [styles.subHeader, pressed && { opacity: 0.85 }]}
                        onPress={() => {
                          const nextCategory = opened ? "" : cat.slug;
                          setDetailCategory(nextCategory);
                          if (nextCategory) {
                            requestAnimationFrame(() => {
                              const localY = detailCategoryPositionsRef.current[nextCategory] || 0;
                              scrollRef.current?.scrollTo({
                                y: Math.max(resultsAnchorY + localY - 18, 0),
                                animated: true
                              });
                            });
                          }
                        }}
                      >
                        <Text style={styles.subTitle} numberOfLines={1} ellipsizeMode="tail">
                          {cat.name}
                        </Text>
                        <Text style={styles.subToggle}>{opened ? "▲" : "▼"}</Text>
                      </Pressable>
                      {opened ? (
                        <ScrollView
                          style={[styles.detailOpenList, detailOpenListResponsive]}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                          keyboardShouldPersistTaps="handled"
                        >
                          {getDetailContactsForSlug(cat.slug)
                            .map((item) => {
                              const palette = GROUP_COLORS[cat.group] || { accent: "#ff3b81", card: "#ffffffee" };
                              lastDetail.current = { group: focusedGroup.key, category: cat.slug };
                              return (
                                <View
                                  key={item.id}
                                  onLayout={(e) => scrollToContactCard(item.id, e.nativeEvent.layout.y)}
                                  style={[
                                    styles.hotlineCard,
                                    {
                                      backgroundColor: item.is_featured ? palette.cardActive || palette.card : palette.card,
                                      shadowColor: palette.accent,
                                      borderColor: item.is_featured ? `${palette.accent}55` : "rgba(255,255,255,0.55)"
                                    },
                                    item.is_featured && styles.hotlineCardFeatured
                                  ]}
                                >
                                  <View style={styles.hotlineBody}>
                                    <Text style={styles.hotlineName}>{item.name_ar}</Text>
                                    {renderContactBadges(item)}
                                    <Text style={styles.hotlineSub}>{item.category_name_ar}</Text>
                                    {item.is_non_phone ? (
                                      <Text style={styles.nonPhone}>غير هاتفي / عبر التطبيق</Text>
                                    ) : (
                                      <View style={styles.contactActionRow}>
                                        <Pressable
                                          style={({ pressed }) => [
                                            styles.callBtn,
                                            styles.contactActionBtn,
                                            { backgroundColor: palette.accent },
                                            pressed && styles.callBtnPressed
                                          ]}
                                          android_ripple={{ color: "rgba(255,255,255,0.25)", borderless: true }}
                                          onPress={() => callNumber(item)}
                                        >
                                          <Text style={styles.callBtnText}>{item.phone}</Text>
                                        </Pressable>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              );
                            })}
                        </ScrollView>
                      ) : null}
                    </View>
                  );
                });
              })()}
            </View>
          </Animated.View>
        ) : null}
      </Animated.ScrollView>

      {!showIntro ? (
        <View style={[styles.bottomBarShell, bottomBarResponsive]} pointerEvents="box-none">
          <LinearGradient colors={["#6c47f5", "#b30f7f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bottomBar}>
            <TouchableOpacity style={[styles.bottomItem, businessPlanItemResponsive]} onPress={onPrimaryNavPress}>
              <View style={[styles.bottomVisualSlot, styles.bottomSideVisualSlot, bottomSideVisualSlotResponsive, businessPlanVisualSlotResponsive]}>
                <Ionicons name="rocket-outline" size={bottomSideIconSize} color="#ffffff" />
              </View>
              <Text style={[styles.bottomText, styles.bottomSideText, bottomTextResponsive, bottomSideTextResponsive]}>
                Promote
              </Text>
            </TouchableOpacity>
            <View style={styles.bottomCenterSpacer} />
            <TouchableOpacity style={styles.bottomItem} onPress={() => setAddModalVisible(true)}>
              <View style={[styles.bottomVisualSlot, styles.bottomSideVisualSlot, bottomSideVisualSlotResponsive]}>
                <Ionicons name="add-circle-outline" size={bottomSideIconSize} color="#ffffff" />
              </View>
              <Text style={[styles.bottomText, styles.bottomSideText, bottomTextResponsive, bottomSideTextResponsive]}>
                Add Number
              </Text>
            </TouchableOpacity>
          </LinearGradient>

          <TouchableOpacity style={[styles.bottomCenterFloating, styles.bottomCenterItem]} onPress={() => setContactModalVisible(true)}>
            <View style={styles.bottomVisualSlot}>
              <View style={[styles.bottomCenterBadge, bottomCenterBadgeResponsive]}>
                <Ionicons name="phone-portrait" size={bottomCenterIconSize + 1} color="#9a0f6f" />
                <View style={styles.bottomAssistantSparkles}>
                  <Ionicons name="sparkles" size={11} color="#ffffff" />
                </View>
              </View>
            </View>
            <Text style={[styles.bottomCenterText, bottomCenterTextResponsive]}>Contact us</Text>
            <Text style={[styles.bottomCenterSubText, bottomCenterSubTextResponsive]}>AI assistant</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal transparent visible={addModalVisible} animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={[styles.modalBackdrop, styles.sheetBackdrop]} onPress={() => setAddModalVisible(false)}>
            <Animated.View
              {...addSheetResponder.panHandlers}
              style={[
                styles.sheetCard,
                {
                  transform: [
                    {
                      translateY: Animated.add(
                        addSheetAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [420, 0]
                        }),
                        addSheetDrag
                      )
                    }
                  ],
                  opacity: addSheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1]
                  })
                }
              ]}
            >
              <Pressable onPress={() => {}}>
                <View style={styles.sheetHandle} />
                <View style={[styles.modalCard, styles.suggestCard, styles.sheetInner]}>
                  <View style={styles.sheetGlow} />
                  <View style={styles.sheetGlowSecondary} />
                  <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setAddModalVisible(false)}>
                    <Ionicons name="close" size={20} color="#7a4766" />
                  </TouchableOpacity>
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <View style={styles.suggestHero}>
                      <View style={styles.suggestHeroBadge}>
                        <Ionicons name="sparkles" size={22} color="#9a0f6f" />
                      </View>
                      <Text style={styles.modalTitle}>Suggest A Number</Text>
                      <Text style={styles.modalSubTitle}>Send a new hotline / أرسل رقمًا جديدًا وسنراجعه.</Text>
                    </View>
                    <TextInput
                      style={[styles.modalInput, styles.suggestInput]}
                      placeholder="Place or organization / المكان أو الجهة"
                      placeholderTextColor="#7b8799"
                      value={newHotlineName}
                      onChangeText={setNewHotlineName}
                    />
                    <TextInput
                      style={[styles.modalInput, styles.suggestInput]}
                      placeholder="Phone or hotline number / رقم الهاتف أو الخط الساخن"
                      placeholderTextColor="#7b8799"
                      keyboardType="phone-pad"
                      value={newHotlinePhone}
                      onChangeText={setNewHotlinePhone}
                    />
                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleAddHotlineSubmit}>
                        <Text style={styles.modalBtnPrimaryText}>Send</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </Pressable>
            </Animated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal transparent visible={contactModalVisible} animationType="fade" onRequestClose={() => setContactModalVisible(false)}>
        <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.suggestCard, styles.contactCard]}>
              <View style={styles.sheetGlow} />
              <View style={styles.sheetGlowSecondary} />
              <ScrollView
                ref={contactAssistantScrollRef}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.suggestHero}>
                  <View style={[styles.suggestHeroBadge, styles.contactHeroBadge]}>
                    <Ionicons name="phone-portrait" size={20} color="#9a0f6f" />
                    <View style={styles.contactHeroSparkles}>
                      <Ionicons name="sparkles" size={10} color="#ffffff" />
                    </View>
                  </View>
                  <Text style={styles.modalTitle}>Contact us (AI assistant)</Text>
                  <Text style={styles.modalSubTitle}>Quick answers, helpful prompts, and direct support in one place.</Text>
                </View>

                <View style={styles.assistantLanguageRow}>
                  <TouchableOpacity
                    style={[
                      styles.assistantLanguageBtn,
                      assistantLanguage === "ar" && styles.assistantLanguageBtnActive
                    ]}
                    onPress={() => setAssistantLanguage("ar")}
                  >
                    <Text
                      style={[
                        styles.assistantLanguageText,
                        assistantLanguage === "ar" && styles.assistantLanguageTextActive
                      ]}
                    >
                      العربية
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.assistantLanguageBtn,
                      assistantLanguage === "en" && styles.assistantLanguageBtnActive
                    ]}
                    onPress={() => setAssistantLanguage("en")}
                  >
                    <Text
                      style={[
                        styles.assistantLanguageText,
                        assistantLanguage === "en" && styles.assistantLanguageTextActive
                      ]}
                    >
                      English
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.quickQuestionsToggle}
                  onPress={() => {
                    setQuickQuestionsExpanded((prev) => {
                      const next = !prev;
                      if (!next) setSelectedContactTopic("");
                      return next;
                    });
                  }}
                  activeOpacity={0.86}
                >
                  <View style={styles.quickQuestionsToggleTextWrap}>
                    <Text style={styles.assistantSectionTitle}>
                      {assistantLanguage === "ar" ? "أسئلة سريعة" : "Quick questions"}
                    </Text>
                    <Text style={styles.assistantSectionSub}>
                      {assistantLanguage === "ar"
                        ? "اختصارات مفيدة لو تحب تبدأ بسرعة"
                        : "Useful shortcuts if you want a fast start"}
                    </Text>
                  </View>
                  <Ionicons
                    name={quickQuestionsExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#9a0f6f"
                  />
                </TouchableOpacity>

                {quickQuestionsExpanded ? (
                  <View style={styles.chatQuickRow}>
                    {CONTACT_ASSISTANT_TOPICS.filter((topic) =>
                      CONTACT_ASSISTANT_VISIBLE_TOPIC_KEYS.includes(topic.key)
                    ).map((topic) => (
                      <View key={topic.key} style={styles.chatQuestionBlock}>
                        <TouchableOpacity
                          style={[
                            styles.chatQuickChip,
                            selectedContactTopic === topic.key && styles.chatQuickChipActive
                          ]}
                          onPress={() => handleContactTopicPress(topic)}
                        >
                          <Text
                            style={[
                              styles.chatQuickChipText,
                              selectedContactTopic === topic.key && styles.chatQuickChipTextActive
                            ]}
                          >
                            {assistantLanguage === "ar" ? topic.questionAr : topic.questionEn}
                          </Text>
                        </TouchableOpacity>

                        {selectedContactTopic === topic.key ? (
                          <View style={[styles.chatBubble, styles.chatBotBubble, styles.chatInlineAnswer]}>
                            <Text style={styles.chatBubbleLabel}>Hotline Assistant</Text>
                            <Text style={styles.chatBubbleText}>
                              {assistantLanguage === "ar" ? topic.answerAr : topic.answerEn}
                            </Text>
                            {topic.action ? (
                              <TouchableOpacity
                                style={styles.chatActionBtn}
                                onPress={() => handleContactAssistantAction(topic.action)}
                              >
                                <Text style={styles.chatActionBtnText}>
                                  {assistantLanguage === "ar" ? topic.actionLabelAr : topic.actionLabelEn}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={[styles.assistantSectionHead, styles.chatAssistantSectionHead]}>
                  <Text style={styles.assistantSectionTitle}>
                    {assistantLanguage === "ar" ? "الدردشة مع المساعد الذكي" : "Chat with AI assistant"}
                  </Text>
                  <Text style={styles.assistantSectionSub}>
                    {assistantLanguage === "ar"
                      ? "اكتب سؤالك هنا مع المساعد الذكي أو أرسله للدعم الفني مباشرة"
                      : "Ask your question here with the AI assistant, or send it directly to technical support"}
                  </Text>
                </View>

                <View style={styles.chatThread}>
                  <View style={[styles.chatBubble, styles.chatBotBubble]}>
                    <Text style={styles.chatBubbleLabel}>Hotline Assistant</Text>
                    <Text style={styles.chatBubbleText}>
                      {assistantLanguage === "ar"
                        ? "أنا هنا للمساعدة. اختر سؤالاً سريعاً أو اكتب رسالتك بالأسفل."
                        : "I’m here to help. Choose a quick question or type your message below."}
                    </Text>
                  </View>

                  {contactAssistantHistory.map((entry, index) => {
                    const topic = CONTACT_ASSISTANT_TOPICS.find((item) => item.key === entry.topicKey);
                    return (
                      <View key={entry.id || `${topic?.key || "entry"}-${index}`} style={styles.chatThreadPair}>
                        <View style={[styles.chatBubble, styles.chatUserBubble]}>
                          <Text style={[styles.chatBubbleText, styles.chatUserBubbleText]}>
                            {entry.userText || (assistantLanguage === "ar" ? topic?.questionAr : topic?.questionEn)}
                          </Text>
                        </View>

                        {assistantTypingId === entry.id && !entry.assistantVisible ? (
                          <View style={[styles.chatBubble, styles.chatBotBubble, styles.chatTypingBubble]}>
                            <Text style={styles.chatTypingText}>Typing...</Text>
                          </View>
                        ) : null}

                        {entry.assistantVisible ? (
                          <View style={[styles.chatBubble, styles.chatBotBubble]}>
                            <Text style={styles.chatBubbleLabel}>Hotline Assistant</Text>
                            <Text style={styles.chatBubbleText}>
                              {assistantLanguage === "ar" ? entry.answerAr : entry.answerEn}
                            </Text>
                            {entry.action ? (
                              <TouchableOpacity
                                style={styles.chatActionBtn}
                                onPress={() => handleContactAssistantAction(entry.action)}
                              >
                                <Text style={styles.chatActionBtnText}>
                                  {assistantLanguage === "ar" ? entry.actionLabelAr : entry.actionLabelEn}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                <Text style={styles.chatComposerHint}>
                  {assistantLanguage === "ar" ? "أو اكتب رسالتك بنفسك هنا" : "Or write your own message here"}
                </Text>
                <TextInput
                  ref={contactComposerInputRef}
                  style={[styles.modalInput, styles.chatComposerInput]}
                  placeholder={
                    assistantLanguage === "ar"
                      ? "ما زلت تحتاج مساعدة؟ اكتب رسالتك هنا"
                      : "Still need help? Type your message here"
                  }
                  placeholderTextColor="#7b8799"
                  multiline
                  textAlignVertical="top"
                  value={contactMessage}
                  onChangeText={setContactMessage}
                />
                <View style={styles.contactFooterRow}>
                  <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setContactModalVisible(false)}>
                    <Text style={styles.modalBtnGhostText}>{assistantLanguage === "ar" ? "اغلاق" : "Close"}</Text>
                  </TouchableOpacity>
                  <View style={styles.contactPrimaryActions}>
                    <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleContactSubmit}>
                      <Text style={styles.modalBtnPrimaryText}>
                        {assistantLanguage === "ar" ? "اسأل المساعد الذكي" : "Ask assistant"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleDirectContactSubmit}>
                      <Text style={styles.modalBtnPrimaryText}>
                        {assistantLanguage === "ar" ? "إرسال الطلب" : "Send request"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal transparent visible={businessRequestVisible} animationType="fade" onRequestClose={() => setBusinessRequestVisible(false)}>
        <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.suggestCard, styles.contactCard]}>
              <View style={styles.sheetGlow} />
              <View style={styles.sheetGlowSecondary} />
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.suggestHero}>
                  <View style={[styles.suggestHeroBadge, styles.businessHeroBadge]}>
                    <Ionicons name="briefcase" size={22} color="#9a0f6f" />
                  </View>
                  <Text style={styles.modalTitle}>Business Request</Text>
                  <Text style={styles.modalSubTitle}>Tell us about your business and the plan you want.</Text>
                </View>
                <View style={styles.planSelectedBadge}>
                  <Text style={styles.planSelectedBadgeText}>{selectedBusinessPlan} plan</Text>
                </View>
                <TextInput
                  style={[styles.modalInput, styles.suggestInput]}
                  placeholder="Your name"
                  placeholderTextColor="#7b8799"
                  value={businessRequesterName}
                  onChangeText={setBusinessRequesterName}
                />
                <TextInput
                  style={[styles.modalInput, styles.suggestInput]}
                  placeholder="Business name"
                  placeholderTextColor="#7b8799"
                  value={businessName}
                  onChangeText={setBusinessName}
                />
                <TextInput
                  style={[styles.modalInput, styles.suggestInput]}
                  placeholder="Phone or WhatsApp"
                  placeholderTextColor="#7b8799"
                  keyboardType="phone-pad"
                  value={businessPhone}
                  onChangeText={setBusinessPhone}
                />
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  placeholder="Request details"
                  placeholderTextColor="#7b8799"
                  multiline
                  textAlignVertical="top"
                  value={businessNote}
                  onChangeText={setBusinessNote}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setBusinessRequestVisible(false)}>
                    <Text style={styles.modalBtnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleBusinessRequestSubmit}>
                    <Text style={styles.modalBtnPrimaryText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal transparent visible={businessModalVisible} animationType="fade" onRequestClose={() => setBusinessModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.aboutCard]}>
            <View style={styles.aboutHero}>
              <View style={styles.aboutHeroBadge}>
                  <Ionicons name="megaphone" size={24} color="#ffffff" />
              </View>
                <Text style={styles.modalTitle}>Business Plans</Text>
                <Text style={styles.modalSubTitle}>Plans for businesses that want stronger visibility inside the app.</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.aboutSection, styles.businessSection]}>
                <View style={styles.businessHeaderRow}>
                  <View style={styles.businessBadge}>
                    <Ionicons name="briefcase" size={18} color="#9a0f6f" />
                  </View>
                  <Text style={styles.aboutHeading}>For Business</Text>
                </View>
                <Text style={[styles.aboutBody, styles.aboutBodyAr]}>
                  إذا كنت تمثل مطعماً أو مستشفى أو شركة خدمة، يمكنك طلب ظهور مميز داخل التطبيق لزيادة الوصول والثقة.
                </Text>
                <Text style={styles.aboutBody}>
                  Businesses can request featured placement, verified status, and higher visibility inside search and category results.
                </Text>

                <View style={styles.businessFeatureList}>
                  <View style={styles.businessFeatureItem}>
                    <Ionicons name="star" size={15} color="#d97706" />
                    <Text style={styles.businessFeatureText}>Featured placement</Text>
                  </View>
                  <View style={styles.businessFeatureItem}>
                    <Ionicons name="shield-checkmark" size={15} color="#15803d" />
                    <Text style={styles.businessFeatureText}>Verified badge</Text>
                  </View>
                  <View style={styles.businessFeatureItem}>
                    <Ionicons name="trending-up" size={15} color="#7c3aed" />
                    <Text style={styles.businessFeatureText}>Priority ranking</Text>
                  </View>
                </View>

                <View style={styles.planCardList}>
                  <View style={styles.planCard}>
                    <View style={styles.planCardTop}>
                      <View style={[styles.planIconBadge, styles.planIconVerified]}>
                        <Ionicons name="shield-checkmark" size={18} color="#15803d" />
                      </View>
                      <View style={styles.planTitleWrap}>
                        <Text style={styles.planTitle}>Verified</Text>
                        <Text style={styles.planTitleAr}>موثقة</Text>
                      </View>
                    </View>
                    <Text style={styles.planPrice}>100 EGP / month</Text>
                    <Text style={[styles.planBody, styles.planBodyAr]}>شارة موثقة لنشاطك التجاري لزيادة الثقة والاعتماد داخل التطبيق.</Text>
                    <Text style={styles.planBody}>Trusted badge for your business and stronger customer confidence.</Text>
                    <TouchableOpacity style={styles.planBtn} onPress={() => openBusinessInquiry("Verified")}>
                      <Text style={styles.planBtnText}>اطلب هذه الباقة{"\n"}Request this plan</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.planCard}>
                    <View style={styles.planCardTop}>
                      <View style={[styles.planIconBadge, styles.planIconFeatured]}>
                        <Ionicons name="star" size={18} color="#d97706" />
                      </View>
                      <View style={styles.planTitleWrap}>
                        <Text style={styles.planTitle}>Featured</Text>
                        <Text style={styles.planTitleAr}>مميزة</Text>
                      </View>
                    </View>
                    <Text style={styles.planPrice}>200 EGP / month</Text>
                    <Text style={[styles.planBody, styles.planBodyAr]}>ظهور أقوى داخل الفئات وترتيب أفضل في نتائج البحث.</Text>
                    <Text style={styles.planBody}>Higher visibility inside categories and better placement in search results.</Text>
                    <TouchableOpacity style={styles.planBtn} onPress={() => openBusinessInquiry("Featured")}>
                      <Text style={styles.planBtnText}>اطلب هذه الباقة{"\n"}Request this plan</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.planCard, styles.planCardPremium]}>
                    <View style={styles.planCardTop}>
                      <View style={[styles.planIconBadge, styles.planIconPremium]}>
                        <Ionicons name="sparkles" size={18} color="#7c3aed" />
                      </View>
                      <View style={styles.planTitleWrap}>
                        <Text style={styles.planTitle}>Premium</Text>
                        <Text style={styles.planTitleAr}>بريميوم</Text>
                      </View>
                    </View>
                    <Text style={styles.planPrice}>400 EGP / month</Text>
                    <Text style={[styles.planBody, styles.planBodyAr]}>ظهور مميز + شارة موثقة + أولوية أعلى لأقوى حضور داخل التطبيق.</Text>
                    <Text style={styles.planBody}>Featured + Verified + top priority for the strongest exposure in the app.</Text>
                    <TouchableOpacity style={[styles.planBtn, styles.planBtnPremium]} onPress={() => openBusinessInquiry("Premium")}>
                      <Text style={styles.planBtnText}>اطلب هذه الباقة{"\n"}Request this plan</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => setBusinessModalVisible(false)}>
                <Text style={styles.modalBtnPrimaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={aboutModalVisible} animationType="fade" onRequestClose={() => setAboutModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.aboutCard]}>
            <View style={styles.aboutHero}>
              <View style={styles.aboutHeroBadge}>
                <Ionicons name="information-circle" size={26} color="#ffffff" />
              </View>
              <Text style={styles.modalTitle}>About Us</Text>
              <Text style={styles.modalSubTitle}>What the app offers and how it helps.</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.aboutSection}>
                <Text style={styles.aboutHeading}>من نحن</Text>
                <Text style={[styles.aboutBody, styles.aboutBodyAr]}>
                  Hotline App هو دليل ذكي وسريع للوصول إلى أهم الخطوط الساخنة والأرقام المهمة في مصر بشكل منظم وسهل.
                </Text>
                <Text style={[styles.aboutBody, styles.aboutBodyAr]}>
                  يوفر التطبيق تصنيفات واضحة تشمل الخدمات الحكومية، المستشفيات، المطاعم، الخدمات المالية، النقل، والخدمات المتنوعة، حتى تصل إلى الرقم الذي تحتاجه بسرعة.
                </Text>
                <Text style={[styles.aboutBody, styles.aboutBodyAr]}>
                  كما يتيح لك التطبيق اقتراح أرقام جديدة وإرسال الملاحظات للمساعدة في تطوير قاعدة البيانات وتحسين الخدمة باستمرار.
                </Text>
              </View>

              <View style={styles.aboutPillRow}>
                <View style={styles.aboutPill}>
                  <Ionicons name="flash" size={15} color="#7c3aed" />
                  <Text style={styles.aboutPillText}>Fast access</Text>
                </View>
                <View style={styles.aboutPill}>
                  <Ionicons name="call" size={15} color="#7c3aed" />
                  <Text style={styles.aboutPillText}>Useful numbers</Text>
                </View>
                <View style={styles.aboutPill}>
                  <Ionicons name="sparkles" size={15} color="#7c3aed" />
                  <Text style={styles.aboutPillText}>Community updates</Text>
                </View>
              </View>

              <View style={styles.aboutSection}>
                <Text style={styles.aboutHeading}>About Hotline App</Text>
                <Text style={styles.aboutBody}>
                  Hotline App is a smart and fast directory designed to help users reach important hotlines and service numbers in Egypt with ease.
                </Text>
                <Text style={styles.aboutBody}>
                  The app offers organized categories including emergency services, hospitals, food, finance, transport, and many other useful services.
                </Text>
                <Text style={styles.aboutBody}>
                  It also lets users suggest new numbers and send feedback so the database stays useful and up to date.
                </Text>
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => setAboutModalVisible(false)}>
                <Text style={styles.modalBtnPrimaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showIntro ? (
        <Pressable style={styles.introOverlay} onPress={handleIntroContinue}>
          <ImageBackground source={introLocal} style={[styles.introImage, introImageResponsive]} resizeMode={introResizeMode}>
            <View style={[styles.introTint, introTintResponsive]} />
            {showIntroBrandOverlay ? (
              <View style={[styles.introBrandWrap, introBrandWrapResponsive]}>
                <View style={styles.introBrandBadge}>
                  <Ionicons name="call" size={18} color="#ffffff" />
                </View>
                <Text style={[styles.introBrandTitle, introBrandTitleResponsive]}>Hotline App</Text>
                <Text style={[styles.introBrandSub, introBrandSubResponsive]}>Fast access to important numbers in Egypt</Text>
              </View>
            ) : null}
          </ImageBackground>
        </Pressable>
      ) : null}

      {showSuggestHint ? (
        <Pressable style={[styles.hintOverlay, hintOverlayResponsive]} onPress={dismissSuggestHint}>
          <View style={[styles.hintCard, hintCardResponsive]}>
            <View style={styles.hintBadge}>
              <Ionicons name="sparkles" size={20} color="#b30f7f" />
            </View>
            <Text style={styles.hintTitle}>الخدمات السريعة</Text>
            <View style={styles.hintList}>
              <View style={styles.hintItem}>
                <View style={[styles.hintMiniBadge, styles.hintMiniBusiness]}>
                  <Ionicons name="rocket-outline" size={14} color="#7c3aed" />
                </View>
                <Text style={[styles.hintItemText, styles.aboutBodyAr]}>Promote لعرض باقات الظهور المميز والتوثيق للأعمال.</Text>
              </View>
              <View style={styles.hintItem}>
                <View style={[styles.hintMiniBadge, styles.hintMiniAdd]}>
                  <Ionicons name="sparkles" size={14} color="#b30f7f" />
                </View>
                <Text style={[styles.hintItemText, styles.aboutBodyAr]}>Add Number لإضافة رقم جديد أو اقتراح جهة جديدة داخل التطبيق.</Text>
              </View>
              <View style={styles.hintItem}>
                <View style={[styles.hintMiniBadge, styles.hintMiniContact]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color="#0f766e" />
                </View>
                <Text style={[styles.hintItemText, styles.aboutBodyAr]}>Contact us لإرسال ملاحظة أو اقتراح يساعدنا في تحسين الخدمة.</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.hintBtn} onPress={dismissSuggestHint}>
              <Text style={styles.hintBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.hintArrowWrap} pointerEvents="none">
            <View style={styles.hintArrowStem} />
            <Text style={styles.hintArrow}>⌄</Text>
          </View>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1
  },
  iosBackSwipeEdge: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 50
  },
  screenHidden: {
    opacity: 0
  },
  container: {
    flex: 1,
    backgroundColor: "#f7e8f3"
  },
  appGlowTop: {
    position: "absolute",
    top: 180,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(226, 120, 197, 0.07)"
  },
  appGlowBottom: {
    position: "absolute",
    bottom: 120,
    left: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(145, 110, 255, 0.05)"
  },
  appGlowMid: {
    position: "absolute",
    top: 520,
    left: 140,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  hero: {
    backgroundColor: "#b30f7f",
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingHorizontal: 22,
    paddingTop: 32,
    paddingBottom: 30,
    shadowColor: "#7a0c64",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    overflow: "hidden",
    position: "relative"
  },
  heroBlob1: {
    position: "absolute",
    top: -90,
    left: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#d63aa3",
    opacity: 0.55
  },
  heroBlob2: {
    position: "absolute",
    bottom: -110,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#9c0a6e",
    opacity: 0.6
  },
  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  welcomeTextWrap: {
    flex: 1
  },
  phoneIconWrap: {
    marginRight: 10,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#c53a95",
    padding: 4,
    shadowColor: "#0f1b66",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
    borderWidth: 1,
    borderColor: "#d96fb2"
  },
  phoneIconImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12
  },
  phoneIconFallback: {
    fontSize: 28,
    textAlign: "center",
    lineHeight: 48
  },
  welcomeTitle: {
    color: "#fff",
    fontSize: 44,
    fontWeight: "700"
  },
  welcomeSub: {
    color: "#dfe4ff",
    fontSize: 30
  },
  searchShell: {
    marginTop: 2
  },
  searchBar: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.92)",
    borderRadius: 26,
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    shadowColor: "#80105f",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  searchInput: {
    flex: 1,
    color: "#111827",
    fontSize: 19,
    fontWeight: "600"
  },
  searchIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ffffff",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0,
    borderWidth: 1,
    borderColor: "#f1d6ea"
  },
  clearSearchBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.46)",
    alignItems: "center",
    justifyContent: "center"
  },
  clearSearchBtnRight: {
    marginRight: 8
  },
  clearSearchBtnLeft: {
    marginLeft: 2,
    marginRight: 8
  },
  clearSearchText: {
    color: "#334155",
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "700"
  },
  searchIcon: {
    fontSize: 22
  },
  searchCaption: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    marginLeft: 8
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 116
  },
  suggestBox: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#8d5a9d",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
    elevation: 5
  },
  suggestItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(232,226,240,0.8)",
    alignItems: "flex-start"
  },
  suggestText: {
    color: "#1f2937",
    fontWeight: "800",
    fontSize: 16
  },
  contactBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
    marginBottom: 2
  },
  contactBadgeRowCompact: {
    marginTop: 5,
    marginBottom: 0
  },
  contactBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1
  },
  contactBadgeText: {
    fontSize: 11,
    fontWeight: "800"
  },
  featuredBadge: {
    backgroundColor: "rgba(255,215,0,0.16)",
    borderColor: "rgba(245,158,11,0.34)"
  },
  featuredBadgeText: {
    color: "#b45309"
  },
  verifiedBadge: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.3)"
  },
  verifiedBadgeText: {
    color: "#15803d"
  },
  suggestMeta: {
    width: "100%",
    flexGrow: 0
  },
  suggestCategoryPreview: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 4
  },
  suggestBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 10
  },
  suggestPhoneBadge: {
    backgroundColor: "#f6ebff",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 7,
    minWidth: 76,
    borderWidth: 1,
    borderColor: "#ead8ff",
    shadowColor: "#d8b4fe",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2
  },
  suggestPhonePreview: {
    color: "#6d28d9",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  suggestHint: {
    color: "#7c3aed",
    fontSize: 12,
    fontWeight: "700",
    opacity: 0.85
  },
  typoBox: {
    backgroundColor: "rgba(255,255,255,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.52)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12
  },
  typoText: {
    color: "#3d49c7",
    fontWeight: "700"
  },
  quickResultCard: {
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#1a1f36",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  quickResultTitle: {
    color: "#1f2937",
    fontSize: 18,
    fontWeight: "800"
  },
  quickResultSub: {
    color: "#4b5563",
    marginTop: 4,
    fontSize: 13
  },
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    marginTop: 8
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 14
  },
  showAllBtn: {
    backgroundColor: "rgba(255,255,255,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  showAll: {
    color: "#2f3cb0",
    fontWeight: "800"
  },
  gridRow: {
    justifyContent: "space-between",
    columnGap: 16,
    rowGap: 0
  },
  categoryCard: {
    width: "100%",
    backgroundColor: "#f6e8f3",
    borderRadius: 26,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 132,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "rgba(179,15,127,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    overflow: "hidden",
    justifyContent: "center"
  },
  categoryCardActive: {
    borderColor: "#5d67e8",
    backgroundColor: "#f0def0"
  },
  categoryCardPressed: {
    transform: [{ scale: 0.95 }, { translateY: 3 }],
    shadowOpacity: 0,
    shadowRadius: 0
  },
  categoryIcon: {
    display: "none"
  },
  categoryImageWrap: {
    width: 80,
    height: 80,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  categoryBadge: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderWidth: 0,
    borderColor: "transparent"
  },
  categoryIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible"
  },
  cardUnderGlow: {
    display: "none"
  },
  cardUnderGlow2: {
    display: "none"
  },
  cardContent: {
    position: "relative",
    alignItems: "center",
    width: "100%",
    flex: 1,
    justifyContent: "center"
  },
  fallbackIcon: {
    fontSize: 48
  },
  categoryText: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    textAlignVertical: "center",
    marginTop: 1
  },
  categoryTextSub: {
    color: "#475569",
    fontSize: 12,
    textAlign: "center",
    marginTop: -1,
    textAlignVertical: "center"
  },
  categoryTextActive: {
    color: "#3b47c0",
    fontWeight: "700"
  },
  allCategoryHeaderRow: {
    flexDirection: "row",
    marginBottom: 8
  },
  allCategoryCard: {
    width: "31%"
  },
  groupedSection: {
    marginBottom: 12
  },
  groupedTitle: {
    color: "#182134",
    fontWeight: "800",
    marginBottom: 10,
    fontSize: 17
  },
  groupedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  detailPage: {
    marginTop: 8,
    padding: 16,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 0,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  detailList: {
    marginTop: 8,
    gap: 10
  },
  detailOpenList: {
    width: "100%"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d6ddfb",
    backgroundColor: "#f7f8ff"
  },
  chipActive: {
    backgroundColor: "#5d67e8",
    borderColor: "#5d67e8"
  },
  chipText: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "700"
  },
  chipTextActive: {
    color: "#fff"
  },
  subCard: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7f0",
    padding: 10,
    gap: 8
  },
  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  subTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
    flex: 1
  },
  subToggle: {
    color: "#6b7280",
    fontWeight: "700"
  },
  focusedPage: {
    marginTop: 4,
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.46)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  focusedHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10
  },
  focusedIcon: {
    fontSize: 26,
    marginRight: 10
  },
  focusedTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a"
  },
  focusedBack: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#e0e7ff",
    shadowColor: "#1f2937",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  focusedBackText: {
    color: "#1f2937",
    fontWeight: "800"
  },
  heroBackBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(224,231,255,0.96)",
    shadowColor: "#231942",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  heroBackText: {
    color: "#1f2937",
    fontWeight: "800"
  },
  heroInfoBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ca489d",
    borderWidth: 1,
    borderColor: "#de84bd",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#56093f",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0
  },
  loader: {
    marginVertical: 10
  },
  error: {
    color: "#b42318",
    marginBottom: 8
  },
  hotlineCard: {
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    marginBottom: 12,
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6
  },
  hotlineCardFeatured: {
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8
  },
  hotlineBody: {
    flex: 1
  },
  hotlineName: {
    color: "#1f2937",
    fontSize: 18,
    fontWeight: "800"
  },
  hotlineSub: {
    color: "#4b5563",
    marginTop: 2
  },
  nonPhone: {
    marginTop: 8,
    color: "#8a5a14",
    fontWeight: "700"
  },
  quickActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  contactActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  quickActionBtn: {
    marginTop: 0
  },
  contactActionBtn: {
    marginTop: 0
  },
  callBtn: {
    backgroundColor: "#ff3b81",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignSelf: "flex-start",
    shadowColor: "#ff3b81",
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  callBtnPressed: {
    transform: [{ scale: 0.94 }],
    shadowOpacity: 0.18
  },
  callBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.4
  },
  detailAnchor: {
    height: 1,
    width: "100%"
  },
  bottomBarShell: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 0,
    height: 108,
    overflow: "visible",
    zIndex: 40,
    elevation: 1
  },
  bottomBar: {
    flex: 1,
    borderRadius: 26,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    overflow: "visible",
    zIndex: 1
  },
  bottomCenterSpacer: {
    flex: 1
  },
  bottomItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
    paddingHorizontal: 4
  },
  bottomCenterFloating: {
    position: "absolute",
    left: "50%",
    top: -18,
    transform: [{ translateX: -44 }],
    alignItems: "center",
    justifyContent: "flex-start",
    zIndex: 50,
    elevation: 30
  },
  bottomCenterItem: {
    justifyContent: "center",
    paddingHorizontal: 2,
    marginTop: 0
  },
  bottomVisualSlot: {
    width: 72,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    position: "relative",
    overflow: "visible"
  },
  bottomSideVisualSlot: {
    marginBottom: 8
  },
  bottomCenterBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#f3d8ea",
    shadowColor: "#7b7b86",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 18,
    zIndex: 60
  },
  bottomAssistantSparkles: {
    position: "absolute",
    top: 10,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#d21695",
    alignItems: "center",
    justifyContent: "center"
  },
  bottomCenterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3
  },
  bottomCenterSubText: {
    color: "#ffd0f0",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 0
  },
  bottomIcon: {
    fontSize: 36,
    marginBottom: 0
  },
  bottomText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginTop: -8
  },
  bottomSideText: {
    marginTop: -14
  },
  bottomSubText: {
    color: "#ffd0f0",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 1
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(9,13,29,0.45)",
    justifyContent: "center",
    paddingHorizontal: 20
  },
  sheetBackdrop: {
    justifyContent: "flex-end",
    paddingHorizontal: 0
  },
  modalCard: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    padding: 16
  },
  aboutCard: {
    maxHeight: "80%",
    borderRadius: 28,
    paddingTop: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    shadowColor: "#6d3b7b",
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10
  },
  aboutHero: {
    alignItems: "center",
    marginBottom: 14
  },
  aboutHeroBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#b30f7f",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#b30f7f",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  aboutSection: {
    backgroundColor: "rgba(247,248,255,0.9)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(221,228,255,0.95)"
  },
  aboutPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  aboutPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f3e8ff",
    borderWidth: 1,
    borderColor: "#e9d5ff"
  },
  aboutPillText: {
    color: "#5b21b6",
    fontSize: 12,
    fontWeight: "700"
  },
  aboutHeading: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginTop: 8,
    marginBottom: 8
  },
  aboutBody: {
    fontSize: 15,
    lineHeight: 24,
    color: "#374151",
    marginBottom: 10
  },
  aboutBodyAr: {
    textAlign: "right",
    writingDirection: "rtl"
  },
  businessSection: {
    backgroundColor: "rgba(255,245,251,0.96)",
    borderColor: "rgba(240,190,225,0.95)"
  },
  businessHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6
  },
  businessBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(233,170,214,0.75)",
    alignItems: "center",
    justifyContent: "center"
  },
  businessFeatureList: {
    gap: 8,
    marginTop: 2,
    marginBottom: 14
  },
  planCardList: {
    gap: 10,
    marginBottom: 14
  },
  planCard: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(236,205,227,0.85)",
    shadowColor: "#d38fc1",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  planCardPremium: {
    backgroundColor: "rgba(248,242,255,0.95)",
    borderColor: "rgba(206,186,255,0.9)",
    shadowColor: "#b387ff"
  },
  planCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8
  },
  planTitleWrap: {
    flex: 1
  },
  planIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  planIconVerified: {
    backgroundColor: "rgba(220,252,231,0.9)",
    borderColor: "rgba(134,239,172,0.8)"
  },
  planIconFeatured: {
    backgroundColor: "rgba(254,243,199,0.92)",
    borderColor: "rgba(252,211,77,0.85)"
  },
  planIconPremium: {
    backgroundColor: "rgba(243,232,255,0.95)",
    borderColor: "rgba(196,181,253,0.9)"
  },
  planTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800"
  },
  planTitleAr: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  planPrice: {
    color: "#9a0f6f",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6
  },
  planBody: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 6
  },
  planBodyAr: {
    textAlign: "right",
    writingDirection: "rtl",
    color: "#374151"
  },
  planBtn: {
    alignSelf: "stretch",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.9)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 4,
    shadowColor: "#e9d5ff",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  planBtnPremium: {
    backgroundColor: "rgba(255,255,255,0.9)"
  },
  planBtnText: {
    color: "#7c3aed",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 20
  },
  businessFeatureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  businessFeatureText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700"
  },
  businessHeroBadge: {
    backgroundColor: "rgba(255,240,247,0.96)"
  },
  planSelectedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#f3e8ff",
    borderWidth: 1,
    borderColor: "#e9d5ff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12
  },
  planSelectedBadgeText: {
    color: "#7c3aed",
    fontSize: 13,
    fontWeight: "800"
  },
  sheetCard: {
    paddingHorizontal: 14,
    paddingBottom: 12
  },
  sheetHandle: {
    alignSelf: "center",
    width: 54,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
    marginBottom: 10
  },
  sheetInner: {
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingBottom: 22
  },
  sheetCloseBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 20,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "#ead5e8",
    alignItems: "center",
    justifyContent: "center"
  },
  sheetGlow: {
    position: "absolute",
    top: -40,
    right: -10,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,120,220,0.16)"
  },
  sheetGlowSecondary: {
    position: "absolute",
    bottom: -50,
    left: -10,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(110,100,255,0.12)"
  },
  suggestCard: {
    paddingTop: 18
  },
  contactCard: {
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderColor: "rgba(255,255,255,0.82)",
    paddingTop: 22
  },
  contactCloseBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 20,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "#ead5e8",
    alignItems: "center",
    justifyContent: "center"
  },
  suggestHero: {
    alignItems: "center",
    marginBottom: 8
  },
  suggestHeroBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fde7f7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  contactHeroBadge: {
    backgroundColor: "#fce7f3"
  },
  contactHeroSparkles: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#d21695",
    alignItems: "center",
    justifyContent: "center"
  },
  modalTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 3
  },
  modalSubTitle: {
    color: "#334155",
    fontSize: 12,
    marginBottom: 6,
    textAlign: "center"
  },
  assistantLanguageRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10
  },
  assistantLanguageBtn: {
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f4e9f5",
    borderWidth: 1,
    borderColor: "#ead5e8",
    alignItems: "center",
    justifyContent: "center"
  },
  assistantLanguageBtnActive: {
    backgroundColor: "#ffffff",
    borderColor: "#d21695"
  },
  assistantLanguageText: {
    color: "#7a4766",
    fontSize: 12.5,
    fontWeight: "700"
  },
  assistantLanguageTextActive: {
    color: "#9a0f6f"
  },
  assistantSectionHead: {
    marginBottom: 8
  },
  assistantSectionTitle: {
    color: "#1f2937",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center"
  },
  assistantSectionSub: {
    color: "#7a4766",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2
  },
  quickQuestionsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#ead5e8",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10
  },
  quickQuestionsToggleTextWrap: {
    flex: 1,
    paddingRight: 10
  },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe3f5",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
    marginBottom: 10
  },
  suggestInput: {
    borderRadius: 16
  },
  modalTextArea: {
    minHeight: 110
  },
  chatThread: {
    gap: 7,
    marginBottom: 8
  },
  chatThreadPair: {
    gap: 5
  },
  chatBubble: {
    maxWidth: "86%",
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 9
  },
  chatBotBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,240,248,0.96)",
    borderWidth: 1,
    borderColor: "rgba(240,190,225,0.9)"
  },
  chatUserBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#4a56d7"
  },
  chatBubbleLabel: {
    color: "#9a0f6f",
    fontSize: 10.5,
    fontWeight: "800",
    marginBottom: 3
  },
  chatBubbleText: {
    color: "#334155",
    fontSize: 12.5,
    lineHeight: 18
  },
  chatUserBubbleText: {
    color: "#ffffff"
  },
  chatQuickRow: {
    gap: 5
  },
  chatQuestionBlock: {
    gap: 6
  },
  chatQuickChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 15,
    backgroundColor: "#f3e8ff",
    borderWidth: 1,
    borderColor: "#e9d5ff",
    width: "100%"
  },
  chatQuickChipActive: {
    backgroundColor: "#f6d6ec",
    borderColor: "#f3a7d2"
  },
  chatQuickChipText: {
    color: "#6b21a8",
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center"
  },
  chatQuickChipTextActive: {
    color: "#9a0f6f"
  },
  chatActionBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "#4a56d7",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  chatActionBtnText: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "800"
  },
  chatInlineAnswer: {
    alignSelf: "stretch",
    maxWidth: "100%",
    marginLeft: 8
  },
  chatTypingBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  chatTypingText: {
    color: "#9a0f6f",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2
  },
  chatComposerHint: {
    color: "#7a4766",
    fontSize: 11.5,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center"
  },
  chatComposerInput: {
    minHeight: 64,
    borderRadius: 15,
    marginBottom: 8
  },
  chatAssistantSectionHead: {
    marginTop: 14
  },
  modalActions: {
    gap: 8,
    marginBottom: 12
  },
  contactFooterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12
  },
  contactPrimaryActions: {
    flex: 1,
    gap: 8
  },
  modalBtnGhost: {
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d8c7d5",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  modalBtnGhostText: {
    color: "#7a4766",
    fontSize: 12.5,
    fontWeight: "800"
  },
  modalBtnPrimary: {
    backgroundColor: "#4a56d7",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  modalBtnPrimaryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center"
  },
  introOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#18011f",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    zIndex: 999,
    elevation: 50
  },
  introTint: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(34, 0, 48, 0.22)"
  },
  introGlowTop: {
    position: "absolute",
    top: -80,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255, 0, 140, 0.22)"
  },
  introGlowBottom: {
    position: "absolute",
    bottom: -70,
    left: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(90, 100, 255, 0.16)"
  },
  introBrandWrap: {
    position: "absolute",
    top: 60,
    left: 24,
    right: 24,
    alignItems: "flex-start"
  },
  introBrandBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ca489d",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#de84bd"
  },
  introBrandTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0.3
  },
  introBrandSub: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 250
  },
  introCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 26,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12
  },
  introTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#b30f7f",
    marginBottom: 8
  },
  introSubtitle: {
    fontSize: 16,
    color: "#374151",
    textAlign: "center",
    marginBottom: 18
  },
  introBtn: {
    backgroundColor: "#b30f7f",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24
  },
  introBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.4
  },
  introImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%"
  },
  introBtnFloating: {
    position: "absolute",
    bottom: 36,
    backgroundColor: "rgba(18,18,30,0.34)",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.42)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5
  },
  hintOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(10,12,24,0.28)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 138,
    paddingHorizontal: 24
  },
  hintCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: "#2b0f3f",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)"
  },
  hintBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fde7f7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  hintTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8
  },
  hintBody: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6
  },
  hintList: {
    gap: 10,
    marginTop: 4,
    marginBottom: 4
  },
  hintItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(249,250,251,0.94)",
    borderWidth: 1,
    borderColor: "rgba(234,236,242,0.95)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  hintMiniBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  hintMiniBusiness: {
    backgroundColor: "#f3e8ff"
  },
  hintMiniAdd: {
    backgroundColor: "#fde7f7"
  },
  hintMiniContact: {
    backgroundColor: "#dff7f4"
  },
  hintItemText: {
    flex: 1,
    color: "#374151",
    fontSize: 13,
    lineHeight: 21
  },
  hintBtn: {
    alignSelf: "flex-end",
    marginTop: 8,
    backgroundColor: "#4a56d7",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12
  },
  hintBtnText: {
    color: "#fff",
    fontWeight: "800"
  },
  hintArrowWrap: {
    alignItems: "center",
    marginTop: 2
  },
  hintArrowStem: {
    width: 3,
    height: 24,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
    marginBottom: -2
  },
  hintArrow: {
    fontSize: 34,
    lineHeight: 34,
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10
  }
});
