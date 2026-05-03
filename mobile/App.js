import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  PanResponder,
  ImageBackground,
  Dimensions,
  useWindowDimensions,
  useColorScheme,
  Image
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as NavigationBar from "expo-navigation-bar";
import * as FileSystem from "expo-file-system";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE_URL } from "./src/config/api";
import FALLBACK_CONTACTS from "./src/data/fallbackContacts";

const GROUPS = [
  { key: "gov", icon: "🚨" },
  { key: "health", icon: "🏨" },
  { key: "food", icon: "🍽️" },
  { key: "finance", icon: "💳" },
  { key: "mobility", icon: "🚗" },
  { key: "retail", icon: "🧰" },
  { key: "sports", icon: "🏅" },
  { key: "foreign", icon: "🌍" }
];
const GROUP_LABELS = {
  gov: {
    titleEn: "Emergency",
    titleAr: "طوارئ",
    subtitleEn: "Emergency and public services",
    subtitleAr: "طوارئ وخدمات حكومية"
  },
  health: {
    titleEn: "Hospital",
    titleAr: "مستشفيات",
    subtitleEn: "Hospitals and medical services",
    subtitleAr: "مستشفيات وخدمات طبية"
  },
  food: {
    titleEn: "Food & Malls",
    titleAr: "طعام ومولات",
    subtitleEn: "Restaurants, cafes, and malls",
    subtitleAr: "مطاعم ومولات"
  },
  finance: {
    titleEn: "Finance & Estate",
    titleAr: "مال وعقارات",
    subtitleEn: "Finance, banking, and estate",
    subtitleAr: "مال وعقارات"
  },
  mobility: {
    titleEn: "Cars & Travel",
    titleAr: "سيارات وسفر",
    subtitleEn: "Cars, flights, travel, and shipping",
    subtitleAr: "سيارات وطيران وسفر وشحن"
  },
  retail: {
    titleEn: "Services Hub",
    titleAr: "خدمات متنوعة",
    subtitleEn: "Mobile, hotels, apps, and daily services",
    subtitleAr: "محمول وفنادق وتطبيقات وخدمات يومية"
  },
  sports: {
    titleEn: "Sports",
    titleAr: "رياضة",
    subtitleEn: "Gyms, sportswear, and equipment",
    subtitleAr: "جيم وملابس وأجهزة رياضية"
  },
  foreign: {
    titleEn: "Foreign Services",
    titleAr: "خدمات الأجانب",
    subtitleEn: "Embassies, tourism, and visitor help",
    subtitleAr: "سفارات وسياحة وخدمات للزوار"
  }
};

const UI_TEXT = {
  welcomeTitle: { en: "Welcome to", ar: "مرحبًا بك في" },
  welcomeSub: { en: "Hotline app", ar: "تطبيق Hotline" },
  back: { en: "Back", ar: "رجوع" },
  searchPlaceholder: { en: "Search hotline", ar: "ابحث عن خدمة أو رقم" },
  searchCaption: { en: "Search by name or hotline number", ar: "ابحث بالاسم أو برقم الخدمة" },
  languageArabic: { en: "AR", ar: "ع" },
  languageEnglish: { en: "EN", ar: "EN" },
  themeSystem: { en: "Auto", ar: "تلقائي" },
  themeLight: { en: "Light", ar: "فاتح" },
  themeDark: { en: "Dark", ar: "داكن" },
  tapToView: { en: "Tap to view", ar: "اضغط للعرض" },
  didYouMeanPrefix: { en: "Did you mean:", ar: "هل تقصد:" },
  nonPhone: { en: "Non-phone / app-based", ar: "غير هاتفي / عبر التطبيق" },
  noCategoryData: { en: "No data is available for this category right now.", ar: "لا توجد بيانات متاحة لهذه الفئة حالياً." },
  suggestNumberTitle: { en: "Suggest A Number", ar: "اقترح رقمًا" },
  suggestNumberSub: { en: "Send a new hotline and we will review it.", ar: "أرسل رقمًا جديدًا وسنراجعه." },
  suggestNamePlaceholder: { en: "Place or organization", ar: "اسم الجهة أو المكان" },
  suggestPhonePlaceholder: { en: "Phone or hotline number", ar: "رقم الهاتف أو الخط الساخن" },
  send: { en: "Send", ar: "إرسال" },
  contactModalTitle: { en: "Contact us (AI assistant)", ar: "تواصل معنا (مساعد ذكي)" },
  contactModalSub: { en: "Quick answers, helpful prompts, and direct support in one place.", ar: "إجابات سريعة وإرشاد مباشر ودعم في مكان واحد." },
  quickQuestionsTitle: { en: "Quick questions", ar: "أسئلة سريعة" },
  quickQuestionsSub: { en: "Useful shortcuts if you want a fast start", ar: "اختصارات مفيدة لو تحب تبدأ بسرعة" },
  assistantChatTitle: { en: "Chat with AI assistant", ar: "الدردشة مع المساعد الذكي" },
  assistantChatSub: { en: "Ask your question here with the AI assistant, or send it directly to technical support", ar: "اكتب سؤالك هنا مع المساعد الذكي أو أرسله للدعم الفني مباشرة" },
  assistantGreeting: { en: "I’m here to help. Choose a quick question or type your message below.", ar: "أنا هنا للمساعدة. اختر سؤالاً سريعاً أو اكتب رسالتك بالأسفل." },
  writeOwnMessage: { en: "Or write your own message here", ar: "أو اكتب رسالتك بنفسك هنا" },
  messagePlaceholder: { en: "Still need help? Type your message here", ar: "ما زلت تحتاج مساعدة؟ اكتب رسالتك هنا" },
  close: { en: "Close", ar: "اغلاق" },
  askAssistant: { en: "Ask assistant", ar: "اسأل المساعد الذكي" },
  sendRequest: { en: "Send request", ar: "إرسال الطلب" },
  businessRequestTitle: { en: "Business Request", ar: "طلب تجاري" },
  businessRequestSub: { en: "Tell us about your business and the plan you want.", ar: "أخبرنا عن نشاطك والباقـة التي تريدها." },
  yourName: { en: "Your name", ar: "اسمك" },
  businessName: { en: "Business name", ar: "اسم النشاط" },
  phoneOrWhatsapp: { en: "Phone or WhatsApp", ar: "الهاتف أو واتساب" },
  requestDetails: { en: "Request details", ar: "تفاصيل الطلب" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  businessPlansTitle: { en: "Business Plans", ar: "باقات الأعمال" },
  businessPlansSub: { en: "Plans for businesses that want stronger visibility inside the app.", ar: "باقات للأنشطة التي تريد ظهورًا أقوى داخل التطبيق." },
  forBusiness: { en: "For Business", ar: "للأعمال" },
  businessIntroAr1: { en: "If you run a restaurant, hospital, or service business, you can request stronger placement inside the app to increase reach and trust.", ar: "إذا كنت تمثل مطعماً أو مستشفى أو شركة خدمة، يمكنك طلب ظهور مميز داخل التطبيق لزيادة الوصول والثقة." },
  businessIntroAr2: { en: "Businesses can request featured placement, verified status, and higher visibility inside search and category results.", ar: "يمكن للشركات طلب ظهور مميز، وحالة موثقة، ووضوح أكبر داخل نتائج البحث والفئات." },
  featuredPlacement: { en: "Featured placement", ar: "ظهور مميز" },
  verifiedBadge: { en: "Verified badge", ar: "شارة موثقة" },
  priorityRanking: { en: "Priority ranking", ar: "أولوية أعلى" },
  requestThisPlan: { en: "Request this plan", ar: "اطلب هذه الباقة" },
  aboutUsTitle: { en: "About Us", ar: "من نحن" },
  aboutUsSub: { en: "What the app offers and how it helps.", ar: "ماذا يقدم التطبيق وكيف يساعدك." },
  aboutAr1: { en: "Hotline App is a smart and fast directory for the most important hotlines and service numbers in Egypt.", ar: "Hotline App هو دليل ذكي وسريع للوصول إلى أهم الخطوط الساخنة والأرقام المهمة في مصر بشكل منظم وسهل." },
  aboutAr2: { en: "It offers clear categories for government services, hospitals, food, finance, transport, and many other useful services.", ar: "يوفر التطبيق تصنيفات واضحة تشمل الخدمات الحكومية، المستشفيات، المطاعم، الخدمات المالية، النقل، والخدمات المتنوعة، حتى تصل إلى الرقم الذي تحتاجه بسرعة." },
  aboutAr3: { en: "It also lets you suggest new numbers and send feedback so the database can keep improving.", ar: "كما يتيح لك التطبيق اقتراح أرقام جديدة وإرسال الملاحظات للمساعدة في تطوير قاعدة البيانات وتحسين الخدمة باستمرار." },
  fastAccess: { en: "Fast access", ar: "وصول سريع" },
  usefulNumbers: { en: "Useful numbers", ar: "أرقام مفيدة" },
  communityUpdates: { en: "Community updates", ar: "تحديثات المجتمع" },
  aboutEnHeading: { en: "About Hotline App", ar: "عن Hotline App" },
  aboutEn1: { en: "Hotline App is a smart and fast directory designed to help users reach important hotlines and service numbers in Egypt with ease.", ar: "Hotline App هو دليل ذكي وسريع يساعد المستخدم على الوصول إلى الأرقام والخدمات المهمة في مصر بسهولة." },
  aboutEn2: { en: "The app offers organized categories including emergency services, hospitals, food, finance, transport, and many other useful services.", ar: "يقدم التطبيق تصنيفات منظمة تشمل الطوارئ، المستشفيات، الطعام، المال، النقل، وخدمات مفيدة أخرى." },
  aboutEn3: { en: "It also lets users suggest new numbers and send feedback so the database stays useful and up to date.", ar: "كما يتيح للمستخدمين اقتراح أرقام جديدة وإرسال الملاحظات حتى تظل قاعدة البيانات مفيدة ومحدثة." },
  quickServicesTitle: { en: "Quick services", ar: "الخدمات السريعة" },
  quickServicesPromoteShort: { en: "Promote to view business plans.", ar: "⁦Promote⁩ لعرض باقات الظهور للأعمال." },
  quickServicesPromoteLong: { en: "Promote to explore featured, verified, and premium business plans.", ar: "⁦Promote⁩ لعرض باقات الظهور المميز والتوثيق للأعمال." },
  quickServicesAddShort: { en: "Add Number to suggest a new number.", ar: "⁦Add Number⁩ لإضافة رقم أو جهة جديدة." },
  quickServicesAddLong: { en: "Add Number to send a new hotline or suggest a new listing.", ar: "⁦Add Number⁩ لإضافة رقم جديد أو اقتراح جهة جديدة داخل التطبيق." },
  quickServicesContactShort: { en: "Contact us to send a note or suggestion.", ar: "⁦Contact us⁩ لإرسال ملاحظة أو اقتراح." },
  quickServicesContactLong: { en: "Contact us to send a note or suggestion that helps us improve the service.", ar: "⁦Contact us⁩ لإرسال ملاحظة أو اقتراح يساعدنا في تحسين الخدمة." },
  gotIt: { en: "Got it", ar: "فهمت" },
  hotlineAssistantLabel: { en: "Hotline Assistant", ar: "مساعد Hotline" },
  typing: { en: "Typing...", ar: "جارٍ الكتابة..." },
  assistantLanguageArabic: { en: "Arabic", ar: "العربية" },
  assistantLanguageEnglish: { en: "English", ar: "الإنجليزية" },
  featuredBadgeSmall: { en: "Featured", ar: "مميزة" },
  verifiedBadgeSmall: { en: "Verified", ar: "موثقة" },
  selectedPlanSuffix: { en: "plan", ar: "باقة" },
  addressLabel: { en: "Address", ar: "العنوان" },
  detailsLabel: { en: "Details", ar: "تفاصيل" },
  emailLabel: { en: "Email", ar: "البريد الإلكتروني" },
  websiteLabel: { en: "Website", ar: "الموقع الإلكتروني" },
  viewOnMap: { en: "View on map", ar: "عرض على الخريطة" },
  openWebsite: { en: "Open website", ar: "فتح الموقع" },
  sendEmail: { en: "Send email", ar: "إرسال بريد" },
  embassySpotlight: { en: "Diplomatic contact in Egypt", ar: "جهة دبلوماسية داخل مصر" }
  ,
  loadingCachedData: { en: "Showing the local cached copy of the data right now.", ar: "يتم عرض نسخة محلية من البيانات حالياً." },
  loadingSavedData: { en: "Showing the latest saved copy of the data right now.", ar: "يتم عرض آخر نسخة محفوظة من البيانات حالياً." },
  loadingFailedSaved: { en: "Could not load live data. Showing the latest saved copy.", ar: "تعذر تحميل البيانات المباشرة. يتم عرض آخر نسخة محفوظة." },
  errorTitle: { en: "Error", ar: "خطأ" },
  doneTitle: { en: "Done", ar: "تم" },
  missingDataTitle: { en: "Missing Data", ar: "بيانات ناقصة" },
  missingMessageTitle: { en: "Missing Message", ar: "الرسالة ناقصة" },
  invalidContactTitle: { en: "Invalid Contact", ar: "وسيلة تواصل غير صحيحة" },
  missingNameAndNumber: { en: "Please enter both name and hotline number.", ar: "يرجى إدخال اسم الجهة والرقم معًا." },
  missingNameAndNumberCompact: { en: "Enter the name and number.", ar: "أدخل الاسم والرقم." },
  requestSent: { en: "Your request was sent successfully.", ar: "تم إرسال طلبك بنجاح." },
  requestSentCompact: { en: "Request sent successfully.", ar: "تم الإرسال بنجاح." },
  failedToSendRequest: { en: "Failed to send request.", ar: "تعذر إرسال الطلب." },
  serverSlow: { en: "Server is taking too long to respond. If you are using Render free tier, wait a few seconds and try again.", ar: "الخادم يستغرق وقتًا أطول من المعتاد. إذا كنت تستخدم Render المجانية، انتظر بضع ثوانٍ ثم حاول مرة أخرى." },
  writeSuggestionFirst: { en: "Please write your suggestion first.", ar: "يرجى كتابة اقتراحك أولًا." },
  writeSuggestionFirstCompact: { en: "Write your suggestion first.", ar: "اكتب اقتراحك أولًا." },
  writeMessageFirst: { en: "Please write your message first.", ar: "يرجى كتابة رسالتك أولًا." },
  writeMessageFirstCompact: { en: "Write your message first.", ar: "اكتب رسالتك أولًا." },
  messageSentDirectly: { en: "Your message was sent directly to our team successfully.", ar: "تم إرسال رسالتك مباشرة إلى فريقنا بنجاح." },
  writeAnotherMessage: { en: "Write another message", ar: "اكتب رسالة أخرى" },
  supportServerSlow: { en: "The support server is taking longer than usual right now. Because we use a free backend, please wait a few seconds and try sending again.", ar: "خادم الدعم يتأخر الآن أكثر من المعتاد. لأننا نستخدم خادمًا مجانيًا، انتظر بضع ثوانٍ ثم حاول الإرسال مرة أخرى." },
  supportServerSlowRetry: { en: "The support server is taking longer than usual right now. Since we are using a free backend, please wait a few seconds and try again.", ar: "خادم الدعم يتأخر الآن أكثر من المعتاد. لأننا نستخدم خادمًا مجانيًا، انتظر بضع ثوانٍ ثم حاول مرة أخرى." },
  tryAgain: { en: "Try again", ar: "حاول مرة أخرى" },
  thanksMessageSent: { en: "Thanks, your message was sent to our team successfully.", ar: "شكرًا، تم إرسال رسالتك إلى فريقنا بنجاح." },
  enterBusinessBasics: { en: "Please enter your name, business name, and phone or WhatsApp number.", ar: "يرجى إدخال اسمك واسم النشاط ورقم الهاتف أو واتساب." },
  enterBusinessBasicsCompact: { en: "Enter your name, business, and contact.", ar: "أدخل اسمك واسم النشاط ووسيلة التواصل." },
  validPhoneRequired: { en: "Please enter a valid phone or WhatsApp number so we can contact you.", ar: "يرجى إدخال رقم هاتف أو واتساب صحيح حتى نتمكن من التواصل معك." },
  validPhoneRequiredCompact: { en: "Enter a valid phone or WhatsApp number.", ar: "أدخل رقم هاتف أو واتساب صحيح." },
  businessRequestSent: { en: "Your business request was sent successfully.", ar: "تم إرسال طلبك التجاري بنجاح." },
  businessRequestSentCompact: { en: "Business request sent successfully.", ar: "تم إرسال الطلب التجاري بنجاح." },
  failedToSendBusinessRequest: { en: "Failed to send business request.", ar: "تعذر إرسال الطلب التجاري." },
  writeYourRequest: { en: "Write your request", ar: "اكتب طلبك" }
};

function detectDeviceLanguage() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
    return String(locale).toLowerCase().startsWith("ar") ? "ar" : "en";
  } catch {
    return "ar";
  }
}

function getGroupTitle(key, language) {
  const group = GROUP_LABELS[key];
  if (!group) return "";
  return language === "ar" ? group.titleAr : group.titleEn;
}

function getGroupSubtitle(key, language) {
  const group = GROUP_LABELS[key];
  if (!group) return "";
  return language === "ar" ? group.subtitleAr : group.subtitleEn;
}

function getCategoryDisplayName(slug, fallbackAr, language) {
  const translated = CATEGORY_TRANSLATIONS[slug];
  if (translated) {
    return language === "ar" ? translated.ar : translated.en;
  }
  return fallbackAr || "";
}

const EMBASSY_COUNTRY_TRANSLATIONS = {
  afghanistan: { en: "Afghanistan", ar: "أفغانستان" },
  albania: { en: "Albania", ar: "ألبانيا" },
  algeria: { en: "Algeria", ar: "الجزائر" },
  "american-samoa": { en: "American Samoa", ar: "ساموا الأمريكية" },
  angola: { en: "Angola", ar: "أنغولا" },
  anguilla: { en: "Anguilla", ar: "أنغويلا" },
  "antigua-barbuda": { en: "Antigua and Barbuda", ar: "أنتيغوا وباربودا" },
  argentina: { en: "Argentina", ar: "الأرجنتين" },
  armenia: { en: "Armenia", ar: "أرمينيا" },
  aruba: { en: "Aruba", ar: "أروبا" },
  australia: { en: "Australia", ar: "أستراليا" },
  austria: { en: "Austria", ar: "النمسا" },
  azerbaijan: { en: "Azerbaijan", ar: "أذربيجان" },
  bahamas: { en: "Bahamas", ar: "الباهاما" },
  bahrain: { en: "Bahrain", ar: "البحرين" },
  bangladesh: { en: "Bangladesh", ar: "بنغلاديش" },
  barbados: { en: "Barbados", ar: "بربادوس" },
  belarus: { en: "Belarus", ar: "بيلاروسيا" },
  belgium: { en: "Belgium", ar: "بلجيكا" },
  bermuda: { en: "Bermuda", ar: "برمودا" },
  bolivia: { en: "Bolivia", ar: "بوليفيا" },
  "bosnia-herzegovina": { en: "Bosnia and Herzegovina", ar: "البوسنة والهرسك" },
  botswana: { en: "Botswana", ar: "بوتسوانا" },
  brazil: { en: "Brazil", ar: "البرازيل" },
  "british-virgin-islands": { en: "British Virgin Islands", ar: "جزر فيرجن البريطانية" },
  "brunei-darussalam": { en: "Brunei Darussalam", ar: "بروناي دار السلام" },
  bulgaria: { en: "Bulgaria", ar: "بلغاريا" },
  "burkina-faso": { en: "Burkina Faso", ar: "بوركينا فاسو" }
};

function formatCountrySlugEn(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getEmbassyCountrySlug(contact) {
  const sourceUrl = String(contact?.source_url || "");
  const match = sourceUrl.match(/\/en\/([^/]+)\/embassy\/egypt\/?$/i);
  return match ? match[1].toLowerCase() : "";
}

function getEmbassyCountryName(contact, language) {
  const slug = getEmbassyCountrySlug(contact);
  if (!slug) return "";
  const translated = EMBASSY_COUNTRY_TRANSLATIONS[slug];
  if (translated) return language === "ar" ? translated.ar : translated.en;
  return formatCountrySlugEn(slug);
}

function getContactDisplayName(contact, language) {
  if (contact?.category_slug === "embassies") {
    const countryName = getEmbassyCountryName(contact, language);
    if (countryName) {
      return language === "ar" ? `سفارة ${countryName}` : `${countryName} Embassy`;
    }
  }
  return String(contact?.name_ar || "").trim();
}

function isEmbassyContact(contact) {
  return contact?.category_slug === "embassies";
}

function getContactSearchTexts(contact) {
  const baseName = String(contact?.name_ar || "").trim();
  const texts = new Set([baseName]);
  const embassyAr = getContactDisplayName(contact, "ar");
  const embassyEn = getContactDisplayName(contact, "en");
  if (embassyAr) texts.add(embassyAr);
  if (embassyEn) texts.add(embassyEn);
  return [...texts].filter(Boolean);
}

function contactMatchesQuery(contact, normalizedQuery, rawQuery) {
  if (!normalizedQuery && !rawQuery) return false;
  const categoryName = normalizeText(contact?.category_name_ar);
  const matchesName = getContactSearchTexts(contact).some((text) => normalizeText(text).includes(normalizedQuery));
  return matchesName || categoryName.includes(normalizedQuery) || String(contact?.phone || "").includes(rawQuery);
}

function extractContactPhones(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const parts = raw
    .split(/[\n|;]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

function getContactLogoUrl(contact) {
  const value = String(contact?.logo_url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return "";
}

function applyHexAlpha(color, alphaHex) {
  const raw = String(color || "").trim();
  if (!/^#([0-9a-f]{6})$/i.test(raw)) return raw;
  return `${raw}${alphaHex}`;
}

function generateAnonymousSenderId() {
  return `support_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getEmergencyVisual(contact) {
  if (contact?.category_slug !== "emergency") return null;
  const name = normalizeText(contact?.name_ar);
  if (name.includes("اسعاف")) {
    return { icon: "medical-outline", fg: "#ec4899", bg: "rgba(236,72,153,0.10)" };
  }
  if (name.includes("نجده") || name.includes("شرطه") || name.includes("شرطة")) {
    return { icon: "shield-checkmark-outline", fg: "#2563eb", bg: "rgba(37,99,235,0.10)" };
  }
  if (name.includes("مطافي") || name.includes("مطافئ") || name.includes("حريق")) {
    return { icon: "flame-outline", fg: "#ea580c", bg: "rgba(234,88,12,0.10)" };
  }
  if (name.includes("كهرب")) {
    return { icon: "flash-outline", fg: "#eab308", bg: "rgba(234,179,8,0.12)" };
  }
  if (name.includes("غاز")) {
    return { icon: "warning-outline", fg: "#dc2626", bg: "rgba(220,38,38,0.10)" };
  }
  if (name.includes("مياه") || name.includes("مياه")) {
    return { icon: "water-outline", fg: "#0891b2", bg: "rgba(8,145,178,0.10)" };
  }
  return { icon: "alert-circle-outline", fg: "#d0004f", bg: "rgba(208,0,79,0.10)" };
}

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
  if (n.includes("سيارات") || n.includes("نقل") || n.includes("مواصلات") || n.includes("طيران") || n.includes("سفر") || n.includes("وقود")) return "mobility";
  if (n.includes("رياض") || n.includes("جيم") || n.includes("ملابس رياضي") || n.includes("اجهزه رياضي") || n.includes("مكملات")) return "sports";
  if (n.includes("سفارات") || n.includes("سياحي") || n.includes("مطارات") || n.includes("ترجمه") || n.includes("اجانب")) return "foreign";
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
  retail: { set: "mci", name: "toolbox-outline", color: "#8b5cf6" },
  sports: { set: "ion", name: "fitness", color: "#f97316" },
  foreign: { set: "ion", name: "globe-outline", color: "#0f766e" }
};
const GROUP_COLORS = {
  gov: { accent: "#ef4444", card: "#fde2e2", cardActive: "#f9c9c9", darkCard: "#5a2632", darkCardActive: "#743041" },
  health: { accent: "#ec4899", card: "#fde1ef", cardActive: "#f9c7e0", darkCard: "#5d2743", darkCardActive: "#783258" },
  food: { accent: "#f59e0b", card: "#feedd1", cardActive: "#f9ddb0", darkCard: "#5b401f", darkCardActive: "#755327" },
  finance: { accent: "#0ea5e9", card: "#dcedfb", cardActive: "#c2e2fb", darkCard: "#22475d", darkCardActive: "#2a5f79" },
  mobility: { accent: "#22c55e", card: "#deefe0", cardActive: "#cae8d0", darkCard: "#275244", darkCardActive: "#316a58" },
  retail: { accent: "#8b5cf6", card: "#ebe0ff", cardActive: "#dbcafc", darkCard: "#40305f", darkCardActive: "#523d7a" },
  sports: { accent: "#f97316", card: "#ffe7d6", cardActive: "#ffd3b5", darkCard: "#5a3426", darkCardActive: "#754332" },
  foreign: { accent: "#0f766e", card: "#dbf4ef", cardActive: "#c4eae2", darkCard: "#23514b", darkCardActive: "#2d6961" }
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
  education: "retail",
  sportswear: "sports",
  gym: "sports",
  "sports-equipment": "sports",
  "sports-clubs": "sports",
  supplements: "sports",
  embassies: "foreign",
  "tourist-attractions": "foreign",
  airports: "foreign",
  "translation-services": "foreign",
  "travel-agencies": "foreign",
  "visitor-hotels": "foreign",
  "foreign-medical": "foreign"
};
const CATEGORY_ORDER_BY_GROUP = {
  retail: {
    "mobile-internet": 1,
    appliances: 2,
    apps: 3
  },
  sports: {
    sportswear: 1,
    gym: 2,
    "sports-equipment": 3,
    supplements: 4,
    "sports-clubs": 5
  },
  foreign: {
    embassies: 1,
    "tourist-attractions": 2,
    "translation-services": 3,
    "travel-agencies": 4,
    "tourist-help": 5,
    "residency-immigration": 6
  }
};
const CATEGORY_TRANSLATIONS = {
  emergency: { en: "Emergency", ar: "طوارئ" },
  hospitals: { en: "Hospitals", ar: "مستشفيات" },
  labs: { en: "Labs", ar: "معامل" },
  pharmacies: { en: "Pharmacies", ar: "صيدليات" },
  restaurants: { en: "Restaurants", ar: "مطاعم" },
  "cafes-desserts": { en: "Cafes & Desserts", ar: "كافيهات وحلويات" },
  banks: { en: "Banks", ar: "بنوك" },
  "finance-payments": { en: "Finance & Payments", ar: "مدفوعات وتمويل" },
  "mobile-internet": { en: "Mobile & Internet", ar: "محمول وإنترنت" },
  shipping: { en: "Shipping", ar: "شحن" },
  "auto-service": { en: "Auto Service", ar: "خدمات السيارات" },
  airlines: { en: "Airlines", ar: "طيران" },
  furniture: { en: "Furniture", ar: "أثاث" },
  appliances: { en: "Appliances", ar: "أجهزة منزلية" },
  supermarkets: { en: "Supermarkets & Malls", ar: "سوبر ماركت ومولات" },
  hotels: { en: "Hotels", ar: "فنادق" },
  realestate: { en: "Real Estate", ar: "عقارات" },
  apps: { en: "Apps & Digital Services", ar: "تطبيقات وخدمات رقمية" },
  charity: { en: "Charities", ar: "جمعيات خيرية" },
  syndicates: { en: "Syndicates", ar: "نقابات" },
  education: { en: "Education", ar: "تعليم" },
  sportswear: { en: "Sportswear", ar: "ملابس رياضية" },
  gym: { en: "Gyms", ar: "جيم" },
  "sports-equipment": { en: "Sports Equipment", ar: "أجهزة رياضية" },
  "sports-clubs": { en: "Sports Clubs", ar: "أندية رياضية" },
  supplements: { en: "Supplements", ar: "مكملات غذائية" },
  embassies: { en: "Embassies", ar: "سفارات" },
  "tourist-attractions": { en: "Tourist Attractions", ar: "مزارات سياحية" },
  "translation-services": { en: "Translation Services", ar: "خدمات ترجمة" },
  "travel-agencies": { en: "Travel Agencies", ar: "شركات سياحة" },
  "tourist-help": { en: "Tourist Help", ar: "مساعدة سياحية" },
  "residency-immigration": { en: "Residency & Immigration", ar: "إقامة وهجرة" }
};
const VIRTUAL_CATEGORY_DEFINITIONS = [
  { slug: "sportswear", group: "sports" },
  { slug: "gym", group: "sports" },
  { slug: "sports-equipment", group: "sports" },
  { slug: "supplements", group: "sports" },
  { slug: "sports-clubs", group: "sports" },
  { slug: "embassies", group: "foreign" },
  { slug: "tourist-attractions", group: "foreign" },
  { slug: "translation-services", group: "foreign" },
  { slug: "travel-agencies", group: "foreign" },
  { slug: "tourist-help", group: "foreign" },
  { slug: "residency-immigration", group: "foreign" }
];
const CONTACT_ASSISTANT_TOPICS = [
  {
    key: "greeting",
    questionEn: "Hello",
    questionAr: "السلام عليكم",
    answerEn: "Hello and welcome. I’m here to help you with search, adding numbers, business promotion, and support inside the app.",
    answerAr: "وعليكم السلام وأهلاً بك. أنا هنا لمساعدتك في البحث، وإضافة الأرقام، وترويج النشاط، والدعم داخل التطبيق."
  },
  {
    key: "compliment",
    questionEn: "You are helpful",
    questionAr: "أنت رائع",
    answerEn: "Thank you. I’m glad to help, and I’ll do my best to support you clearly and respectfully.",
    answerAr: "شكرًا لك. يسعدني أن أساعدك، وسأبذل أفضل ما عندي لدعمك بوضوح واحترام."
  },
  {
    key: "thanks",
    questionEn: "Thank you",
    questionAr: "شكرًا",
    answerEn: "You’re welcome. If you need anything else, I’m here to help.",
    answerAr: "العفو. إذا احتجت أي شيء آخر فأنا هنا للمساعدة."
  },
  {
    key: "assistant-about",
    questionEn: "Who are you?",
    questionAr: "أنت مين؟",
    answerEn: "I’m the Hotline App smart assistant. My role is to guide you inside the app, answer common questions, and help you reach the right action quickly.",
    answerAr: "أنا المساعد الذكي لتطبيق Hotline App. دوري أن أوجّهك داخل التطبيق، وأجيب عن الأسئلة الشائعة، وأساعدك للوصول للخطوة المناسبة بسرعة."
  },
  {
    key: "assistant-contact",
    questionEn: "How do I contact the app team?",
    questionAr: "كيف أتواصل مع البرنامج؟",
    answerEn: "You can write your request here and press Send request. If you want us to contact you, include your phone number or email in the message.",
    answerAr: "يمكنك كتابة طلبك هنا ثم الضغط على إرسال الطلب. وإذا كنت تريد أن نتواصل معك، أضف رقم هاتفك أو بريدك الإلكتروني داخل الرسالة."
  },
  {
    key: "callback-request",
    questionEn: "Please contact me",
    questionAr: "أريد أن تتواصلوا معي",
    answerEn: "Sure. Write your request and include your phone number or email, then press Send request so our team can review it and contact you if needed.",
    answerAr: "بالتأكيد. اكتب طلبك وأضف رقم هاتفك أو بريدك الإلكتروني، ثم اضغط على إرسال الطلب ليقوم فريقنا بمراجعته والتواصل معك إذا لزم الأمر.",
    action: "focus-message",
    actionLabelEn: "Write your request",
    actionLabelAr: "اكتب طلبك"
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
      "اهلين",
      "أهلين",
      "اهلا بيك",
      "اهلا وسهلا",
      "اهلا يا",
      "مرحبا",
      "مرحبًا",
      "صباح الخير",
      "صباح الفل",
      "صباح الورد",
      "مساء الخير",
      "مساء النور",
      "hello",
      "hi",
      "hey",
      "good afternoon",
      "good morning",
      "good evening"
    ]
  },
  {
    topicKey: "compliment",
    keywords: [
      "انت جميل",
      "أنت جميل",
      "انت محترم",
      "أنت محترم",
      "انت رائع",
      "أنت رائع",
      "انت ممتاز",
      "أنت ممتاز",
      "انت كويس",
      "أنت كويس",
      "good bot",
      "nice bot",
      "smart bot",
      "you are great",
      "you are helpful",
      "you are nice"
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
    topicKey: "assistant-about",
    keywords: [
      "انت مين",
      "أنت مين",
      "بتعمل ايه",
      "بتعمل إيه",
      "دورك ايه",
      "دورك إيه",
      "بتفيدني ازاي",
      "بتفيدني إزاي",
      "اقدر استفيد ازاي",
      "اقدر استفيد ازاي منك",
      "اخبارك ايه",
      "أخبارك إيه",
      "طمني عليك",
      "مين حضرتك",
      "who are you",
      "what do you do",
      "what is your role",
      "how can you help me",
      "how can you benefit me",
      "how are you"
    ]
  },
  {
    topicKey: "assistant-contact",
    keywords: [
      "ازاي اتواصل مع البرنامج",
      "ازاي اتواصل مع التطبيق",
      "كيف اتواصل مع البرنامج",
      "كيف اتواصل مع التطبيق",
      "اتواصل معاكم ازاي",
      "اتواصل معكم ازاي",
      "كيف اتواصل معكم",
      "contact the app",
      "contact the team",
      "how do i contact you",
      "how can i contact the app"
    ]
  },
  {
    topicKey: "callback-request",
    keywords: [
      "كلموني",
      "كلموني لو سمحت",
      "اريد التواصل",
      "عايز حد يكلمني",
      "عاوز حد يكلمني",
      "تواصلوا معي",
      "اتصلوا بي",
      "اتصلو بيا",
      "كلمني",
      "هاتواصل ازاي",
      "contact me",
      "call me",
      "reach me",
      "get back to me"
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
      "غبي",
      "وحش",
      "سيء",
      "سيئ",
      "مش عاجبني",
      "مش كويس",
      "bad",
      "awful",
      "terrible",
      "stupid",
      "useless",
      "annoying"
    ]
  }
];
const introLocal = require("./assets/intro.png");
const appLogoFallback = require("./assets/adaptive-icon.png");
const CONTACTS_CACHE_PATH = `${FileSystem.cacheDirectory}contacts-cache.json`;
const SUGGEST_HINT_PATH = `${FileSystem.documentDirectory}suggest-hint-seen.txt`;
const ANONYMOUS_SENDER_ID_PATH = `${FileSystem.documentDirectory}anonymous-sender-id.txt`;
const THEME_PREFERENCE_PATH = `${FileSystem.documentDirectory}theme-preference.txt`;
const THEME_PREFERENCES = ["system", "light", "dark"];
const EXPO_PROJECT_ID = "ad40b21c-50ba-4e75-81ed-b21f3df612d6";
const ANDROID_BANNER_AD_UNIT_ID = "ca-app-pub-1118900297282275/5079356887";
const ASSISTANT_LOOKUP_STOP_WORDS = [
  "رقم",
  "الرقم",
  "ارقام",
  "أرقام",
  "نمره",
  "نمرة",
  "تليفون",
  "هاتف",
  "خدمه",
  "خدمة",
  "الخدمه",
  "الخدمة",
  "العملاء",
  "عملاء",
  "خدمة العملاء",
  "خط",
  "ساخن",
  "الخط",
  "الساخن",
  "طوارئ",
  "رقم الطوارئ",
  "محتاج",
  "عايز",
  "عاوز",
  "اريد",
  "أريد",
  "احتاج",
  "أحتاج",
  "لو",
  "سمحت",
  "لو سمحت",
  "من",
  "فضلك",
  "هل",
  "هو",
  "هي",
  "في",
  "فيه",
  "فيها",
  "موجود",
  "موجوده",
  "موجودة",
  "او",
  "أو",
  "ولا",
  "ولا لا",
  "للخدمة",
  "للخدمه",
  "للشركة",
  "للشركه",
  "للشركة",
  "what",
  "is",
  "the",
  "number",
  "phone",
  "hotline",
  "customer",
  "service",
  "contact",
  "line",
  "emergency",
  "do",
  "you",
  "have",
  "is there",
  "exists",
  "available",
  "for",
  "of",
  "please",
  "need",
  "want",
  "i",
  "me",
  "tell",
  "find",
  "give",
  "give me"
];
const ASSISTANT_GENERIC_HELP_TOKENS = [
  "ساعدني",
  "ساعدنى",
  "ساعد",
  "مساعده",
  "مساعدة",
  "help",
  "help me",
  "عايز",
  "عاوز",
  "محتاج",
  "اريد",
  "أريد",
  "احتاج",
  "أحتاج",
  "لو سمحت",
  "من فضلك",
  "please"
];
const ASSISTANT_LOOKUP_ALIASES = [
  { patterns: ["المطافي", "مطافي", "المطافي", "مطافي", "اطفاء", "إطفاء", "حريق", "الحمايه المدنيه", "الحماية المدنية"], replacement: "المطافئ" },
  { patterns: ["النجده", "نجده", "النجدة", "نجدة", "الشرطه", "الشرطة"], replacement: "شرطة النجدة" },
  { patterns: ["الاسعاف", "اسعاف", "الإسعاف", "إسعاف"], replacement: "هيئة الإسعاف المصرية" },
  { patterns: ["فودافون", "فودافو", "vodafone"], replacement: "فودافون مصر" },
  { patterns: ["اتصالات", "اتصلات", "etisalat"], replacement: "اتصالات مصر" },
  { patterns: ["وي", "we"], replacement: "المصرية للاتصالات we" }
];

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyAssistantAliases(value) {
  let normalizedValue = normalizeText(value);
  ASSISTANT_LOOKUP_ALIASES.forEach((alias) => {
    alias.patterns.forEach((pattern) => {
      const normalizedPattern = normalizeText(pattern);
      if (!normalizedPattern) return;
      normalizedValue = normalizedValue.replace(
        new RegExp(`\\b${escapeRegExp(normalizedPattern)}\\b`, "g"),
        normalizeText(alias.replacement)
      );
    });
  });
  return normalizedValue.replace(/\s+/g, " ").trim();
}

function buildAssistantLookupQuery(message) {
  let cleaned = normalizeText(message);
  const requestPrefixes = [
    "عايز رقم",
    "عاوز رقم",
    "محتاج رقم",
    "اريد رقم",
    "أريد رقم",
    "احتاج رقم",
    "أحتاج رقم",
    "ساعدني في رقم",
    "ساعدنى في رقم",
    "رقم",
    "number of",
    "number for",
    "phone number for",
    "phone number of",
    "need a number for",
    "need number for",
    "what is the number of"
  ];

  requestPrefixes.forEach((prefix) => {
    const normalizedPrefix = normalizeText(prefix);
    if (cleaned.startsWith(`${normalizedPrefix} `)) {
      cleaned = cleaned.slice(normalizedPrefix.length).trim();
    } else if (cleaned === normalizedPrefix) {
      cleaned = "";
    }
  });

  ASSISTANT_LOOKUP_STOP_WORDS.forEach((word) => {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegExp(normalizeText(word))}\\b`, "g"), " ");
  });
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return applyAssistantAliases(cleaned);
}

function hasMeaningfulTokenOverlap(query, candidate) {
  const queryWords = normalizeText(query).split(" ").filter((word) => word.length >= 2);
  const candidateWords = normalizeText(candidate).split(" ").filter((word) => word.length >= 2);
  if (!queryWords.length || !candidateWords.length) return false;

  return queryWords.some((queryWord) =>
    candidateWords.some(
      (candidateWord) =>
        candidateWord.startsWith(queryWord) ||
        queryWord.startsWith(candidateWord) ||
        candidateWord.includes(queryWord) ||
        queryWord.includes(candidateWord)
    )
  );
}

function isGenericLookupQuery(query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;

  const words = normalizedQuery.split(" ").filter(Boolean);
  if (!words.length) return true;

  return words.every((word) =>
    ASSISTANT_GENERIC_HELP_TOKENS.some((token) => {
      const normalizedToken = normalizeText(token);
      return (
        word === normalizedToken ||
        normalizedToken.includes(word) ||
        word.includes(normalizedToken)
      );
    })
  );
}

function isAssistantLookupRequest(message) {
  const normalized = normalizeText(message);
  return [
    "رقم",
    "نمره",
    "نمرة",
    "هاتف",
    "تليفون",
    "خدمة العملاء",
    "خط ساخن",
    "طوارئ",
    "number",
    "phone",
    "hotline",
    "customer service",
    "emergency",
    "موجود",
    "موجوده",
    "موجودة",
    "exists",
    "available"
  ].some((phrase) => normalized.includes(normalizeText(phrase)));
}

function getAssistantLookupReply(message, contacts) {
  const normalized = normalizeText(message);
  if (!normalized || !Array.isArray(contacts) || !contacts.length) return null;

  const asksForNumber = [
    "رقم",
    "نمره",
    "نمرة",
    "هاتف",
    "تليفون",
    "خدمة العملاء",
    "خط ساخن",
    "طوارئ",
    "number",
    "phone",
    "hotline",
    "customer service",
    "emergency"
  ].some((phrase) => normalized.includes(normalizeText(phrase)));

  const asksIfExists = [
    "موجود",
    "موجوده",
    "موجودة",
    "ولا لا",
    "هل",
    "exists",
    "available",
    "do you have",
    "is there"
  ].some((phrase) => normalized.includes(normalizeText(phrase)));

  const asksWhereCategoryIs = [
    "فين",
    "مكان",
    "فئة",
    "قسم",
    "تصنيف",
    "category",
    "section",
    "where",
    "which category"
  ].some((phrase) => normalized.includes(normalizeText(phrase)));

  const lookupQuery = buildAssistantLookupQuery(message);
  const asksGenericNumberOnly =
    asksForNumber &&
    (
      [
        "رقم",
        "عايز رقم",
        "عاوز رقم",
        "محتاج رقم",
        "اريد رقم",
        "أريد رقم",
        "احتاج رقم",
        "أحتاج رقم",
        "ساعدني في رقم",
        "ساعدنى في رقم",
        "need a number",
        "i need a number",
        "want a number",
        "need hotline"
      ].some((phrase) => normalized === normalizeText(phrase)) ||
      !lookupQuery ||
      isGenericLookupQuery(lookupQuery)
    );

  if (((!lookupQuery || lookupQuery.length < 2) || isGenericLookupQuery(lookupQuery)) && (asksForNumber || asksIfExists || asksWhereCategoryIs)) {
    return {
      answerEn:
        "Which service do you need exactly? Write the service name and I’ll try to find its number or category for you.",
      answerAr:
        asksGenericNumberOnly
          ? "عايز رقم أي خدمة؟"
          : "أي خدمة تحتاجها تحديدًا؟ اكتب اسم الخدمة وسأحاول إيجاد رقمها أو الفئة الموجودة فيها."
    };
  }
  if (!lookupQuery || lookupQuery.length < 2) return null;

  const lookupWords = lookupQuery.split(" ").filter(Boolean);
  let best = null;
  let bestScore = 0;
  const rankedMatches = [];

  contacts.forEach((contact) => {
    const displayNameEn = getContactDisplayName(contact, "en");
    const displayNameAr = getContactDisplayName(contact, "ar");
    const normalizedName = normalizeText(displayNameEn);
    const normalizedAltName = normalizeText(displayNameAr);
    const normalizedCategory = normalizeText(contact?.category_name_ar);
    const aliasedName = applyAssistantAliases(displayNameEn);
    const aliasedAltName = applyAssistantAliases(displayNameAr);
    const aliasedCategory = applyAssistantAliases(contact?.category_name_ar);
    if (!normalizedName) return;

    let score = 0;
    if (normalizedName === lookupQuery) score += 12;
    if (normalizedName.includes(lookupQuery)) score += 10;
    if (lookupQuery.includes(normalizedName)) score += 7;
    if (normalizedAltName === lookupQuery) score += 12;
    if (normalizedAltName.includes(lookupQuery)) score += 10;
    if (lookupQuery.includes(normalizedAltName)) score += 7;
    if (normalizedCategory && normalizedCategory.includes(lookupQuery)) score += 3;
    if (aliasedName === lookupQuery) score += 12;
    if (aliasedName.includes(lookupQuery)) score += 10;
    if (lookupQuery.includes(aliasedName)) score += 7;
    if (aliasedAltName === lookupQuery) score += 12;
    if (aliasedAltName.includes(lookupQuery)) score += 10;
    if (lookupQuery.includes(aliasedAltName)) score += 7;
    if (aliasedCategory && aliasedCategory.includes(lookupQuery)) score += 3;

    const matchedWords = lookupWords.filter(
      (word) =>
        normalizedName.includes(word) ||
        normalizedAltName.includes(word) ||
        normalizedCategory.includes(word) ||
        aliasedName.includes(word) ||
        aliasedAltName.includes(word) ||
        aliasedCategory.includes(word) ||
        normalizedName.split(" ").some((nameWord) => nameWord.includes(word) || word.includes(nameWord))
    ).length;

    score += matchedWords * 2;

    if (contact?.is_national) score += 0.6;
    if (contact?.is_verified) score += 0.3;

    if (score > bestScore) {
      bestScore = score;
      best = contact;
    }
    if (score > 0) {
      rankedMatches.push({ contact, score });
    }
  });

  if (!best || bestScore < 3.5) {
    if (!asksForNumber && !asksIfExists) return null;
    const suggestions = rankedMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => getContactDisplayName(item.contact, "ar"))
      .filter(Boolean);

    let closestName = "";
    let closestContact = null;
    let closestDistance = 999;
    contacts.forEach((contact) => {
      const contactName = getContactDisplayName(contact, "en");
      const contactNameAr = getContactDisplayName(contact, "ar");
      if (!contactName) return;
      const distance = Math.min(
        levenshtein(lookupQuery, contactName),
        levenshtein(lookupQuery, applyAssistantAliases(contactName)),
        levenshtein(lookupQuery, contactNameAr),
        levenshtein(lookupQuery, applyAssistantAliases(contactNameAr))
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestName = contactName;
        closestContact = contact;
      }
    });

    const closeEnoughForCorrection =
      closestName &&
      closestContact &&
      closestDistance <= Math.max(2, Math.floor(lookupQuery.length / 4)) &&
      hasMeaningfulTokenOverlap(lookupQuery, closestName);

    if (closeEnoughForCorrection && closestContact?.phone) {
      const correctedGroupKey = resolveGroupForCategory(closestContact);
      const correctedGroupTitle = getGroupTitle(correctedGroupKey, "en") || "Services";
      const correctedGroupTitleAr = getGroupTitle(correctedGroupKey, "ar") || "خدمات";
      const correctedCategoryTitleAr = closestContact.category_name_ar || correctedGroupTitleAr;
      const correctedNameEn = getContactDisplayName(closestContact, "en");
      const correctedNameAr = getContactDisplayName(closestContact, "ar");
      return {
        answerEn: `Did you mean ${correctedNameEn}? Its number is ${closestContact.phone}. You can also find it inside ${correctedGroupTitle} / ${closestContact.category_name_ar}.`,
        answerAr: `هل تقصد ${correctedNameAr}؟ رقمه هو ${closestContact.phone}. ويمكنك أيضًا العثور عليه داخل فئة ${correctedGroupTitleAr} / ${correctedCategoryTitleAr}.`
      };
    }

    const didYouMeanAr = closeEnoughForCorrection ? ` هل تقصد ${closestName}؟` : "";
    const didYouMeanEn = closeEnoughForCorrection ? ` Did you mean ${closestName}?` : "";

    const suggestionTextAr = suggestions.length
      ? ` أقرب اقتراحات لطلبك: ${suggestions.join("، ")}.`
      : "";
    const suggestionTextEn = suggestions.length
      ? ` Closest suggestions I found: ${suggestions.join(", ")}.`
      : "";

    if (!suggestions.length && !closeEnoughForCorrection) {
      return {
        answerEn:
          "I couldn’t match a clear service name yet. Tell me the exact service you need and I’ll try again.",
        answerAr:
          "لم أستطع مطابقة اسم خدمة واضح حتى الآن. اكتب اسم الخدمة بشكل أقرب وسأحاول مرة أخرى."
      };
    }

    return {
      answerEn:
        `I couldn’t find this number in the current app data.${didYouMeanEn}${suggestionTextEn} You can add it through Add Number and we will review it.`,
      answerAr:
        `لم أجد هذا الرقم في البيانات الحالية داخل التطبيق.${didYouMeanAr}${suggestionTextAr} يمكنك إضافته من خلال Add Number وسنراجعه.`,
      action: "add-number",
      actionLabelEn: "Open Add Number",
      actionLabelAr: "افتح إضافة رقم"
    };
  }

  const topMatches = rankedMatches
    .sort((a, b) => b.score - a.score)
    .filter((item, index, arr) => index === arr.findIndex((entry) => entry.contact?.id === item.contact?.id))
    .slice(0, 3);

  if (topMatches.length > 1 && topMatches[1].score >= bestScore - 1.4) {
    const matchesAr = topMatches
      .map((item) => `• ${getContactDisplayName(item.contact, "ar")}: ${item.contact.phone || "غير متاح"}`)
      .join("\n");
    const matchesEn = topMatches
      .map((item) => `• ${getContactDisplayName(item.contact, "en")}: ${item.contact.phone || "Unavailable"}`)
      .join("\n");

    return {
      answerEn: `I found more than one close match for your request:\n${matchesEn}\nYou can also find them in their categories inside the app.`,
      answerAr: `وجدت أكثر من نتيجة قريبة لطلبك:\n${matchesAr}\nويمكنك أيضًا العثور عليها داخل الفئات الخاصة بها في التطبيق.`
    };
  }

  const groupKey = resolveGroupForCategory(best);
  const groupTitle = getGroupTitle(groupKey, "en") || "Services";
  const groupTitleAr = getGroupTitle(groupKey, "ar") || "خدمات";
  const categoryTitleAr = best.category_name_ar || groupTitleAr;
  const categoryGuideAr = `يمكنك أيضًا العثور عليه داخل فئة ${groupTitleAr} / ${categoryTitleAr}.`;
  const categoryGuideEn = `You can also find it inside ${groupTitle} / ${best.category_name_ar}.`;
  const bestNameEn = getContactDisplayName(best, "en");
  const bestNameAr = getContactDisplayName(best, "ar");

  if (asksWhereCategoryIs) {
    return {
      answerEn: `${bestNameEn} is available inside ${groupTitle} / ${best.category_name_ar}.${best.phone ? ` Its number is ${best.phone}.` : ""}`,
      answerAr: `${bestNameAr} موجود داخل فئة ${groupTitleAr} / ${categoryTitleAr}.${best.phone ? ` ورقمه هو ${best.phone}.` : ""}`
    };
  }

  if (best.is_non_phone) {
    return {
      answerEn: `I found ${bestNameEn}, but it does not have a direct phone number in the app right now. ${categoryGuideEn}`,
      answerAr: `وجدت ${bestNameAr}، لكنه لا يملك رقم هاتف مباشر داخل التطبيق حاليًا. ${categoryGuideAr}`
    };
  }

  if (asksIfExists && !asksForNumber) {
    return {
      answerEn: `Yes, ${bestNameEn} is available in the app and its number is ${best.phone}. ${categoryGuideEn}`,
      answerAr: `نعم، ${bestNameAr} موجود داخل التطبيق ورقمه هو ${best.phone}. ${categoryGuideAr}`
    };
  }

  return {
    answerEn: `The number for ${bestNameEn} is ${best.phone}. ${categoryGuideEn}`,
    answerAr: `رقم ${bestNameAr} هو ${best.phone}. ${categoryGuideAr}`
  };
}

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

function getAssistantContactLeadReply(message) {
  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(message);
  const hasPhone = /(\+?\d[\d\s\-()]{7,}\d)/.test(message);
  const normalized = normalizeText(message);
  const asksForFollowUp =
    normalized.includes("كلمني") ||
    normalized.includes("كلموني") ||
    normalized.includes("اتصل") ||
    normalized.includes("تواصل") ||
    normalized.includes("call me") ||
    normalized.includes("contact me") ||
    normalized.includes("reach me");

  if (!hasEmail && !hasPhone && !asksForFollowUp) return null;

  return {
    answerEn:
      "Thanks. If you want our team to follow up with you, write your request clearly and include your phone number or email, then press Send request.",
    answerAr:
      "شكرًا لك. إذا كنت تريد أن يتواصل معك فريقنا، فاكتب طلبك بوضوح وأضف رقم هاتفك أو بريدك الإلكتروني، ثم اضغط على إرسال الطلب."
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
    if (normalized.includes("صباح الفل")) {
      return {
        answerEn: "A lovely morning to you too. How can I help you today?",
        answerAr: "صباح الفل عليك أيضًا. كيف أستطيع مساعدتك اليوم؟"
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
    if (normalized.includes("مرحبا") || normalized.includes("مرحبا") || normalized.includes("اهلا") || normalized.includes("اهلين")) {
      return {
        answerEn: "Hello and welcome. How can I help you today?",
        answerAr: "أهلاً وسهلاً بك. كيف أستطيع مساعدتك اليوم؟"
      };
    }
    if (normalized.includes("hello") || normalized === "hi" || normalized.includes("hey")) {
      return {
        answerEn: "Hello. I’m here to help you with anything inside the app.",
        answerAr: "مرحبًا. أنا هنا لمساعدتك في أي شيء داخل التطبيق."
      };
    }
  }

  if (topic.key === "compliment") {
    return {
      answerEn: "Thank you. I appreciate your kind words, and I’ll keep helping as clearly as I can.",
      answerAr: "شكرًا لك. أقدّر كلامك الجميل، وسأواصل مساعدتك بأوضح شكل ممكن."
    };
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

  if (topic.key === "respect") {
    return {
      answerEn: "I’m sorry if something felt frustrating. I’m still here to help respectfully, so write your issue and we’ll work through it together.",
      answerAr: "أنا آسف إذا كان هناك شيء سبب لك انزعاجًا. ما زلت هنا لمساعدتك باحترام، فاكتب المشكلة وسنعمل على حلها معًا."
    };
  }

  return null;
}

function sortCategoriesForGroup(a, b, groupKey) {
  const orderMap = CATEGORY_ORDER_BY_GROUP[groupKey] || {};
  const aOrder = orderMap[a.slug] || 999;
  const bOrder = orderMap[b.slug] || 999;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return String(a.slug || "").localeCompare(String(b.slug || ""), "en");
}

function AppContent() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const REFERENCE_PHONE_WIDTH = 428;
  const REFERENCE_PHONE_HEIGHT = 926;
  const REFERENCE_TABLET_WIDTH = 900;
  const REFERENCE_TABLET_HEIGHT = 1180;
  const isTablet = screenWidth >= 768;
  const isLargeTablet = screenWidth >= 1024;
  const isAndroid = Platform.OS === "android";
  const isAndroidTablet = isAndroid && isTablet;
  const phoneWidthRatio = screenWidth / REFERENCE_PHONE_WIDTH;
  const phoneHeightRatio = screenHeight / REFERENCE_PHONE_HEIGHT;
  const isSmallPhone = !isTablet && (screenWidth <= 375 || screenHeight <= 780);
  const widthScale = isTablet
    ? Math.min(Math.max(screenWidth / REFERENCE_TABLET_WIDTH, 0.88), 1.08)
    : Math.min(Math.max(phoneWidthRatio, 0.84), 1.02);
  const heightScale = isTablet
    ? Math.min(Math.max(screenHeight / REFERENCE_TABLET_HEIGHT, 0.9), 1.08)
    : Math.min(Math.max(phoneHeightRatio, 0.84), 1.02);
  const uiScale = isTablet
    ? Math.min(widthScale, heightScale)
    : Math.min(Math.max(phoneWidthRatio * 0.55 + phoneHeightRatio * 0.45, 0.86), 1.02);
  const physicalScreenHeight = Dimensions.get("screen").height;
  const measuredAndroidInset = Math.max(physicalScreenHeight - screenHeight, 0);
  const androidSystemInset = isAndroid
    ? Math.max(insets.bottom, measuredAndroidInset)
    : 0;
  const androidNavigationInset = isAndroid
    ? Math.max(
        androidSystemInset,
        Math.round((isTablet ? 46 : isSmallPhone ? 30 : 34) * heightScale)
      )
    : 0;
  const androidBottomSafeOffset = isAndroid
    ? isSmallPhone
      ? Math.max(androidNavigationInset, Math.round(8 * heightScale))
      : Math.max(androidNavigationInset, Math.round((isTablet ? 28 : 22) * heightScale))
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
  const categoryColumns = isTablet ? 2 : 2;
  const categoryRowCount = Math.ceil(GROUPS.length / categoryColumns);
  const heroIconSize = Math.round((isLargeTablet ? 46 : isSmallPhone ? 30 : 38) * uiScale);
  const heroInfoIconSize = Math.round((isLargeTablet ? 22 : 20) * uiScale);
  const categoryIconSize = Math.round((isLargeTablet ? 50 : isAndroidTablet ? 52 : isTablet ? 48 : 52) * uiScale);
  const bottomSideIconSize = Math.round((isLargeTablet ? 28 : isAndroidTablet ? 26 : isTablet ? 26 : isSmallPhone ? 26 : 28) * uiScale);
  const bottomCenterIconSize = Math.round((isLargeTablet ? 24 : isAndroidTablet ? 24 : isTablet ? 20 : isSmallPhone ? 26 : 24) * uiScale);
  const tabletGridGap = Math.round((isLargeTablet ? 22 : isAndroidTablet ? 20 : 18) * heightScale);
  const tabletGridAvailableHeight = Math.max(
    screenHeight -
      Math.round((isLargeTablet ? 320 : isAndroidTablet ? 300 : 304) * heightScale) -
      Math.round((isLargeTablet ? 150 : isAndroidTablet ? 128 : 136) * heightScale) -
      androidBottomSafeOffset,
    Math.round((isLargeTablet ? 620 : isAndroidTablet ? 560 : 520) * heightScale)
  );
  const tabletCardHeight = Math.round(
    Math.min(
      Math.max(
        (tabletGridAvailableHeight - tabletGridGap * Math.max(categoryRowCount - 1, 0)) /
          Math.max(categoryRowCount, 1),
        (isLargeTablet ? 180 : isAndroidTablet ? 196 : 170) * heightScale
      ),
      (isLargeTablet ? 238 : isAndroidTablet ? 236 : 208) * heightScale
    )
  );
  const scrollRef = useRef(null);
  const searchInputRef = useRef(null);
  const contactAssistantScrollRef = useRef(null);
  const contactComposerInputRef = useRef(null);
  const assistantReplyTimersRef = useRef([]);
  const adMobModuleRef = useRef(null);
  const notificationsModuleRef = useRef(null);
  const registeredPushTokenRef = useRef("");
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
  const [appLanguage, setAppLanguage] = useState(() => detectDeviceLanguage());
  const [assistantLanguage, setAssistantLanguage] = useState(() => detectDeviceLanguage());
  const [themePreference, setThemePreference] = useState("system");
  const [selectedContactTopic, setSelectedContactTopic] = useState("");
  const [quickQuestionsExpanded, setQuickQuestionsExpanded] = useState(false);
  const [contactAssistantHistory, setContactAssistantHistory] = useState([]);
  const [assistantTypingId, setAssistantTypingId] = useState(null);
  const [adMobReady, setAdMobReady] = useState(false);
  const [bannerSizeMode, setBannerSizeMode] = useState("adaptive");
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
  const navigationSnapshotRef = useRef(null);
  const backHistoryRef = useRef([]);
  const forwardHistoryRef = useRef([]);
  const suppressNavigationHistoryRef = useRef(false);
  const detailCategoryPositionsRef = useRef({});
  const detailScrollRefs = useRef({});
  const detailScrollOffsetsRef = useRef({});
  const [detailGroup, setDetailGroup] = useState("");
  const [detailCategory, setDetailCategory] = useState("");
  const lastDetail = useRef({ group: "", category: "" });
  const [showIntro, setShowIntro] = useState(true);
  const [introLoaded, setIntroLoaded] = useState(true);
  const [suggestHintReady, setSuggestHintReady] = useState(false);
  const [showSuggestHint, setShowSuggestHint] = useState(false);
  const [anonymousSenderId, setAnonymousSenderId] = useState("");
  const [pushRegistrationTick, setPushRegistrationTick] = useState(0);
  const [navHistoryMeta, setNavHistoryMeta] = useState({ back: 0, forward: 0 });
  const effectiveColorScheme =
    themePreference === "system"
      ? systemColorScheme === "dark"
        ? "dark"
        : "light"
      : themePreference;
  const isDarkTheme = effectiveColorScheme === "dark";
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const isArabicUi = appLanguage === "ar";
  const deferredQuery = useDeferredValue(query);
  const arabicUiFont = isArabicUi ? styles.arabicUiFont : null;
  const arabicAssistantFont = assistantLanguage === "ar" ? styles.arabicUiFont : null;
  const t = useCallback(
    (key) => UI_TEXT[key]?.[appLanguage] ?? UI_TEXT[key]?.ar ?? key,
    [appLanguage]
  );
  const tAssistant = useCallback(
    (key) => UI_TEXT[key]?.[assistantLanguage] ?? UI_TEXT[key]?.ar ?? key,
    [assistantLanguage]
  );
  const themePalette = useMemo(
    () =>
      isDarkTheme
        ? {
            background: "#130f1c",
            glowTop: "rgba(217,70,239,0.12)",
            glowBottom: "rgba(99,102,241,0.14)",
            glowMid: "rgba(255,255,255,0.05)",
            surface: "rgba(38,31,52,0.96)",
            surfaceSoft: "rgba(51,42,69,0.94)",
            surfaceStrong: "rgba(28,23,40,0.985)",
            border: "rgba(255,255,255,0.16)",
            borderStrong: "rgba(255,255,255,0.24)",
            text: "#f8fafc",
            mutedText: "#cbd5e1",
            softText: "#b6c0d2",
            placeholder: "#9ca3af",
            chip: "rgba(255,255,255,0.12)"
          }
        : {
            background: "#f7e8f3",
            glowTop: "rgba(226,120,197,0.07)",
            glowBottom: "rgba(145,110,255,0.05)",
            glowMid: "rgba(255,255,255,0.08)",
            surface: "rgba(255,255,255,0.90)",
            surfaceSoft: "rgba(255,255,255,0.82)",
            surfaceStrong: "#ffffff",
            border: "rgba(255,255,255,0.72)",
            borderStrong: "rgba(179,15,127,0.10)",
            text: "#111827",
            mutedText: "#374151",
            softText: "#6b7280",
            placeholder: "#7b8799",
            chip: "rgba(255,255,255,0.42)"
          },
    [isDarkTheme]
  );
  const themeStyles = useMemo(
    () => ({
      container: { backgroundColor: themePalette.background },
      appGlowTop: { backgroundColor: themePalette.glowTop },
      appGlowBottom: { backgroundColor: themePalette.glowBottom },
      appGlowMid: { backgroundColor: themePalette.glowMid },
      searchBar: {
        backgroundColor: isDarkTheme ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.82)",
        borderColor: isDarkTheme ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.92)"
      },
      searchInput: { color: isDarkTheme ? "#ffffff" : "#111827" },
      searchIconBadge: {
        backgroundColor: isDarkTheme ? "rgba(255,255,255,0.15)" : "#ffffff",
        borderColor: isDarkTheme ? "rgba(255,255,255,0.16)" : "#f1d6ea"
      },
      clearSearchBtn: { backgroundColor: isDarkTheme ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.46)" },
      clearSearchText: { color: isDarkTheme ? "#f8fafc" : "#334155" },
      appLanguageToggle: {
        backgroundColor: isDarkTheme ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.18)",
        borderColor: isDarkTheme ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.22)"
      },
      appThemeBtn: {
        backgroundColor: isDarkTheme ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.18)",
        borderColor: isDarkTheme ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.24)"
      },
      surface: {
        backgroundColor: themePalette.surfaceSoft,
        borderColor: themePalette.border
      },
      surfaceStrong: {
        backgroundColor: themePalette.surfaceStrong,
        borderColor: themePalette.borderStrong
      },
      text: { color: themePalette.text },
      mutedText: { color: themePalette.mutedText },
      softText: { color: themePalette.softText },
      chip: {
        backgroundColor: themePalette.chip,
        borderColor: themePalette.borderStrong
      },
      modalCard: {
        backgroundColor: themePalette.surface,
        borderColor: themePalette.border
      },
      input: {
        backgroundColor: isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.95)",
        borderColor: isDarkTheme ? "rgba(255,255,255,0.14)" : "#dbe3f5",
        color: themePalette.text
      },
      chatBotBubble: {
        backgroundColor: isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(255,240,248,0.96)",
        borderColor: isDarkTheme ? "rgba(255,255,255,0.12)" : "rgba(240,190,225,0.9)"
      },
      priorityPhoneCard: {
        backgroundColor: isDarkTheme ? "#31293d" : "#fdf2f8",
        borderColor: isDarkTheme ? "rgba(255,255,255,0.16)" : "rgba(217,70,239,0.12)"
      },
      contactMetaTile: {
        backgroundColor: isDarkTheme ? "#342d43" : "rgba(255,255,255,0.86)",
        borderColor: isDarkTheme ? "rgba(255,255,255,0.14)" : "rgba(179,15,127,0.10)"
      }
    }),
    [isDarkTheme, themePalette]
  );

  useEffect(() => {
    if (!isAndroid) return;

    NavigationBar.setVisibilityAsync("visible").catch(() => {});
    NavigationBar.setBehaviorAsync("inset-swipe").catch(() => {});
    NavigationBar.setBackgroundColorAsync("#b30f7f").catch(() => {});
    NavigationBar.setButtonStyleAsync("light").catch(() => {});
  }, [isAndroid, isDarkTheme]);

  useEffect(() => {
    if (!isAndroid || isExpoGo) return undefined;

    let mounted = true;

    async function initAds() {
      try {
        const adsModule =
          adMobModuleRef.current ||
          require("react-native-google-mobile-ads");
        adMobModuleRef.current = adsModule;
        await adsModule.default().initialize();
        if (mounted) setAdMobReady(true);
      } catch (err) {
        console.log("admob init skipped:", err?.message || err);
      }
    }

    initAds();
    return () => {
      mounted = false;
    };
  }, [isAndroid, isExpoGo]);

  const updateThemePreference = useCallback((nextPreference) => {
    const normalized = THEME_PREFERENCES.includes(nextPreference) ? nextPreference : "system";
    setThemePreference((current) => (current === normalized ? current : normalized));
    FileSystem.writeAsStringAsync(THEME_PREFERENCE_PATH, normalized).catch(() => {
      // Theme still changes immediately even if persistence fails.
    });
  }, []);
  const cycleThemePreference = useCallback(() => {
    const currentIndex = THEME_PREFERENCES.indexOf(themePreference);
    const nextPreference = THEME_PREFERENCES[(currentIndex + 1) % THEME_PREFERENCES.length] || "system";
    updateThemePreference(nextPreference);
  }, [themePreference, updateThemePreference]);
  const themeLabel =
    themePreference === "dark"
      ? t("themeDark")
      : themePreference === "light"
        ? t("themeLight")
        : t("themeSystem");
  const themeIconName =
    themePreference === "dark"
      ? "moon"
      : themePreference === "light"
        ? "sunny"
        : "phone-portrait-outline";
  const syncNavigationMeta = useCallback(() => {
    setNavHistoryMeta({
      back: backHistoryRef.current.length,
      forward: forwardHistoryRef.current.length
    });
  }, []);
  const findContactById = useCallback(
    (contactId) => allContacts.find((contact) => contact.id === contactId) || null,
    [allContacts]
  );
  const buildNavigationSnapshot = useCallback(
    () => ({
      showIntro,
      showSuggestHint,
      addModalVisible,
      contactModalVisible,
      aboutModalVisible,
      businessModalVisible,
      businessRequestVisible,
      detailGroup,
      detailCategory,
      activeCategorySlug,
      activeGroup,
      quickResultId: quickResult?.id || null
    }),
    [
      showIntro,
      showSuggestHint,
      addModalVisible,
      contactModalVisible,
      aboutModalVisible,
      businessModalVisible,
      businessRequestVisible,
      detailGroup,
      detailCategory,
      activeCategorySlug,
      activeGroup,
      quickResult
    ]
  );
  const restoreNavigationSnapshot = useCallback(
    (snapshot) => {
      if (!snapshot) return;
      setShowIntro(!!snapshot.showIntro);
      setShowSuggestHint(!!snapshot.showSuggestHint);
      setAddModalVisible(!!snapshot.addModalVisible);
      setContactModalVisible(!!snapshot.contactModalVisible);
      setAboutModalVisible(!!snapshot.aboutModalVisible);
      setBusinessModalVisible(!!snapshot.businessModalVisible);
      setBusinessRequestVisible(!!snapshot.businessRequestVisible);
      setDetailGroup(snapshot.detailGroup || "");
      setDetailCategory(snapshot.detailCategory || "");
      setActiveCategorySlug(snapshot.activeCategorySlug || "");
      setActiveGroup(snapshot.activeGroup || "all");
      setQuickResult(snapshot.quickResultId ? findContactById(snapshot.quickResultId) : null);
      if (!snapshot.detailGroup && !snapshot.activeCategorySlug && !snapshot.quickResultId) {
        setPendingScrollContactId(null);
      }
    },
    [findContactById]
  );
  const isSnapshotHistoryEligible = useCallback(
    (snapshot) => !!snapshot && !snapshot.showIntro && !snapshot.showSuggestHint,
    []
  );
  const applyNavigationSnapshot = useCallback(
    (snapshot) => {
      suppressNavigationHistoryRef.current = true;
      navigationSnapshotRef.current = snapshot;
      restoreNavigationSnapshot(snapshot);
      syncNavigationMeta();
    },
    [restoreNavigationSnapshot, syncNavigationMeta]
  );
  const navigateForwardOneStep = useCallback(() => {
    let next = null;
    while (forwardHistoryRef.current.length && !next) {
      const candidate = forwardHistoryRef.current.pop();
      if (isSnapshotHistoryEligible(candidate)) {
        next = candidate;
      }
    }
    if (!next) return false;
    const current = buildNavigationSnapshot();
    backHistoryRef.current = [...backHistoryRef.current.slice(-23), current];
    applyNavigationSnapshot(next);
    return true;
  }, [applyNavigationSnapshot, buildNavigationSnapshot, isSnapshotHistoryEligible]);
  const navigateBackByHistory = useCallback(() => {
    let previous = null;
    while (backHistoryRef.current.length && !previous) {
      const candidate = backHistoryRef.current.pop();
      if (isSnapshotHistoryEligible(candidate)) {
        previous = candidate;
      }
    }
    if (!previous) return false;
    const current = buildNavigationSnapshot();
    forwardHistoryRef.current = [...forwardHistoryRef.current.slice(-23), current];
    applyNavigationSnapshot(previous);
    return true;
  }, [applyNavigationSnapshot, buildNavigationSnapshot, isSnapshotHistoryEligible]);

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

  useEffect(() => {
    const nextSnapshot = buildNavigationSnapshot();
    const currentSnapshot = navigationSnapshotRef.current;
    if (!currentSnapshot) {
      navigationSnapshotRef.current = nextSnapshot;
      syncNavigationMeta();
      return;
    }
    if (JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)) {
      return;
    }
    if (suppressNavigationHistoryRef.current) {
      suppressNavigationHistoryRef.current = false;
      navigationSnapshotRef.current = nextSnapshot;
      syncNavigationMeta();
      return;
    }
    if (!isSnapshotHistoryEligible(currentSnapshot) || !isSnapshotHistoryEligible(nextSnapshot)) {
      navigationSnapshotRef.current = nextSnapshot;
      syncNavigationMeta();
      return;
    }
    backHistoryRef.current = [...backHistoryRef.current.slice(-23), currentSnapshot];
    forwardHistoryRef.current = [];
    navigationSnapshotRef.current = nextSnapshot;
    syncNavigationMeta();
  }, [buildNavigationSnapshot, isSnapshotHistoryEligible, syncNavigationMeta]);

  const panResponder = useMemo(
    () =>
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
    }),
    [detailGroup, screenWidth, swipeBackX, swipeThreshold]
  );

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
        setError(t("loadingCachedData"));
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
        setError(t("loadingSavedData"));
      }
    } catch {
      if (!seededFromLocal) {
        setError(`${t("loadingFailedSaved")} (${API_BASE_URL})`);
      }
    } finally {
      clearTimeout(timeoutId);
      hasLoadedContactsRef.current = true;
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadContacts({ seedFromCache: true });
  }, [loadContacts]);

  useEffect(() => {
    let cancelled = false;
    async function loadThemePreference() {
      try {
        const info = await FileSystem.getInfoAsync(THEME_PREFERENCE_PATH);
        if (!info.exists) return;
        const savedPreference = (await FileSystem.readAsStringAsync(THEME_PREFERENCE_PATH)).trim();
        if (!cancelled && THEME_PREFERENCES.includes(savedPreference)) {
          setThemePreference(savedPreference);
        }
      } catch {
        // Keep the default system theme if the saved preference cannot be read.
      }
    }
    loadThemePreference();
    return () => {
      cancelled = true;
    };
  }, []);

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
      const t = setTimeout(() => setShowIntro(false), 2200);
      return () => clearTimeout(t);
    }
  }, [showIntro, introLoaded]);

  useEffect(() => {
    if (!showIntro && suggestHintReady) {
      setShowSuggestHint(true);
    }
  }, [showIntro, suggestHintReady]);

  useEffect(() => {
    if (!showSuggestHint) return undefined;
    const timer = setTimeout(() => {
      dismissSuggestHint();
    }, 2400);
    return () => clearTimeout(timer);
  }, [showSuggestHint]);

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
      getContactSearchTexts(c).forEach((text) => s.add(text));
    });
    return [...s];
  }, [allContacts]);

  const predictions = useMemo(() => {
    const q = normalizeText(deferredQuery);
    const raw = deferredQuery.trim();
    if ((!q || q.length < 2) && raw.length < 2) return [];

    const byName = allContacts.filter((c) => q && contactMatchesQuery(c, q, raw));
    const byPhone = allContacts.filter((c) => raw && String(c.phone || "").includes(raw));
    const merged = [...byName, ...byPhone].filter(
      (item, index, arr) => arr.findIndex((entry) => entry.id === item.id) === index
    );

    return sortContacts(merged).slice(0, 5);
  }, [deferredQuery, allContacts]);

  const typoSuggestion = useMemo(() => {
    const q = normalizeText(deferredQuery);
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
  }, [deferredQuery, predictions, nameTerms]);

  const filtered = useMemo(() => {
    const q = normalizeText(deferredQuery);
    return allContacts.filter((c) => {
      const passGroup = detailGroup ? true : activeGroup === "all" || resolveGroupForCategory(c) === activeGroup;
      const passCategory = detailGroup ? true : !activeCategorySlug || c.category_slug === activeCategorySlug;
      if (!passGroup) return false;
      if (!passCategory) return false;
      if (!q) return true;
      return contactMatchesQuery(c, q, deferredQuery.trim());
    });
  }, [allContacts, deferredQuery, activeGroup, activeCategorySlug]);

  const getDetailContactsForSlug = (slug) => {
    const q = normalizeText(deferredQuery);
    return allContacts.filter((c) => {
      if (c.category_slug !== slug) return false;
      if (!q) return true;
      return contactMatchesQuery(c, q, deferredQuery.trim());
    });
  };

  const allCategoryList = useMemo(() => {
    const map = new Map();
    allContacts.forEach((c) => {
      if (!map.has(c.category_slug)) {
        map.set(c.category_slug, {
          slug: c.category_slug,
          name: getCategoryDisplayName(c.category_slug, c.category_name_ar, appLanguage),
          group: resolveGroupForCategory(c)
        });
      }
    });
    VIRTUAL_CATEGORY_DEFINITIONS.forEach((category) => {
      if (!map.has(category.slug)) {
        map.set(category.slug, {
          slug: category.slug,
          name: getCategoryDisplayName(category.slug, "", appLanguage),
          group: category.group,
          isVirtual: true
        });
      }
    });
    const arr = [...map.values()];
    const selectedGroup = detailGroup || activeGroup;
    if (selectedGroup === "all") return arr;
    return arr.filter((c) => c.group === selectedGroup);
  }, [allContacts, activeGroup, detailGroup, appLanguage]);

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

  const getAssistantCategoryReply = useCallback(
    (message) => {
      const normalized = normalizeText(message);
      if (!normalized || !allCategoryList.length) return null;

      const asksCategoryLocation = [
        "فين",
        "مكان",
        "فئة",
        "قسم",
        "تصنيف",
        "category",
        "section",
        "where"
      ].some((phrase) => normalized.includes(normalizeText(phrase)));

      if (!asksCategoryLocation) return null;

      const query = buildAssistantLookupQuery(message);
      if (!query || query.length < 2) return null;

      let bestCategory = null;
      let bestScore = 0;

      allCategoryList.forEach((category) => {
        const normalizedCategory = normalizeText(category.name);
        const normalizedCategoryAlt = normalizeText(getCategoryDisplayName(category.slug, category.name, appLanguage === "ar" ? "en" : "ar"));
        let score = 0;
        if (normalizedCategory === query) score += 10;
        if (normalizedCategory.includes(query)) score += 8;
        if (query.includes(normalizedCategory)) score += 5;
        if (normalizedCategoryAlt === query) score += 10;
        if (normalizedCategoryAlt.includes(query)) score += 8;
        if (query.includes(normalizedCategoryAlt)) score += 5;

        query.split(" ").filter(Boolean).forEach((word) => {
          if (normalizedCategory.includes(word) || normalizedCategoryAlt.includes(word)) score += 1.2;
        });

        if (score > bestScore) {
          bestScore = score;
          bestCategory = category;
        }
      });

      if (!bestCategory || bestScore < 2.6) return null;

      const parentGroupTitle = getGroupTitle(bestCategory.group, "en") || "Services";
      const parentGroupTitleAr = getGroupTitle(bestCategory.group, "ar") || "خدمات";

      return {
        answerEn: `${bestCategory.name} is available under ${parentGroupTitle} in the app.`,
        answerAr: `${bestCategory.name} موجودة داخل فئة ${parentGroupTitleAr} في التطبيق.`
      };
    },
    [allCategoryList]
  );

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

  const callNumber = async (itemOrPhone) => {
    const rawPhone =
      typeof itemOrPhone === "string"
        ? itemOrPhone
        : extractContactPhones(itemOrPhone?.phone)[0] || String(itemOrPhone?.phone || "").trim();
    const isNonPhone = typeof itemOrPhone === "object" && itemOrPhone?.is_non_phone;
    if (isNonPhone || !rawPhone) return;
    const url = `tel:${rawPhone}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
  };

  const openEmailAddress = async (value) => {
    const email = String(value || "").trim();
    if (!email) return;
    const url = `mailto:${email}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
  };

  const extractEmailFromNotes = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0] : "";
  };

  const extractWebsiteFromNotes = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    const explicit = text.match(/Website:\s*([^\s|]+)/i);
    if (explicit?.[1]) return explicit[1].trim();
    const fallback = text.match(/(?:https?:\/\/|www\.)[^\s|]+/i);
    return fallback ? fallback[0].trim() : "";
  };

  const extractMapUrlFromNotes = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    const explicit = text.match(/Map:\s*(https?:\/\/[^\s|]+)/i);
    if (explicit?.[1]) return explicit[1].trim();
    const fallback = text.match(/https?:\/\/(?:www\.)?(?:google\.[^/\s]+|maps\.app\.goo\.gl|goo\.gl|maps\.google\.[^\s|]+)[^\s|]*/i);
    return fallback ? fallback[0].trim() : "";
  };

  const openWebsiteUrl = async (value) => {
    let website = String(value || "").trim();
    if (!website) return;
    if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
    const canOpen = await Linking.canOpenURL(website);
    if (canOpen) await Linking.openURL(website);
  };

  const openMapForContact = async (item) => {
    const name = getContactDisplayName(item, appLanguage) || String(item?.name_ar || "").trim();
    if (!name) return;

    const encoded = encodeURIComponent(name);
    const nativeUrl =
      Platform.OS === "ios"
        ? `maps:0,0?q=${encoded}`
        : `geo:0,0?q=${encoded}`;
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

    const canOpenNative = await Linking.canOpenURL(nativeUrl);
    if (canOpenNative) {
      await Linking.openURL(nativeUrl);
      return;
    }
    const canOpenWeb = await Linking.canOpenURL(webUrl);
    if (canOpenWeb) await Linking.openURL(webUrl);
  };

  const showUiAlert = useCallback(
    (title, message, compactMessage = message) => {
      Alert.alert(title, isSmallPhone ? compactMessage : message);
    },
    [isSmallPhone]
  );

  const handleIntroContinue = () => {
    setShowIntro(false);
  };

  const renderContactBadges = (item, compact = false) => {
    const badges = [];
    if (item?.is_featured) badges.push({ key: "featured", label: t("featuredBadgeSmall"), style: styles.featuredBadge, text: styles.featuredBadgeText });
    if (item?.is_verified) badges.push({ key: "verified", label: t("verifiedBadgeSmall"), style: styles.verifiedBadge, text: styles.verifiedBadgeText });
    if (!badges.length) return null;
    return (
      <View style={[styles.contactBadgeRow, compact && styles.contactBadgeRowCompact]}>
        {badges.map((badge) => (
          <View key={badge.key} style={[styles.contactBadge, contactBadgeResponsive, badge.style]}>
            <Text style={[styles.contactBadgeText, contactBadgeTextResponsive, badge.text, arabicUiFont]}>{badge.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderContactPriorityPhone = (item, compact = false) => {
    const phones = extractContactPhones(item?.phone);
    if (!phones.length || item?.is_non_phone) return null;
    return (
      <View style={[styles.priorityPhoneStack, compact && styles.priorityPhoneStackCompact]}>
        {phones.map((phone, index) => (
          <TouchableOpacity
            key={`${item?.id || "contact"}-${phone}-${index}`}
            style={[styles.priorityPhoneCard, compact && styles.priorityPhoneCardCompact, themeStyles.priorityPhoneCard]}
            activeOpacity={0.86}
            onPress={() => callNumber(phone)}
          >
            <View style={[styles.priorityPhoneIconWrap, compact && styles.priorityPhoneIconWrapCompact]}>
              <Ionicons name="call-outline" size={compact ? 18 : 20} color="#fff" />
            </View>
            <View style={styles.priorityPhoneTextWrap}>
              <Text style={[styles.priorityPhoneLabel, compact && styles.priorityPhoneLabelCompact]}>
                {appLanguage === "ar" ? `رقم الاتصال${phones.length > 1 ? ` ${index + 1}` : ""}` : `Contact number${phones.length > 1 ? ` ${index + 1}` : ""}`}
              </Text>
              <Text style={[styles.priorityPhoneValue, compact && styles.priorityPhoneValueCompact, themeStyles.text, arabicUiFont]}>{phone}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderContactHero = (item, compact = false) => {
    const title = getContactDisplayName(item, appLanguage);
    const subtitle = getCategoryDisplayName(item.category_slug, item.category_name_ar, appLanguage);
    const heroGroupKey = CATEGORY_GROUP_OVERRIDES[item.category_slug] || detectGroup(item.category_name_ar || item.category_slug);
    const heroPalette = GROUP_COLORS[heroGroupKey] || GROUP_COLORS.retail;
    const heroAccent = heroPalette.accent || "#b30f7f";
    const emergencyVisual = getEmergencyVisual(item);
    const heroIconName = isEmbassyContact(item)
      ? "business-outline"
      : emergencyVisual?.icon || (item?.is_non_phone ? "information-circle-outline" : "call-outline");
    const logoUrl = getContactLogoUrl(item);
    const shouldUseAppLogoFallback = !logoUrl && !isEmbassyContact(item) && item?.category_slug !== "emergency";
    const heroVisualStyle = compact ? styles.contactHeroVisualShellCompact : null;
    const heroVisualInnerStyle = compact ? styles.contactHeroVisualInnerCompact : null;
    const heroVisualColors = isDarkTheme
      ? [applyHexAlpha(heroAccent, "66"), "rgba(255,255,255,0.08)"]
      : [applyHexAlpha(heroAccent, "38"), "rgba(255,255,255,0.92)"];
    return (
      <View style={[styles.contactHeroRow, compact && styles.contactHeroRowCompact]}>
        {logoUrl ? (
          <LinearGradient colors={heroVisualColors} style={[styles.contactHeroVisualShell, heroVisualStyle]}>
            <View style={[styles.contactHeroVisualInner, heroVisualInnerStyle]}>
              <Image source={{ uri: logoUrl }} style={[styles.contactHeroLogo, compact && styles.contactHeroLogoCompact]} resizeMode="contain" />
            </View>
          </LinearGradient>
        ) : shouldUseAppLogoFallback ? (
          <LinearGradient colors={heroVisualColors} style={[styles.contactHeroVisualShell, heroVisualStyle]}>
            <View style={[styles.contactHeroVisualInner, styles.contactHeroVisualInnerPlain, heroVisualInnerStyle]}>
              <Image source={appLogoFallback} style={[styles.contactHeroLogoPlain, compact && styles.contactHeroLogoPlainCompact]} resizeMode="contain" />
            </View>
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={[
              applyHexAlpha(emergencyVisual?.fg || heroAccent, isDarkTheme ? "77" : "42"),
              isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.94)"
            ]}
            style={[
              styles.contactHeroVisualShell,
              heroVisualStyle,
              emergencyVisual && { borderColor: `${emergencyVisual.fg}44` }
            ]}
          >
            <View style={[styles.contactHeroVisualInner, heroVisualInnerStyle]}>
              <Ionicons
                name={heroIconName}
                size={compact ? 22 : 26}
                color={emergencyVisual?.fg || heroAccent}
              />
            </View>
          </LinearGradient>
        )}
        <View style={styles.contactHeroTextWrap}>
            <Text style={[styles.contactHeroTitle, compact && styles.contactHeroTitleCompact, themeStyles.text, arabicUiFont]}>{title}</Text>
          <Text style={[styles.contactHeroSubtitle, compact && styles.contactHeroSubtitleCompact, themeStyles.softText, arabicUiFont]}>{subtitle}</Text>
        </View>
      </View>
    );
  };

  const renderContactMeta = (item, compact = false) => {
    const address = String(item?.address || "").trim();
    const notes = String(item?.notes || "").trim();
    const email = extractEmailFromNotes(notes);
    const website = extractWebsiteFromNotes(notes);
    const mapUrl = extractMapUrlFromNotes(notes);
    const plainNotes = notes
      .replace(email, "")
      .replace(website, "")
      .replace(mapUrl, "")
      .replace(/Website:\s*/gi, "")
      .replace(/Map:\s*/gi, "")
      .replace(/\s*\|\s*/g, " ")
      .replace(/\s*[-–—:|]\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const canShowMapAction =
      item?.category_slug !== "emergency" &&
      !!String(getContactDisplayName(item, appLanguage) || item?.name_ar || "").trim();
    if (!address && !email && !website && !plainNotes && !canShowMapAction) return null;

    const renderMetaTile = (icon, label, value, options = {}) => {
      if (!value) return null;
      const isLink = !!options.onPress;
      const Tile = isLink ? TouchableOpacity : View;
      return (
        <Tile
          style={[styles.contactMetaTile, compact && styles.contactMetaTileCompact, themeStyles.contactMetaTile, isLink && styles.contactMetaTilePressable]}
          onPress={options.onPress}
          activeOpacity={0.82}
        >
          <View style={[styles.contactMetaTileIcon, compact && styles.contactMetaTileIconCompact]}>
            <Ionicons name={icon} size={compact ? 15 : 16} color={options.iconColor || "#b30f7f"} />
          </View>
          <View style={styles.contactMetaTileContent}>
            <Text style={[styles.contactMetaTileLabel, compact && styles.contactMetaTileLabelCompact, isDarkTheme && { color: "#f0abfc" }, arabicUiFont]}>{label}</Text>
            <Text
              style={[
                styles.contactMetaTileValue,
                compact && styles.contactMetaTileValueCompact,
                themeStyles.mutedText,
                isLink && styles.contactMetaTileLink,
                arabicUiFont
              ]}
              numberOfLines={options.singleLine ? 1 : undefined}
            >
              {value}
            </Text>
          </View>
        </Tile>
      );
    };

    return (
      <View style={[styles.contactMetaWrap, compact && styles.contactMetaWrapCompact]}>
        {address || email || website || plainNotes ? (
          <View style={styles.contactMetaGrid}>
            {renderMetaTile("location-outline", t("addressLabel"), address)}
            {renderMetaTile("mail-outline", t("emailLabel"), email, {
              onPress: () => openEmailAddress(email),
              iconColor: "#d946ef",
              singleLine: true
            })}
            {renderMetaTile("globe-outline", t("websiteLabel"), website, {
              onPress: () => openWebsiteUrl(website),
              iconColor: "#8b5cf6",
              singleLine: true
            })}
            {renderMetaTile("information-circle-outline", t("detailsLabel"), plainNotes, {
              iconColor: "#0f766e"
            })}
          </View>
        ) : null}
        <View style={styles.contactMetaActionsRow}>
          {canShowMapAction ? (
            <TouchableOpacity style={[styles.metaActionBtn, styles.mapActionBtn]} onPress={() => openMapForContact(item)}>
              <Ionicons name="navigate-outline" size={16} color="#fff" />
              <Text style={[styles.metaActionBtnText, arabicUiFont]}>{t("viewOnMap")}</Text>
            </TouchableOpacity>
          ) : null}
          {email ? (
            <TouchableOpacity style={[styles.metaActionBtn, styles.emailActionBtn]} onPress={() => openEmailAddress(email)}>
              <Ionicons name="mail-outline" size={16} color="#d946ef" />
              <Text style={[styles.metaActionBtnText, styles.emailActionBtnText, arabicUiFont]}>{t("sendEmail")}</Text>
            </TouchableOpacity>
          ) : null}
          {website ? (
            <TouchableOpacity style={[styles.metaActionBtn, styles.websiteActionBtn]} onPress={() => openWebsiteUrl(website)}>
              <Ionicons name="open-outline" size={16} color="#8b5cf6" />
              <Text style={[styles.metaActionBtnText, styles.websiteActionBtnText, arabicUiFont]}>{t("openWebsite")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const dismissSuggestHint = () => {
    setShowSuggestHint(false);
    setSuggestHintReady(false);
    FileSystem.writeAsStringAsync(SUGGEST_HINT_PATH, "seen").catch(() => {
      // Ignore persistence failure; UI already dismissed.
    });
  };

  const applyAppLanguage = useCallback((nextLanguage) => {
    setAppLanguage((current) => (current === nextLanguage ? current : nextLanguage));
    setAssistantLanguage((current) => (current === nextLanguage ? current : nextLanguage));
  }, []);

  const applyAssistantLanguage = useCallback((nextLanguage) => {
    setAssistantLanguage((current) => (current === nextLanguage ? current : nextLanguage));
  }, []);

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

  const scrollDetailCategoryDown = useCallback((categorySlug) => {
    const scroller = detailScrollRefs.current[categorySlug];
    if (!scroller?.scrollTo) return;
    const currentOffset = detailScrollOffsetsRef.current[categorySlug] || 0;
    scroller.scrollTo({ y: currentOffset + Math.max(260, Math.round(screenHeight * 0.28)), animated: true });
  }, [screenHeight]);

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
              backgroundColor: isDarkTheme
                ? `${palette.accent}${selected ? "36" : "22"}`
                : selected
                  ? palette.cardActive || palette.card
                  : palette.card,
              borderColor: isDarkTheme ? `${palette.accent}55` : "rgba(255,255,255,0.28)"
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
                    {item.key === "mobility" ? (
                      <View style={styles.mobilityIconStack}>
                        <Ionicons
                          name="airplane"
                          size={Math.max(24, Math.round(categoryIconSize * 0.7))}
                          color="#0ea5e9"
                          style={styles.mobilityPlaneIcon}
                        />
                        <Ionicons
                          name="bus"
                          size={Math.max(18, Math.round(categoryIconSize * 0.54))}
                          color="#2563eb"
                          style={styles.mobilityBusIcon}
                        />
                        <Ionicons
                          name="car-sport"
                          size={Math.max(22, Math.round(categoryIconSize * 0.68))}
                          color="#22c55e"
                          style={styles.mobilityCarIcon}
                        />
                      </View>
                    ) : item.key === "retail" ? (
                      <View style={styles.retailIconStack}>
                        <View style={styles.retailIconRowTop}>
                          <MaterialCommunityIcons
                            name="bed-queen-outline"
                            size={Math.max(18, Math.round(categoryIconSize * 0.4))}
                            color="#7c3aed"
                            style={styles.retailTopIcon}
                          />
                          <Ionicons
                            name="phone-portrait-outline"
                            size={Math.max(18, Math.round(categoryIconSize * 0.4))}
                            color="#d946ef"
                            style={styles.retailTopIcon}
                          />
                          <MaterialCommunityIcons
                            name="bag-suitcase-outline"
                            size={Math.max(18, Math.round(categoryIconSize * 0.4))}
                            color="#4f46e5"
                            style={styles.retailTopIcon}
                          />
                        </View>
                        <View style={styles.retailIconRowBottom}>
                          <MaterialCommunityIcons
                            name="hammer-wrench"
                            size={Math.max(20, Math.round(categoryIconSize * 0.46))}
                            color="#a855f7"
                            style={styles.retailBottomIcon}
                          />
                          <MaterialCommunityIcons
                            name="sofa-outline"
                            size={Math.max(21, Math.round(categoryIconSize * 0.48))}
                            color="#8b5cf6"
                            style={styles.retailBottomIcon}
                          />
                        </View>
                      </View>
                    ) : (
                      <IconComp name={iconMeta.name || "apps"} size={categoryIconSize} color={iconMeta.color || "#6b7280"} />
                    )}
                  </View>
                </View>
            </View>
            <Text
              numberOfLines={2}
              style={[
                styles.categoryText,
                categoryTextResponsive,
                themeStyles.text,
                selected && styles.categoryTextActive,
                isDarkTheme && selected && { color: "#ffffff" },
                arabicUiFont
              ]}
            >
              {getGroupTitle(item.key, appLanguage)}
            </Text>
            <Text
              numberOfLines={isArabicUi ? 2 : 3}
              style={[styles.categoryTextSub, categoryTextSubResponsive, themeStyles.softText, arabicUiFont]}
            >
              {getGroupSubtitle(item.key, appLanguage)}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const handlePredictionPress = (value) => {
    const pickedValue = typeof value === "string" ? value : getContactDisplayName(value, appLanguage) || value?.name_ar || "";
    setQuery(pickedValue);
    const q = normalizeText(pickedValue);
    const rawPhone = typeof value === "object" ? String(value.phone || "").trim() : "";
    const match =
      (typeof value === "object" && value?.id ? allContacts.find((c) => c.id === value.id) : null) ||
      allContacts.find((c) => getContactSearchTexts(c).some((text) => normalizeText(text) === q)) ||
      allContacts.find((c) => rawPhone && String(c.phone || "").trim() === rawPhone) ||
      allContacts.find((c) => getContactSearchTexts(c).some((text) => normalizeText(text).includes(q)));

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

  const handleNotificationTarget = useCallback((payload = {}) => {
    const targetScreen = String(payload?.targetScreen || payload?.target_screen || "home").trim() || "home";
    const targetGroup = String(payload?.targetGroup || payload?.target_group || "").trim();
    const targetCategorySlug = String(
      payload?.targetCategorySlug || payload?.target_category_slug || ""
    ).trim();
    const serviceContactId = Number.parseInt(
      String(payload?.serviceContactId || payload?.service_contact_id || "0"),
      10
    ) || 0;

    startTransition(() => {
      setShowIntro(false);
      setShowSuggestHint(false);
      setAboutModalVisible(false);
      setBusinessRequestVisible(false);
      setPendingSupportMessage("");
    });

    if (targetScreen === "contact") {
      setAddModalVisible(false);
      setBusinessModalVisible(false);
      setContactModalVisible(true);
      return;
    }

    if (targetScreen === "add") {
      setContactModalVisible(false);
      setBusinessModalVisible(false);
      setAddModalVisible(true);
      return;
    }

    if (targetScreen === "promote") {
      setAddModalVisible(false);
      setContactModalVisible(false);
      setBusinessModalVisible(true);
      return;
    }

    if (targetScreen === "service" && serviceContactId > 0) {
      const serviceContact = findContactById(serviceContactId);
      if (serviceContact) {
        setAddModalVisible(false);
        setContactModalVisible(false);
        setBusinessModalVisible(false);
        handlePredictionPress(serviceContact);
        return;
      }
    }

    if (targetScreen === "group" && targetGroup) {
      setAddModalVisible(false);
      setContactModalVisible(false);
      setBusinessModalVisible(false);
      setQuickResult(null);
      setActiveCategorySlug(targetCategorySlug);
      setActiveGroup(targetGroup);
      setDetailGroup(targetGroup);
      setDetailCategory(targetCategorySlug || (targetGroup === "gov" ? "emergency" : ""));
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      });
      return;
    }

    handleHomePress();
  }, [findContactById, handleHomePress, handlePredictionPress]);

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(ANONYMOUS_SENDER_ID_PATH);
        if (info.exists) {
          const savedId = (await FileSystem.readAsStringAsync(ANONYMOUS_SENDER_ID_PATH)).trim();
          if (savedId) {
            if (mounted) setAnonymousSenderId(savedId);
            return;
          }
        }
        const nextId = generateAnonymousSenderId();
        await FileSystem.writeAsStringAsync(ANONYMOUS_SENDER_ID_PATH, nextId);
        if (mounted) setAnonymousSenderId(nextId);
      } catch {
        if (mounted) setAnonymousSenderId(generateAnonymousSenderId());
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isExpoGo) return undefined;

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (
        previousState &&
        previousState.match(/inactive|background/) &&
        nextState === "active"
      ) {
        setPushRegistrationTick((value) => value + 1);
      }
    });

    return () => subscription.remove();
  }, [isExpoGo]);

  useEffect(() => {
    if (isExpoGo) return undefined;

    let mounted = true;
    let responseSubscription;

    async function attachNotificationListeners() {
      try {
        const Notifications =
          notificationsModuleRef.current ||
          (await import("expo-notifications"));
        notificationsModuleRef.current = Notifications;

        responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
          handleNotificationTarget(response?.notification?.request?.content?.data || {});
          Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
        });

        const lastResponse = await Notifications.getLastNotificationResponseAsync?.();
        if (mounted && lastResponse?.notification?.request?.content?.data) {
          handleNotificationTarget(lastResponse.notification.request.content.data);
          Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
        }
      } catch (err) {
        console.log("push response listener skipped:", err?.message || err);
      }
    }

    attachNotificationListeners();
    return () => {
      mounted = false;
      responseSubscription?.remove?.();
    };
  }, [handleNotificationTarget, isExpoGo]);

  useEffect(() => {
    if (!anonymousSenderId || isExpoGo) return undefined;

    let cancelled = false;
    async function registerForPushNotifications() {
      try {
        const Notifications =
          notificationsModuleRef.current ||
          (await import("expo-notifications"));
        notificationsModuleRef.current = Notifications;

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false
          })
        });

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "General notifications",
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#b30f7f"
          });
        }

        const existingPermission = await Notifications.getPermissionsAsync();
        let finalStatus = existingPermission.status;
        if (finalStatus !== "granted") {
          const requestedPermission = await Notifications.requestPermissionsAsync();
          finalStatus = requestedPermission.status;
        }
        if (finalStatus !== "granted" || cancelled) {
          console.log("push registration skipped: permission not granted");
          return;
        }

        const tokenResult = await Notifications.getExpoPushTokenAsync({
          projectId: EXPO_PROJECT_ID
        });
        const token = tokenResult?.data || "";
        if (!token || cancelled) {
          console.log("push registration skipped: empty Expo push token");
          return;
        }
        if (registeredPushTokenRef.current === token) return;

        const res = await fetch(`${API_BASE_URL}/api/push/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            platform: Platform.OS,
            device_id: anonymousSenderId,
            ui_language: appLanguage,
            screen_size: `${Math.round(screenWidth)}x${Math.round(screenHeight)}`
          })
        });
        if (res.ok) {
          registeredPushTokenRef.current = token;
          console.log("push registration saved");
          return;
        }
        const registrationError = await res.text().catch(() => "");
        console.log(
          "push registration failed:",
          res.status,
          registrationError || "Unknown backend error"
        );
      } catch (err) {
        console.log("push registration skipped:", err?.message || err);
      }
    }

    registerForPushNotifications();
    return () => {
      cancelled = true;
    };
  }, [anonymousSenderId, appLanguage, isExpoGo, pushRegistrationTick, screenHeight, screenWidth]);

  const sendFeedback = async (payload) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 65000);
    try {
      const enrichedPayload = {
        ...payload,
        sender_id: anonymousSenderId || generateAnonymousSenderId(),
        platform: Platform.OS,
        ui_language: appLanguage,
        assistant_language: assistantLanguage,
        screen_size: `${Math.round(screenWidth)}x${Math.round(screenHeight)}`,
        sent_at: new Date().toISOString()
      };
      const res = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrichedPayload),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t("failedToSendRequest"));
      }
    } catch (err) {
      if (err?.name === "AbortError" || /Network request failed/i.test(String(err?.message || ""))) {
        throw new Error(t("serverSlow"));
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const buildContactSupportTranscript = useCallback(
    (requestMessage) => {
      const cleanRequest = String(requestMessage || "").trim();
      const visibleHistory = contactAssistantHistory.filter(
        (entry) => entry && (entry.userText || entry.answerAr || entry.answerEn)
      );

      if (!visibleHistory.length) {
        return cleanRequest;
      }

      const transcript = visibleHistory
        .map((entry) => {
          const userLine = String(entry.userText || "").trim();
          const prefersArabicReply = /[\u0600-\u06FF]/.test(userLine);
          const assistantLine = String(
            prefersArabicReply
              ? entry.answerAr || entry.answerEn || ""
              : entry.answerEn || entry.answerAr || ""
          ).trim();

          const lines = [];
          if (userLine) {
            lines.push(`User: ${userLine}`);
          }
          if (assistantLine) {
            lines.push(`AI: ${assistantLine}`);
          }
          return lines.join("\n");
        })
        .filter(Boolean)
        .join("\n\n");

      if (!transcript) {
        return cleanRequest;
      }

      return `${cleanRequest}\n\nAI chat transcript:\n${transcript}`.trim();
    },
    [contactAssistantHistory]
  );

  const handleAddHotlineSubmit = async () => {
    const name = newHotlineName.trim();
    const phone = newHotlinePhone.trim();
    if (!name || !phone) {
      showUiAlert(t("missingDataTitle"), t("missingNameAndNumber"), t("missingNameAndNumberCompact"));
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
      showUiAlert(t("doneTitle"), t("requestSent"), t("requestSentCompact"));
    } catch (err) {
      showUiAlert(t("errorTitle"), err.message || t("failedToSendRequest"), t("failedToSendRequest"));
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
      showUiAlert(tAssistant("missingMessageTitle"), tAssistant("writeSuggestionFirst"), tAssistant("writeSuggestionFirstCompact"));
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

    const contactLeadReply = getAssistantContactLeadReply(msg);
    if (contactLeadReply) {
      appendAssistantEntry({
        userText: msg,
        answerEn: contactLeadReply.answerEn,
        answerAr: contactLeadReply.answerAr,
        action: "focus-message",
        actionLabelEn: UI_TEXT.writeYourRequest.en,
        actionLabelAr: UI_TEXT.writeYourRequest.ar
      });
      setContactMessage("");
      return;
    }

    const categoryReply = getAssistantCategoryReply(msg);
    if (categoryReply) {
      appendAssistantEntry({
        userText: msg,
        answerEn: categoryReply.answerEn,
        answerAr: categoryReply.answerAr
      });
      setContactMessage("");
      return;
    }

    const lookupReply = getAssistantLookupReply(msg, allContacts);
    if (lookupReply) {
      appendAssistantEntry({
        userText: msg,
        answerEn: lookupReply.answerEn,
        answerAr: lookupReply.answerAr,
        action: lookupReply.action,
        actionLabelEn: lookupReply.actionLabelEn,
        actionLabelAr: lookupReply.actionLabelAr
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
      actionLabelEn: UI_TEXT.sendRequest.en,
      actionLabelAr: UI_TEXT.sendRequest.ar
    });
    setContactMessage("");
  };

  const handleDirectContactSubmit = async () => {
    const msg = contactMessage.trim();
    if (!msg) {
      showUiAlert(tAssistant("missingMessageTitle"), tAssistant("writeMessageFirst"), tAssistant("writeMessageFirstCompact"));
      return;
    }

    try {
      await sendFeedback({
        type: "suggestion",
        message: buildContactSupportTranscript(msg)
      });
      appendAssistantEntry({
        userText: msg,
        answerEn: UI_TEXT.messageSentDirectly.en,
        answerAr: UI_TEXT.messageSentDirectly.ar,
        action: "focus-message",
        actionLabelEn: UI_TEXT.writeAnotherMessage.en,
        actionLabelAr: UI_TEXT.writeAnotherMessage.ar
      });
      setPendingSupportMessage("");
      setContactMessage("");
    } catch {
      appendAssistantEntry({
        userText: msg,
        answerEn: UI_TEXT.supportServerSlow.en,
        answerAr: UI_TEXT.supportServerSlow.ar,
        action: "send-support",
        actionLabelEn: UI_TEXT.tryAgain.en,
        actionLabelAr: UI_TEXT.tryAgain.ar
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
        message: buildContactSupportTranscript(msg)
      })
        .then(() => {
          appendAssistantEntry({
            userText: assistantLanguage === "ar" ? "إرسال الطلب" : "Send request",
            answerEn: UI_TEXT.thanksMessageSent.en,
            answerAr: UI_TEXT.thanksMessageSent.ar,
            action: "focus-message",
            actionLabelEn: UI_TEXT.writeAnotherMessage.en,
            actionLabelAr: UI_TEXT.writeAnotherMessage.ar
          });
          setPendingSupportMessage("");
        })
        .catch(() => {
          appendAssistantEntry({
            userText: assistantLanguage === "ar" ? "إرسال الطلب" : "Send request",
            answerEn: UI_TEXT.supportServerSlowRetry.en,
            answerAr: UI_TEXT.supportServerSlowRetry.ar,
            action: "send-support",
            actionLabelEn: UI_TEXT.tryAgain.en,
            actionLabelAr: UI_TEXT.tryAgain.ar
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
      showUiAlert(
        t("missingDataTitle"),
        t("enterBusinessBasics"),
        t("enterBusinessBasicsCompact")
      );
      return;
    }

    if (phoneDigits.length < 7) {
      showUiAlert(
        t("invalidContactTitle"),
        t("validPhoneRequired"),
        t("validPhoneRequiredCompact")
      );
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
      showUiAlert(t("doneTitle"), t("businessRequestSent"), t("businessRequestSentCompact"));
    } catch (err) {
      showUiAlert(t("errorTitle"), err.message || t("failedToSendBusinessRequest"), t("failedToSendBusinessRequest"));
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
    fontSize: Math.round((isLargeTablet ? 28 : isTablet ? 24 : isSmallPhone ? 19.5 : isAndroid ? 34 : 38) * uiScale)
  };

  const welcomeSubResponsive = {
    fontSize: Math.round((isLargeTablet ? 18 : isTablet ? 16 : isSmallPhone ? 14 : isAndroid ? 22 : 24) * uiScale)
  };

  const searchBarResponsive = {
    minHeight: Math.round((isLargeTablet ? 62 : isTablet ? 56 : isSmallPhone ? 46 : isAndroid ? 58 : 64) * heightScale),
    borderRadius: Math.round((isLargeTablet ? 24 : isTablet ? 22 : 26) * uiScale),
    paddingHorizontal: Math.round((isLargeTablet ? 18 : isSmallPhone ? 14 : 16) * widthScale)
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
    fontSize: Math.round((isLargeTablet ? 17 : isTablet ? 15 : isSmallPhone ? 13.5 : 17) * uiScale)
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
    paddingTop: Math.round((isLargeTablet ? 22 : isTablet ? 18 : isSmallPhone ? 6 : 14) * heightScale),
    paddingBottom:
      Math.round((isLargeTablet ? 116 : isTablet ? 108 : isSmallPhone ? 82 : isAndroid ? 96 : 116) * heightScale) +
      (isAndroid && adMobReady && !isExpoGo ? Math.round(74 * heightScale) : 0) +
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
    columnGap: isLargeTablet ? Math.round(22 * widthScale) : isAndroidTablet ? Math.round(18 * widthScale) : Math.round(16 * widthScale),
    marginBottom: isTablet ? tabletGridGap : Math.round(18 * heightScale)
  };

  const bottomBarContentHeight = Math.round(
    (isLargeTablet ? 82 : isAndroidTablet ? 80 : isTablet ? 78 : isSmallPhone ? 78 : 88) * heightScale
  );
  const bottomBarTotalHeight = isAndroid
    ? bottomBarContentHeight + androidNavigationInset
    : bottomBarContentHeight;
  const bottomBarTopRadius = Math.round((isLargeTablet ? 28 : isTablet ? 26 : 22) * uiScale);

  const bottomBarResponsive = isTablet
    ? {
        left: isAndroid ? 0 : undefined,
        right: isAndroid ? 0 : undefined,
        width: isAndroid ? screenWidth : Math.min(screenWidth - contentHorizontalInset * 2, isLargeTablet ? 820 : 720),
        alignSelf: isAndroid ? "stretch" : "center",
        bottom: isAndroid ? 0 : Math.round((isLargeTablet ? 18 : 14) * heightScale),
        height: bottomBarTotalHeight,
        borderRadius: isAndroid ? 0 : Math.round((isLargeTablet ? 30 : 28) * uiScale),
        borderTopLeftRadius: isAndroid ? bottomBarTopRadius : Math.round((isLargeTablet ? 30 : 28) * uiScale),
        borderTopRightRadius: isAndroid ? bottomBarTopRadius : Math.round((isLargeTablet ? 30 : 28) * uiScale),
        shadowOpacity: isAndroid ? 0 : 0.2,
        shadowRadius: isAndroid ? 0 : 14,
        shadowOffset: isAndroid ? { width: 0, height: 0 } : { width: 0, height: 10 },
        elevation: isAndroid ? 0 : 12
      }
      : isAndroid
      ? {
          left: 0,
          right: 0,
          width: screenWidth,
          alignSelf: "stretch",
          bottom: 0,
          height: bottomBarTotalHeight,
          borderRadius: 0,
          borderTopLeftRadius: bottomBarTopRadius,
          borderTopRightRadius: bottomBarTopRadius,
          shadowOpacity: 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
          elevation: 0
        }
      : {};

  const bottomBarSurfaceResponsive = isAndroid
    ? {
        borderRadius: 0,
        borderTopLeftRadius: bottomBarTopRadius,
        borderTopRightRadius: bottomBarTopRadius,
        paddingBottom: androidNavigationInset + Math.round((isTablet ? 8 : isSmallPhone ? 6 : 8) * heightScale),
        paddingTop: Math.round((isTablet ? 8 : isSmallPhone ? 6 : 8) * heightScale),
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0
      }
    : {};

  const bottomSideVisualSlotResponsive = {
    width: Math.round((isLargeTablet ? 62 : isAndroidTablet ? 58 : isTablet ? 58 : isSmallPhone ? 48 : 58) * widthScale),
    height: Math.round((isLargeTablet ? 44 : isAndroidTablet ? 42 : isTablet ? 42 : isSmallPhone ? 38 : 46) * heightScale),
    marginBottom: 0
  };
  const bottomItemResponsive = {
    justifyContent: "center",
    paddingBottom: 0,
    paddingTop: 0
  };

  const bottomTextResponsive = {
    fontSize: Math.round((isLargeTablet ? 12.5 : isAndroidTablet ? 11.5 : isTablet ? 11.8 : isSmallPhone ? 8.8 : 12.2) * uiScale),
    marginTop: Math.round((isSmallPhone ? 1 : 2) * heightScale),
    textAlign: "center",
    paddingHorizontal: Math.round((isTablet ? 6 : isSmallPhone ? 1 : 4) * widthScale),
    lineHeight: Math.round((isLargeTablet ? 15 : isAndroidTablet ? 13 : isTablet ? 14 : isSmallPhone ? 10 : 14) * uiScale),
    includeFontPadding: false
  };

  const bottomSideTextResponsive = {
    marginTop: Math.round((isSmallPhone ? 1 : 2) * heightScale)
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
    width: Math.round((isLargeTablet ? 58 : isAndroidTablet ? 56 : isTablet ? 52 : isSmallPhone ? 48 : isAndroid ? 66 : 64) * uiScale),
    height: Math.round((isLargeTablet ? 58 : isAndroidTablet ? 56 : isTablet ? 52 : isSmallPhone ? 48 : isAndroid ? 66 : 64) * uiScale),
    borderRadius: Math.round((isLargeTablet ? 29 : isAndroidTablet ? 28 : isTablet ? 26 : isSmallPhone ? 24 : isAndroid ? 33 : 32) * uiScale),
    marginTop: Math.round((isLargeTablet ? 0 : isAndroidTablet ? 0 : isTablet ? 0 : isSmallPhone ? -2 : isAndroid ? -1 : -4) * heightScale)
  };

  const bottomCenterBadgeShadowResponsive = {
    width: Math.round((isTablet ? 60 : isAndroid ? 66 : 74) * uiScale),
    height: Math.round((isTablet ? 60 : isAndroid ? 66 : 74) * uiScale),
    borderRadius: Math.round((isTablet ? 30 : isAndroid ? 33 : 37) * uiScale),
    top: Math.round((isTablet ? -3 : isAndroid ? -6 : -7) * heightScale)
  };

  const bottomCenterTextResponsive = {
    fontSize: Math.round((isLargeTablet ? 11.5 : isAndroidTablet ? 10 : isTablet ? 10.5 : isSmallPhone ? 7.6 : 11.5) * uiScale),
    marginTop: Math.round((isLargeTablet ? 1 : isAndroidTablet ? 1 : isTablet ? 2 : isSmallPhone ? 0 : isAndroid ? 1 : 4) * heightScale),
    textAlign: "center",
    paddingHorizontal: Math.round((isSmallPhone ? 0 : 6) * widthScale),
    lineHeight: Math.round((isLargeTablet ? 12 : isAndroidTablet ? 11 : isTablet ? 12 : isSmallPhone ? 8 : 13) * uiScale)
  };

  const bottomCenterSubTextResponsive = {
    fontSize: Math.round((isLargeTablet ? 8.5 : isAndroidTablet ? 8 : isTablet ? 8.5 : isSmallPhone ? 7.2 : 8.5) * uiScale),
    marginTop: Math.round((isLargeTablet ? -1 : isAndroidTablet ? -1 : isTablet ? 0 : isSmallPhone ? -3 : isAndroid ? -2 : 0) * heightScale),
    textAlign: "center",
    color: isTablet ? "#ffd7f3" : "#ffd0f0"
  };

  const bottomCenterFloatingResponsive = {
    top: Math.round((isLargeTablet ? -8 : isAndroidTablet ? -6 : isSmallPhone ? -8 : isAndroid ? -6 : -18) * heightScale),
    width: Math.round((isLargeTablet ? 132 : isAndroidTablet ? 124 : isTablet ? 116 : isSmallPhone ? 94 : 124) * widthScale),
    marginLeft: Math.round((isLargeTablet ? -66 : isAndroidTablet ? -62 : isTablet ? -58 : isSmallPhone ? -47 : -62) * widthScale)
  };

  const categoryCardResponsive = {
    height: isTablet ? tabletCardHeight : Math.round((isSmallPhone ? 156 : isAndroid ? 158 : 164) * heightScale),
    paddingVertical: Math.round((isLargeTablet ? 18 : isAndroidTablet ? 16 : isTablet ? 13 : isSmallPhone ? 8 : 12) * heightScale),
    borderRadius: Math.round((isTablet ? 22 : 26) * uiScale),
    paddingHorizontal: Math.round((isLargeTablet ? 14 : isAndroidTablet ? 12 : isTablet ? 10 : 12) * widthScale),
    marginBottom: isTablet ? 0 : Math.round((isTablet ? 4 : 6) * heightScale)
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
    fontSize: Math.round((isLargeTablet ? 18 : isTablet ? 14 : isSmallPhone ? 11.8 : 15) * uiScale),
    minHeight: Math.round((isLargeTablet ? 34 : isTablet ? 26 : isSmallPhone ? 22 : 28) * heightScale)
  };

  const categoryTextSubResponsive = {
    fontSize: Math.round((isLargeTablet ? 13 : isTablet ? 11 : isSmallPhone ? 8.4 : 12) * uiScale),
    lineHeight: Math.round((isLargeTablet ? 18 : isTablet ? 15 : isSmallPhone ? 11.2 : 17) * uiScale),
    minHeight: Math.round((isLargeTablet ? 34 : isTablet ? 24 : isSmallPhone ? 34 : 32) * heightScale)
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
    top: Math.round((isTablet ? 32 : 28) * heightScale) + insets.top,
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

  const showIntroBrandOverlay = true;

  const introResizeMode = "cover";

  const introImageResponsive =
    {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: 0,
      overflow: "hidden"
    };

  const introTintResponsive = {
    backgroundColor: isTablet ? "rgba(34, 0, 48, 0.12)" : "rgba(34, 0, 48, 0.22)"
  };

  const hintOverlayResponsive = {
    paddingBottom: Math.round((isTablet ? 96 : isSmallPhone ? 88 : 138) * heightScale),
    paddingHorizontal: Math.round((isTablet ? 20 : isSmallPhone ? 12 : 24) * widthScale)
  };

  const hintCardResponsive = {
    maxWidth: isTablet ? 330 : isSmallPhone ? 252 : 340,
    paddingHorizontal: Math.round((isTablet ? 16 : isSmallPhone ? 10 : 18) * widthScale),
    paddingTop: Math.round((isTablet ? 14 : isSmallPhone ? 8 : 16) * heightScale),
    paddingBottom: Math.round((isTablet ? 12 : isSmallPhone ? 8 : 14) * heightScale)
  };
  const modalSafeBottomInset = Math.max(insets.bottom, androidNavigationInset, Math.round(10 * heightScale));
  const centeredModalBackdropResponsive = {
    paddingTop: Math.max(insets.top, Math.round(18 * heightScale)),
    paddingBottom: modalSafeBottomInset,
    paddingHorizontal: Math.round((isTablet ? 20 : 14) * widthScale)
  };
  const bottomSheetCardResponsive = {
    paddingBottom: modalSafeBottomInset
  };
  const bottomSheetInnerResponsive = {
    paddingBottom: Math.round((isTablet ? 18 : 14) * heightScale) + modalSafeBottomInset
  };
  const contactCardAndroidResponsive = {
    paddingBottom: Math.round(8 * heightScale) + modalSafeBottomInset,
    maxHeight: screenHeight - Math.max(insets.top, Math.round(18 * heightScale))
  };

  const bottomCenterVisualSlotResponsive = null;
  const adMobModule = !isExpoGo
    ? (() => {
        try {
          return adMobModuleRef.current || require("react-native-google-mobile-ads");
        } catch {
          return null;
        }
      })()
    : null;
  const BannerAdComponent = adMobModule?.BannerAd || null;
  const BannerAdSizeValue = adMobModule?.BannerAdSize || null;
  const BannerTestIds = adMobModule?.TestIds || null;
  const resolvedBannerSize =
    bannerSizeMode === "compact" && BannerAdSizeValue?.BANNER
      ? BannerAdSizeValue.BANNER
      : BannerAdSizeValue?.ANCHORED_ADAPTIVE_BANNER || null;
  const bannerAdUnitId =
    __DEV__ && BannerTestIds?.ADAPTIVE_BANNER
      ? BannerTestIds.ADAPTIVE_BANNER
      : ANDROID_BANNER_AD_UNIT_ID;
  const bannerShellResponsive =
    isAndroid && adMobReady && BannerAdComponent
      ? {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: bottomBarTotalHeight + Math.round((isSmallPhone ? 8 : 12) * heightScale),
          alignItems: "center",
          zIndex: 35,
          elevation: 6
        }
      : null;
  const bannerCardResponsive = {
    width: Math.min(screenWidth - Math.round(20 * widthScale), bodyContentWidth),
    minHeight: Math.round(54 * heightScale),
    borderRadius: Math.round(18 * uiScale),
    paddingVertical: Math.round(4 * heightScale),
    paddingHorizontal: Math.round(4 * widthScale),
    overflow: "hidden"
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.container, themeStyles.container]}>
      <StatusBar style="light" />
      {!showIntro ? (
        <>
          {!isDarkTheme ? <View style={[styles.appGlowTop, themeStyles.appGlowTop]} pointerEvents="none" /> : null}
          {!isDarkTheme ? <View style={[styles.appGlowBottom, themeStyles.appGlowBottom]} pointerEvents="none" /> : null}
          {!isDarkTheme ? <View style={[styles.appGlowMid, themeStyles.appGlowMid]} pointerEvents="none" /> : null}

          <Animated.View style={[styles.hero, heroResponsive, heroAnimatedStyle]}>
        {!isDarkTheme ? <View style={styles.heroBlob1} /> : null}
        {!isDarkTheme ? <View style={styles.heroBlob2} /> : null}
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
            <Text numberOfLines={1} style={[styles.welcomeTitle, welcomeTitleResponsive, arabicUiFont]}>{t("welcomeTitle")}</Text>
            <Text numberOfLines={1} style={[styles.welcomeSub, welcomeSubResponsive, arabicUiFont]}>{t("welcomeSub")}</Text>
          </View>
          {detailGroup ? (
            <Pressable style={styles.heroBackBtn} onPress={closeDetailView}>
              <Text style={[styles.heroBackText, arabicUiFont]}>{t("back")}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.heroInfoBtn} onPress={() => setAboutModalVisible(true)}>
              <Ionicons name="information-circle" size={heroInfoIconSize} color="#ffffff" />
            </Pressable>
          )}
        </View>

        <Animated.View style={[styles.searchShell, searchShellAnimatedStyle]}>
          <View style={[styles.searchBar, searchBarResponsive, themeStyles.searchBar]}>
          {query.trim() && isArabicInput ? (
            <TouchableOpacity style={[styles.clearSearchBtn, styles.clearSearchBtnLeft, themeStyles.clearSearchBtn]} onPress={clearSearch}>
              <Text style={[styles.clearSearchText, themeStyles.clearSearchText]}>×</Text>
            </TouchableOpacity>
          ) : null}
          <TextInput
            ref={searchInputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={t("searchPlaceholder")}
            placeholderTextColor={isDarkTheme ? "rgba(255,255,255,0.66)" : "#8b8b8b"}
            style={[styles.searchInput, searchInputResponsive, themeStyles.searchInput, arabicUiFont]}
          />
          {query.trim() && !isArabicInput ? (
            <TouchableOpacity style={[styles.clearSearchBtn, styles.clearSearchBtnRight, themeStyles.clearSearchBtn]} onPress={clearSearch}>
              <Text style={[styles.clearSearchText, themeStyles.clearSearchText]}>×</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.searchIconBadge, searchIconBadgeResponsive, themeStyles.searchIconBadge]} onPress={handleSearchIconPress} activeOpacity={0.85}>
            <Text style={[styles.searchIcon, searchIconTextResponsive]}>🔎</Text>
          </TouchableOpacity>
          </View>
          <View style={styles.searchMetaRow}>
            <Text style={[styles.searchCaption, arabicUiFont]}>{t("searchCaption")}</Text>
            <View style={styles.headerControlsRow}>
              <View style={[styles.appLanguageToggle, themeStyles.appLanguageToggle]}>
                <TouchableOpacity
                  style={[styles.appLanguageBtn, appLanguage === "ar" && styles.appLanguageBtnActive]}
                  onPress={() => applyAppLanguage("ar")}
                  activeOpacity={0.86}
                >
                  <Text style={[styles.appLanguageBtnText, appLanguage === "ar" && styles.appLanguageBtnTextActive, arabicUiFont]}>
                    {t("languageArabic")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.appLanguageBtn, appLanguage === "en" && styles.appLanguageBtnActive]}
                  onPress={() => applyAppLanguage("en")}
                  activeOpacity={0.86}
                >
                  <Text style={[styles.appLanguageBtnText, appLanguage === "en" && styles.appLanguageBtnTextActive]}>
                    {t("languageEnglish")}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.appThemeBtn, themeStyles.appThemeBtn]}
                onPress={cycleThemePreference}
                activeOpacity={0.86}
              >
                <Ionicons name={themeIconName} size={13} color="#ffffff" />
                <Text style={[styles.appThemeBtnText, arabicUiFont]}>{themeLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
          </Animated.View>

          <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, contentResponsive]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
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
          <View style={[styles.suggestBox, fullWidthCard, themeStyles.surface]}>
            {predictions.map((p) => (
              <TouchableOpacity key={p.id} style={[styles.suggestItem, suggestItemResponsive, isDarkTheme && { borderBottomColor: "rgba(255,255,255,0.08)" }]} onPress={() => handlePredictionPress(p)}>
                <View style={styles.suggestMeta}>
                  <Text style={[styles.suggestText, suggestTextResponsive, themeStyles.text, arabicUiFont]}>{getContactDisplayName(p, appLanguage)}</Text>
                  {renderContactBadges(p, true)}
                  <Text style={[styles.suggestCategoryPreview, suggestCategoryPreviewResponsive, themeStyles.softText, arabicUiFont]}>
                    {getCategoryDisplayName(p.category_slug, p.category_name_ar, appLanguage)}
                  </Text>
                  <View style={styles.suggestBottomRow}>
                    <TouchableOpacity style={[styles.suggestPhoneBadge, suggestPhoneBadgeResponsive, isDarkTheme && themeStyles.chip]} onPress={() => callNumber(p)} disabled={!!p.is_non_phone}>
                      <Text style={[styles.suggestPhonePreview, suggestPhonePreviewResponsive, arabicUiFont]}>{p.phone || "--"}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.suggestHint, isDarkTheme && { color: "#c4b5fd" }, arabicUiFont]}>{t("tapToView")}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          </Animated.View>
        ) : null}

        {!predictions.length && typoSuggestion ? (
          <TouchableOpacity style={[styles.typoBox, fullWidthCard, themeStyles.chip]} onPress={() => handlePredictionPress(typoSuggestion)}>
            <Text style={[styles.typoText, isDarkTheme && { color: "#c4b5fd" }, arabicUiFont]}>{t("didYouMeanPrefix")} {typoSuggestion} ?</Text>
          </TouchableOpacity>
        ) : null}

        {quickResult ? (
          <View style={[styles.quickResultCard, fullWidthCard, themeStyles.surfaceStrong]}>
            {renderContactHero(quickResult, true)}
            {renderContactBadges(quickResult)}
            {renderContactPriorityPhone(quickResult, true)}
            {renderContactMeta(quickResult, true)}
            {quickResult.is_non_phone ? (
              <Text style={[styles.nonPhone, arabicUiFont]}>{t("nonPhone")}</Text>
            ) : null}
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
              themeStyles.surfaceStrong,
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
              <Text style={[styles.focusedTitle, themeStyles.text, arabicUiFont]} numberOfLines={1} ellipsizeMode="tail">
                {getGroupTitle(focusedGroup.key, appLanguage)} / {getGroupSubtitle(focusedGroup.key, appLanguage)}
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
                  return <Text style={[styles.error, arabicUiFont]}>{t("noCategoryData")}</Text>;
                }
                return groupItems.map((cat) => {
                  const forceExpanded = cat.slug === "emergency";
                  const opened = forceExpanded || detailCategory === cat.slug;
                  const detailContacts = getDetailContactsForSlug(cat.slug);
                  const showScrollArrow = opened && detailContacts.length > 1;
                  return (
                    <View
                      key={cat.slug}
                      style={[
                        styles.subCard,
                        themeStyles.surface,
                        {
                          backgroundColor: isDarkTheme
                            ? (opened
                              ? (GROUP_COLORS[cat.group] || {}).darkCardActive || (GROUP_COLORS[cat.group] || {}).darkCard || "#2b2438"
                              : (GROUP_COLORS[cat.group] || {}).darkCard || "#2b2438")
                            : (GROUP_COLORS[cat.group] || {}).cardActive || (GROUP_COLORS[cat.group] || {}).card || "#ffffff",
                          borderColor: isDarkTheme
                            ? applyHexAlpha((GROUP_COLORS[cat.group] || {}).accent || "#b30f7f", "88")
                            : applyHexAlpha((GROUP_COLORS[cat.group] || {}).accent || "#b30f7f", "55")
                        }
                      ]}
                      onLayout={(e) => {
                        detailCategoryPositionsRef.current[cat.slug] = e.nativeEvent.layout.y;
                      }}
                    >
                      <Pressable
                        style={({ pressed }) => [styles.subHeader, pressed && { opacity: 0.85 }]}
                        onPress={() => {
                          if (forceExpanded) return;
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
                        <Text style={[styles.subTitle, isDarkTheme ? styles.subTitleSolidDark : themeStyles.text, arabicUiFont]} numberOfLines={1} ellipsizeMode="tail">
                          {cat.name}
                        </Text>
                        {!forceExpanded ? (
                          <Text style={[styles.subToggle, isDarkTheme ? styles.subToggleSolidDark : themeStyles.softText]}>{opened ? "▲" : "▼"}</Text>
                        ) : null}
                      </Pressable>
                      {opened ? (
                        <View style={styles.detailOpenListWrap}>
                          <ScrollView
                            ref={(node) => {
                              if (node) detailScrollRefs.current[cat.slug] = node;
                            }}
                            style={[styles.detailOpenList, detailOpenListResponsive]}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator
                            keyboardShouldPersistTaps="handled"
                            onScroll={(event) => {
                              detailScrollOffsetsRef.current[cat.slug] = event.nativeEvent.contentOffset.y || 0;
                            }}
                            scrollEventThrottle={16}
                          >
                          {detailContacts.map((item) => {
                              const palette = GROUP_COLORS[cat.group] || { accent: "#ff3b81", card: "#ffffffee" };
                              lastDetail.current = { group: focusedGroup.key, category: cat.slug };
                              return (
                                <View
                                  key={item.id}
                                  onLayout={(e) => scrollToContactCard(item.id, e.nativeEvent.layout.y)}
                                  style={[
                                    styles.hotlineCard,
                                    {
                                      backgroundColor: isDarkTheme
                                        ? item.is_featured
                                          ? palette.darkCardActive || palette.darkCard || "#2b2438"
                                          : palette.darkCard || "#2b2438"
                                        : item.is_featured
                                          ? palette.cardActive || palette.card
                                          : palette.card,
                                      shadowColor: palette.accent,
                                      borderColor: isDarkTheme
                                        ? applyHexAlpha(palette.accent, "88")
                                        : applyHexAlpha(palette.accent, item.is_featured ? "66" : "44")
                                    },
                                    item.is_featured && styles.hotlineCardFeatured
                                  ]}
                                >
                                  <View style={styles.hotlineBody}>
                                    {renderContactHero(item)}
                                    {renderContactBadges(item)}
                                    {renderContactPriorityPhone(item)}
                                    {renderContactMeta(item)}
                                    {item.is_non_phone ? (
                                      <Text style={[styles.nonPhone, arabicUiFont]}>{t("nonPhone")}</Text>
                                    ) : null}
                                  </View>
                                </View>
                              );
                            })}
                          </ScrollView>
                          {showScrollArrow ? (
                            <TouchableOpacity
                              style={styles.detailScrollHint}
                              activeOpacity={0.86}
                              onPress={() => scrollDetailCategoryDown(cat.slug)}
                            >
                              <Ionicons name="chevron-down" size={18} color="#ffffff" />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                });
              })()}
            </View>
          </Animated.View>
        ) : null}
          </Animated.ScrollView>

          {!showSuggestHint && isAndroid && adMobReady && BannerAdComponent && resolvedBannerSize ? (
        <View style={bannerShellResponsive} pointerEvents="box-none">
          <View style={[styles.bannerCard, bannerCardResponsive, themeStyles.surfaceStrong]}>
            <BannerAdComponent
              key={`banner-${bannerSizeMode}`}
              unitId={bannerAdUnitId}
              size={resolvedBannerSize}
              requestOptions={{ requestNonPersonalizedAdsOnly: true }}
              onAdFailedToLoad={() => {
                if (bannerSizeMode !== "compact" && BannerAdSizeValue?.BANNER) {
                  setBannerSizeMode("compact");
                }
              }}
            />
          </View>
          </View>
          ) : null}

          <View style={[styles.bottomBarShell, bottomBarResponsive]} pointerEvents="box-none">
          <LinearGradient colors={["#6c47f5", "#b30f7f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bottomBar, bottomBarSurfaceResponsive]}>
            <TouchableOpacity style={[styles.bottomItem, bottomItemResponsive]} onPress={onPrimaryNavPress}>
              <View style={[styles.bottomVisualSlot, styles.bottomSideVisualSlot, bottomSideVisualSlotResponsive]}>
                <Ionicons name="rocket-outline" size={bottomSideIconSize} color="#ffffff" />
              </View>
              <Text numberOfLines={1} style={[styles.bottomText, styles.bottomSideText, bottomTextResponsive, bottomSideTextResponsive, arabicUiFont]}>
                {isArabicUi ? "ترويج" : "Promote"}
              </Text>
            </TouchableOpacity>
            <View style={styles.bottomCenterSpacer} />
            <TouchableOpacity style={[styles.bottomItem, bottomItemResponsive]} onPress={() => setAddModalVisible(true)}>
              <View style={[styles.bottomVisualSlot, styles.bottomSideVisualSlot, bottomSideVisualSlotResponsive]}>
                <Ionicons name="add-circle-outline" size={bottomSideIconSize} color="#ffffff" />
              </View>
              <Text numberOfLines={1} style={[styles.bottomText, styles.bottomSideText, bottomTextResponsive, bottomSideTextResponsive, arabicUiFont]}>
                {isArabicUi ? "إضافة رقم" : "Add Number"}
              </Text>
            </TouchableOpacity>
          </LinearGradient>

          <TouchableOpacity style={[styles.bottomCenterFloating, styles.bottomCenterItem, bottomCenterFloatingResponsive]} onPress={() => setContactModalVisible(true)}>
            <View style={styles.bottomVisualSlot}>
              <View style={[styles.bottomCenterBadge, bottomCenterBadgeResponsive]}>
                <Ionicons name="phone-portrait" size={bottomCenterIconSize + 1} color="#9a0f6f" />
                <View style={styles.bottomAssistantSparkles}>
                  <Ionicons name="sparkles" size={11} color="#ffffff" />
                </View>
              </View>
            </View>
            <Text numberOfLines={1} style={[styles.bottomCenterText, bottomCenterTextResponsive, arabicUiFont]}>
              {isArabicUi ? "تواصل معنا " : "Contact us "}<Text style={styles.bottomCenterAiText}>(AI)</Text>
            </Text>
          </TouchableOpacity>
          </View>
        </>
      ) : null}

      <Modal transparent visible={addModalVisible} animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={[styles.modalBackdrop, centeredModalBackdropResponsive, styles.sheetBackdrop]} onPress={() => setAddModalVisible(false)}>
            <Animated.View
              {...addSheetResponder.panHandlers}
              style={[
                styles.sheetCard,
                bottomSheetCardResponsive,
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
                <View style={[styles.modalCard, styles.suggestCard, styles.sheetInner, bottomSheetInnerResponsive, themeStyles.modalCard]}>
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
                      <Text style={[styles.modalTitle, themeStyles.text]}>{t("suggestNumberTitle")}</Text>
                      <Text style={[styles.modalSubTitle, themeStyles.mutedText]}>{t("suggestNumberSub")}</Text>
                    </View>
                    <TextInput
                      style={[styles.modalInput, styles.suggestInput, themeStyles.input]}
                      placeholder={t("suggestNamePlaceholder")}
                      placeholderTextColor={themePalette.placeholder}
                      value={newHotlineName}
                      onChangeText={setNewHotlineName}
                    />
                    <TextInput
                      style={[styles.modalInput, styles.suggestInput, themeStyles.input]}
                      placeholder={t("suggestPhonePlaceholder")}
                      placeholderTextColor={themePalette.placeholder}
                      keyboardType="phone-pad"
                      value={newHotlinePhone}
                      onChangeText={setNewHotlinePhone}
                    />
                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleAddHotlineSubmit}>
                        <Text style={styles.modalBtnPrimaryText}>{t("send")}</Text>
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
        <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === "ios" ? "padding" : "padding"}>
          <View style={[styles.modalBackdrop, centeredModalBackdropResponsive, isAndroid && styles.contactBackdropAndroid]}>
            <View style={[styles.modalCard, styles.suggestCard, styles.contactCard, isAndroid && styles.contactCardAndroid, isAndroid && contactCardAndroidResponsive, themeStyles.modalCard]}>
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
                  <Text style={[styles.modalTitle, themeStyles.text, arabicAssistantFont]}>{tAssistant("contactModalTitle")}</Text>
                  <Text style={[styles.modalSubTitle, themeStyles.mutedText, arabicAssistantFont]}>{tAssistant("contactModalSub")}</Text>
                </View>

                <View style={styles.assistantLanguageRow}>
                  <TouchableOpacity
                    style={[
                      styles.assistantLanguageBtn,
                      isDarkTheme && themeStyles.chip,
                      assistantLanguage === "ar" && styles.assistantLanguageBtnActive
                    ]}
                    onPress={() => applyAssistantLanguage("ar")}
                  >
                    <Text
                      style={[
                        styles.assistantLanguageText,
                        isDarkTheme && themeStyles.mutedText,
                        assistantLanguage === "ar" && styles.assistantLanguageTextActive,
                        arabicAssistantFont
                      ]}
                    >
                      {tAssistant("assistantLanguageArabic")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.assistantLanguageBtn,
                      isDarkTheme && themeStyles.chip,
                      assistantLanguage === "en" && styles.assistantLanguageBtnActive
                    ]}
                    onPress={() => applyAssistantLanguage("en")}
                  >
                    <Text
                      style={[
                        styles.assistantLanguageText,
                        isDarkTheme && themeStyles.mutedText,
                        assistantLanguage === "en" && styles.assistantLanguageTextActive
                      ]}
                    >
                      {tAssistant("assistantLanguageEnglish")}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.quickQuestionsToggle, themeStyles.surface]}
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
                    <Text style={[styles.assistantSectionTitle, themeStyles.text, arabicAssistantFont]}>
                      {tAssistant("quickQuestionsTitle")}
                    </Text>
                    <Text style={[styles.assistantSectionSub, themeStyles.softText, arabicAssistantFont]}>
                      {tAssistant("quickQuestionsSub")}
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
                            isDarkTheme && themeStyles.chip,
                            selectedContactTopic === topic.key && styles.chatQuickChipActive
                          ]}
                          onPress={() => handleContactTopicPress(topic)}
                        >
                          <Text
                            style={[
                            styles.chatQuickChipText,
                            isDarkTheme && { color: "#ddd6fe" },
                            selectedContactTopic === topic.key && styles.chatQuickChipTextActive
                          ]}
                          >
                            {assistantLanguage === "ar" ? topic.questionAr : topic.questionEn}
                          </Text>
                        </TouchableOpacity>

                        {selectedContactTopic === topic.key ? (
                          <View style={[styles.chatBubble, styles.chatBotBubble, styles.chatInlineAnswer, themeStyles.chatBotBubble]}>
                            <Text style={[styles.chatBubbleLabel, arabicAssistantFont]}>Hotline Assistant</Text>
                            <Text style={[styles.chatBubbleText, themeStyles.mutedText, arabicAssistantFont]}>
                              {assistantLanguage === "ar" ? topic.answerAr : topic.answerEn}
                            </Text>
                            {topic.action ? (
                              <TouchableOpacity
                                style={styles.chatActionBtn}
                                onPress={() => handleContactAssistantAction(topic.action)}
                              >
                                <Text style={[styles.chatActionBtnText, arabicAssistantFont]}>
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
                  <Text style={[styles.assistantSectionTitle, themeStyles.text, arabicAssistantFont]}>
                    {tAssistant("assistantChatTitle")}
                  </Text>
                  <Text style={[styles.assistantSectionSub, themeStyles.softText, arabicAssistantFont]}>
                    {tAssistant("assistantChatSub")}
                  </Text>
                </View>

                <View style={styles.chatThread}>
                  <View style={[styles.chatBubble, styles.chatBotBubble, themeStyles.chatBotBubble]}>
                    <Text style={[styles.chatBubbleLabel, arabicAssistantFont]}>{tAssistant("hotlineAssistantLabel")}</Text>
                    <Text style={[styles.chatBubbleText, themeStyles.mutedText, arabicAssistantFont]}>
                      {tAssistant("assistantGreeting")}
                    </Text>
                  </View>

                  {contactAssistantHistory.map((entry, index) => {
                    const topic = CONTACT_ASSISTANT_TOPICS.find((item) => item.key === entry.topicKey);
                    return (
                      <View key={entry.id || `${topic?.key || "entry"}-${index}`} style={styles.chatThreadPair}>
                        <View style={[styles.chatBubble, styles.chatUserBubble]}>
                          <Text style={[styles.chatBubbleText, styles.chatUserBubbleText, arabicAssistantFont]}>
                            {entry.userText || (assistantLanguage === "ar" ? topic?.questionAr : topic?.questionEn)}
                          </Text>
                        </View>

                        {assistantTypingId === entry.id && !entry.assistantVisible ? (
                          <View style={[styles.chatBubble, styles.chatBotBubble, styles.chatTypingBubble, themeStyles.chatBotBubble]}>
                            <Text style={[styles.chatTypingText, arabicAssistantFont]}>{tAssistant("typing")}</Text>
                          </View>
                        ) : null}

                        {entry.assistantVisible ? (
                          <View style={[styles.chatBubble, styles.chatBotBubble, themeStyles.chatBotBubble]}>
                            <Text style={[styles.chatBubbleLabel, arabicAssistantFont]}>{tAssistant("hotlineAssistantLabel")}</Text>
                            <Text style={[styles.chatBubbleText, themeStyles.mutedText, arabicAssistantFont]}>
                              {assistantLanguage === "ar" ? entry.answerAr : entry.answerEn}
                            </Text>
                            {entry.action ? (
                              <TouchableOpacity
                                style={styles.chatActionBtn}
                                onPress={() => handleContactAssistantAction(entry.action)}
                              >
                                <Text style={[styles.chatActionBtnText, arabicAssistantFont]}>
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

                <Text style={[styles.chatComposerHint, themeStyles.softText, arabicAssistantFont]}>
                  {tAssistant("writeOwnMessage")}
                </Text>
                <TextInput
                  ref={contactComposerInputRef}
                  style={[styles.modalInput, styles.chatComposerInput, themeStyles.input, arabicAssistantFont]}
                  placeholder={tAssistant("messagePlaceholder")}
                  placeholderTextColor={themePalette.placeholder}
                  multiline
                  textAlignVertical="top"
                  value={contactMessage}
                  onChangeText={setContactMessage}
                />
                <View style={styles.contactFooterRow}>
                  <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setContactModalVisible(false)}>
                    <Text style={[styles.modalBtnGhostText, arabicAssistantFont]}>{tAssistant("close")}</Text>
                  </TouchableOpacity>
                  <View style={styles.contactPrimaryActions}>
                    <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleContactSubmit}>
                      <Text style={[styles.modalBtnPrimaryText, arabicAssistantFont]}>{tAssistant("askAssistant")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleDirectContactSubmit}>
                      <Text style={[styles.modalBtnPrimaryText, arabicAssistantFont]}>{tAssistant("sendRequest")}</Text>
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
          <View style={[styles.modalBackdrop, centeredModalBackdropResponsive]}>
            <View style={[styles.modalCard, styles.suggestCard, styles.contactCard, themeStyles.modalCard]}>
              <View style={styles.sheetGlow} />
              <View style={styles.sheetGlowSecondary} />
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.suggestHero}>
                  <View style={[styles.suggestHeroBadge, styles.businessHeroBadge]}>
                    <Ionicons name="briefcase" size={22} color="#9a0f6f" />
                  </View>
                  <Text style={[styles.modalTitle, themeStyles.text]}>{t("businessRequestTitle")}</Text>
                  <Text style={[styles.modalSubTitle, themeStyles.mutedText]}>{t("businessRequestSub")}</Text>
                </View>
                <View style={styles.planSelectedBadge}>
                  <Text style={styles.planSelectedBadgeText}>
                    {selectedBusinessPlan} {t("selectedPlanSuffix")}
                  </Text>
                </View>
                <TextInput
                  style={[styles.modalInput, styles.suggestInput, themeStyles.input]}
                  placeholder={t("yourName")}
                  placeholderTextColor={themePalette.placeholder}
                  value={businessRequesterName}
                  onChangeText={setBusinessRequesterName}
                />
                <TextInput
                  style={[styles.modalInput, styles.suggestInput, themeStyles.input]}
                  placeholder={t("businessName")}
                  placeholderTextColor={themePalette.placeholder}
                  value={businessName}
                  onChangeText={setBusinessName}
                />
                <TextInput
                  style={[styles.modalInput, styles.suggestInput, themeStyles.input]}
                  placeholder={t("phoneOrWhatsapp")}
                  placeholderTextColor={themePalette.placeholder}
                  keyboardType="phone-pad"
                  value={businessPhone}
                  onChangeText={setBusinessPhone}
                />
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea, themeStyles.input]}
                  placeholder={t("requestDetails")}
                  placeholderTextColor={themePalette.placeholder}
                  multiline
                  textAlignVertical="top"
                  value={businessNote}
                  onChangeText={setBusinessNote}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setBusinessRequestVisible(false)}>
                    <Text style={styles.modalBtnGhostText}>{t("cancel")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleBusinessRequestSubmit}>
                    <Text style={styles.modalBtnPrimaryText}>{t("send")}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal transparent visible={businessModalVisible} animationType="fade" onRequestClose={() => setBusinessModalVisible(false)}>
        <View style={[styles.modalBackdrop, centeredModalBackdropResponsive]}>
          <View style={[styles.modalCard, styles.aboutCard, themeStyles.modalCard]}>
            <View style={styles.aboutHero}>
              <View style={styles.aboutHeroBadge}>
                  <Ionicons name="megaphone" size={24} color="#ffffff" />
              </View>
                <Text style={[styles.modalTitle, themeStyles.text]}>{t("businessPlansTitle")}</Text>
                <Text style={[styles.modalSubTitle, themeStyles.mutedText]}>{t("businessPlansSub")}</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.aboutSection, styles.businessSection, themeStyles.surface]}>
                <View style={styles.businessHeaderRow}>
                  <View style={styles.businessBadge}>
                    <Ionicons name="briefcase" size={18} color="#9a0f6f" />
                  </View>
                  <Text style={[styles.aboutHeading, themeStyles.text]}>{t("forBusiness")}</Text>
                </View>
                <Text style={[styles.aboutBody, themeStyles.mutedText, isArabicUi && styles.aboutBodyAr]}>{t("businessIntroAr1")}</Text>
                <Text style={[styles.aboutBody, themeStyles.mutedText]}>{t("businessIntroAr2")}</Text>

                <View style={styles.businessFeatureList}>
                  <View style={styles.businessFeatureItem}>
                    <Ionicons name="star" size={15} color="#d97706" />
                    <Text style={styles.businessFeatureText}>{t("featuredPlacement")}</Text>
                  </View>
                  <View style={styles.businessFeatureItem}>
                    <Ionicons name="shield-checkmark" size={15} color="#15803d" />
                    <Text style={styles.businessFeatureText}>{t("verifiedBadge")}</Text>
                  </View>
                  <View style={styles.businessFeatureItem}>
                    <Ionicons name="trending-up" size={15} color="#7c3aed" />
                    <Text style={styles.businessFeatureText}>{t("priorityRanking")}</Text>
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
                    <Text style={[styles.planBody, styles.planBodyAr]}>{isArabicUi ? "شارة موثقة لنشاطك التجاري لزيادة الثقة والاعتماد داخل التطبيق." : "Trusted badge for your business and stronger customer confidence."}</Text>
                    <Text style={styles.planBody}>{isArabicUi ? "حضور موثوق يزيد ثقة العملاء داخل التطبيق." : "Trusted badge for your business and stronger customer confidence."}</Text>
                    <TouchableOpacity style={styles.planBtn} onPress={() => openBusinessInquiry("Verified")}>
                      <Text style={styles.planBtnText}>{t("requestThisPlan")}</Text>
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
                    <Text style={[styles.planBody, styles.planBodyAr]}>{isArabicUi ? "ظهور أقوى داخل الفئات وترتيب أفضل في نتائج البحث." : "Higher visibility inside categories and better placement in search results."}</Text>
                    <Text style={styles.planBody}>{isArabicUi ? "ترتيب أوضح داخل الفئات والنتائج." : "Higher visibility inside categories and better placement in search results."}</Text>
                    <TouchableOpacity style={styles.planBtn} onPress={() => openBusinessInquiry("Featured")}>
                      <Text style={styles.planBtnText}>{t("requestThisPlan")}</Text>
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
                    <Text style={[styles.planBody, styles.planBodyAr]}>{isArabicUi ? "ظهور مميز + شارة موثقة + أولوية أعلى لأقوى حضور داخل التطبيق." : "Featured + Verified + top priority for the strongest exposure in the app."}</Text>
                    <Text style={styles.planBody}>{isArabicUi ? "أقوى باقة للظهور والثقة والأولوية." : "Featured + Verified + top priority for the strongest exposure in the app."}</Text>
                    <TouchableOpacity style={[styles.planBtn, styles.planBtnPremium]} onPress={() => openBusinessInquiry("Premium")}>
                      <Text style={styles.planBtnText}>{t("requestThisPlan")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => setBusinessModalVisible(false)}>
                <Text style={styles.modalBtnPrimaryText}>{t("close")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={aboutModalVisible} animationType="fade" onRequestClose={() => setAboutModalVisible(false)}>
        <View style={[styles.modalBackdrop, centeredModalBackdropResponsive]}>
          <View style={[styles.modalCard, styles.aboutCard, themeStyles.modalCard]}>
            <View style={styles.aboutHero}>
              <View style={styles.aboutHeroBadge}>
                <Ionicons name="information-circle" size={26} color="#ffffff" />
              </View>
              <Text style={[styles.modalTitle, themeStyles.text]}>{t("aboutUsTitle")}</Text>
              <Text style={[styles.modalSubTitle, themeStyles.mutedText]}>{t("aboutUsSub")}</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.aboutSection, themeStyles.surface]}>
                <Text style={[styles.aboutHeading, themeStyles.text]}>{t("aboutUsTitle")}</Text>
                <Text style={[styles.aboutBody, themeStyles.mutedText, isArabicUi && styles.aboutBodyAr]}>{t("aboutAr1")}</Text>
                <Text style={[styles.aboutBody, themeStyles.mutedText, isArabicUi && styles.aboutBodyAr]}>{t("aboutAr2")}</Text>
                <Text style={[styles.aboutBody, themeStyles.mutedText, isArabicUi && styles.aboutBodyAr]}>{t("aboutAr3")}</Text>
              </View>

              <View style={styles.aboutPillRow}>
                <View style={styles.aboutPill}>
                  <Ionicons name="flash" size={15} color="#7c3aed" />
                  <Text style={styles.aboutPillText}>{t("fastAccess")}</Text>
                </View>
                <View style={styles.aboutPill}>
                  <Ionicons name="call" size={15} color="#7c3aed" />
                  <Text style={styles.aboutPillText}>{t("usefulNumbers")}</Text>
                </View>
                <View style={styles.aboutPill}>
                  <Ionicons name="sparkles" size={15} color="#7c3aed" />
                  <Text style={styles.aboutPillText}>{t("communityUpdates")}</Text>
                </View>
              </View>

              <View style={[styles.aboutSection, themeStyles.surface]}>
                <Text style={[styles.aboutHeading, themeStyles.text]}>{t("aboutEnHeading")}</Text>
                <Text style={[styles.aboutBody, themeStyles.mutedText]}>{t("aboutEn1")}</Text>
                <Text style={[styles.aboutBody, themeStyles.mutedText]}>{t("aboutEn2")}</Text>
                <Text style={[styles.aboutBody, themeStyles.mutedText]}>{t("aboutEn3")}</Text>
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => setAboutModalVisible(false)}>
                <Text style={styles.modalBtnPrimaryText}>{t("close")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showIntro ? (
        <Pressable style={styles.introOverlay} onPress={handleIntroContinue} onPressIn={handleIntroContinue}>
          <ImageBackground pointerEvents="none" source={introLocal} style={[styles.introImage, introImageResponsive]} resizeMode={introResizeMode}>
            <View pointerEvents="none" style={[styles.introTint, introTintResponsive]} />
            {showIntroBrandOverlay ? (
              <View pointerEvents="none" style={[styles.introBrandWrap, introBrandWrapResponsive]}>
                <View style={styles.introBrandBadge}>
                  <Ionicons name="call" size={18} color="#ffffff" />
                </View>
                <Text style={[styles.introBrandTitle, introBrandTitleResponsive]}>Hotline App</Text>
                <Text style={[styles.introBrandSub, introBrandSubResponsive]}>
                  {isArabicUi ? "وصول سريع إلى الأرقام المهمة في مصر" : "Fast access to important numbers in Egypt"}
                </Text>
              </View>
            ) : null}
          </ImageBackground>
        </Pressable>
      ) : null}

      {showSuggestHint ? (
        <Pressable style={[styles.hintOverlay, hintOverlayResponsive]} onPress={dismissSuggestHint} onPressIn={dismissSuggestHint}>
          <Pressable style={styles.hintBackdropFill} onPress={dismissSuggestHint} onPressIn={dismissSuggestHint} />
          <TouchableOpacity activeOpacity={0.98} style={[styles.hintCard, hintCardResponsive, themeStyles.modalCard]} onPress={dismissSuggestHint} onPressIn={dismissSuggestHint}>
            <View style={styles.hintBadge}>
              <Ionicons name="sparkles" size={20} color="#b30f7f" />
            </View>
            <Text style={[styles.hintTitle, themeStyles.text]}>{t("quickServicesTitle")}</Text>
            <View style={styles.hintList}>
              <View style={[styles.hintItem, themeStyles.surface]}>
                <View style={[styles.hintMiniBadge, styles.hintMiniBusiness]}>
                  <Ionicons name="rocket-outline" size={15} color="#7c3aed" />
                </View>
                <Text style={[styles.hintItemText, themeStyles.mutedText, isArabicUi && styles.aboutBodyAr]}>
                  {isSmallPhone ? t("quickServicesPromoteShort") : t("quickServicesPromoteLong")}
                </Text>
              </View>
              <View style={[styles.hintItem, themeStyles.surface]}>
                <View style={[styles.hintMiniBadge, styles.hintMiniAdd]}>
                  <Ionicons name="add-circle-outline" size={15} color="#b30f7f" />
                </View>
                <Text style={[styles.hintItemText, themeStyles.mutedText, isArabicUi && styles.aboutBodyAr]}>
                  {isSmallPhone ? t("quickServicesAddShort") : t("quickServicesAddLong")}
                </Text>
              </View>
              <View style={[styles.hintItem, themeStyles.surface]}>
                <View style={[styles.hintMiniBadge, styles.hintMiniContact]}>
                  <Ionicons name="phone-portrait" size={14} color="#9a0f6f" />
                  <View style={styles.hintMiniContactSparkles}>
                    <Ionicons name="sparkles" size={7} color="#ffffff" />
                  </View>
                </View>
                <Text style={[styles.hintItemText, themeStyles.mutedText, isArabicUi && styles.aboutBodyAr]}>
                  {isSmallPhone ? t("quickServicesContactShort") : t("quickServicesContactLong")}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.hintBtn}
              onPress={dismissSuggestHint}
              onPressIn={dismissSuggestHint}
              activeOpacity={0.85}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            >
              <Text style={styles.hintBtnText}>{t("gotIt")}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
          <View style={styles.hintArrowWrap} pointerEvents="none">
            <View style={styles.hintArrowStem} />
            <Text style={styles.hintArrow}>⌄</Text>
          </View>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1
  },
  navSwipeEdgeLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 50
  },
  navSwipeEdgeRight: {
    position: "absolute",
    right: 0,
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
    marginBottom: 12
  },
  welcomeTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6
  },
  phoneIconWrap: {
    marginRight: 8,
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "transparent",
    padding: 0,
    shadowColor: "#0f1b66",
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0,
    borderWidth: 0,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center"
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
    marginLeft: 8,
    flex: 1
  },
  searchMetaRow: {
    marginTop: 6,
    marginHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  headerControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  appLanguageToggle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)"
  },
  appLanguageBtn: {
    minWidth: 36,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  appLanguageBtnActive: {
    backgroundColor: "#ffffff"
  },
  appLanguageBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800"
  },
  appLanguageBtnTextActive: {
    color: "#9a0f6f"
  },
  appThemeBtn: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1
  },
  appThemeBtnText: {
    color: "#ffffff",
    fontSize: 10.5,
    fontWeight: "800"
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
    backgroundColor: "rgba(255,255,255,0.84)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    padding: 16,
    marginBottom: 12,
    shadowColor: "#111827",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
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
  mobilityIconStack: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "100%",
    height: "100%"
  },
  retailIconStack: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    gap: 4
  },
  retailIconRowTop: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  retailIconRowBottom: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 3
  },
  retailTopIcon: {
    opacity: 0.96
  },
  retailBottomIcon: {
    opacity: 0.98
  },
  mobilityCarIcon: {
    position: "absolute",
    bottom: 0,
    left: "50%",
    marginLeft: -11
  },
  mobilityPlaneIcon: {
    position: "absolute",
    top: -6,
    right: -4,
    transform: [{ rotate: "-28deg" }]
  },
  mobilityBusIcon: {
    position: "absolute",
    bottom: 8,
    left: -1
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
    textAlignVertical: "center",
    includeFontPadding: true,
    paddingBottom: 2,
    paddingHorizontal: 2
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
  detailOpenListWrap: {
    position: "relative"
  },
  detailScrollHint: {
    position: "absolute",
    right: 10,
    bottom: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(179,15,127,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7a145d",
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4
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
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "#e5e7f0",
    padding: 10,
    gap: 8,
    shadowColor: "#12091f",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2
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
  subTitleSolidDark: {
    color: "#f8fafc"
  },
  subToggle: {
    color: "#6b7280",
    fontWeight: "700"
  },
  subToggleSolidDark: {
    color: "rgba(248,250,252,0.82)"
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
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    marginBottom: 12,
    borderWidth: 1,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  hotlineCardFeatured: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0
  },
  hotlineBody: {
    flex: 1
  },
  contactHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8
  },
  contactHeroRowCompact: {
    gap: 10,
    marginBottom: 7
  },
  contactHeroVisualShell: {
    width: 60,
    height: 60,
    borderRadius: 20,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    shadowColor: "#b30f7f",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  contactHeroVisualShellCompact: {
    width: 50,
    height: 50,
    borderRadius: 17,
    padding: 3
  },
  contactHeroVisualInner: {
    width: "100%",
    height: "100%",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.76)",
    overflow: "hidden"
  },
  contactHeroVisualInnerCompact: {
    borderRadius: 13
  },
  contactHeroVisualInnerPlain: {
    backgroundColor: "rgba(255,255,255,0.18)"
  },
  contactHeroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(179,15,127,0.08)",
    shadowColor: "#b30f7f",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  contactHeroLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(179,15,127,0.08)",
    padding: 2,
    overflow: "hidden"
  },
  contactHeroIconWrapCompact: {
    width: 38,
    height: 38,
    borderRadius: 19
  },
  contactHeroLogoWrapCompact: {
    width: 38,
    height: 38,
    borderRadius: 12,
    padding: 2
  },
  contactHeroLogo: {
    width: "90%",
    height: "90%",
    borderRadius: 12,
    backgroundColor: "transparent"
  },
  contactHeroLogoCompact: {
    borderRadius: 10
  },
  contactHeroLogoPlainWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    overflow: "hidden"
  },
  contactHeroLogoPlainWrapCompact: {
    width: 38,
    height: 38,
    borderRadius: 12
  },
  contactHeroLogoPlain: {
    width: 48,
    height: 48,
    borderRadius: 13
  },
  contactHeroLogoPlainCompact: {
    width: 42,
    height: 42,
    borderRadius: 11
  },
  contactHeroTextWrap: {
    flex: 1,
    minWidth: 0
  },
  contactHeroTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800"
  },
  contactHeroTitleCompact: {
    fontSize: 16
  },
  contactHeroSubtitle: {
    color: "#6b7280",
    marginTop: 3,
    fontSize: 12.5,
    fontWeight: "600"
  },
  contactHeroSubtitleCompact: {
    fontSize: 11.5
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
  contactMetaWrap: {
    marginTop: 8,
    gap: 8
  },
  contactMetaGrid: {
    gap: 8
  },
  priorityPhoneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#fdf2f8",
    borderWidth: 1,
    borderColor: "rgba(217,70,239,0.12)",
    shadowColor: "#d946ef",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  priorityPhoneStack: {
    gap: 8
  },
  priorityPhoneStackCompact: {
    gap: 6
  },
  priorityPhoneCardCompact: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10
  },
  priorityPhoneIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff3b81"
  },
  priorityPhoneIconWrapCompact: {
    width: 34,
    height: 34,
    borderRadius: 17
  },
  priorityPhoneTextWrap: {
    flex: 1
  },
  priorityPhoneLabel: {
    color: "#9d174d",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  priorityPhoneLabelCompact: {
    fontSize: 10
  },
  priorityPhoneValue: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2
  },
  priorityPhoneValueCompact: {
    fontSize: 16
  },
  contactMetaWrapCompact: {
    marginTop: 6
  },
  contactMetaTile: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(179,15,127,0.10)",
    shadowColor: "#b30f7f",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1
  },
  contactMetaTileCompact: {
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 16
  },
  contactMetaTilePressable: {
    transform: [{ scale: 1 }]
  },
  contactMetaTileIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(179,15,127,0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1
  },
  contactMetaTileIconCompact: {
    width: 28,
    height: 28,
    borderRadius: 14
  },
  contactMetaTileContent: {
    flex: 1,
    gap: 3
  },
  contactMetaTileLabel: {
    color: "#9d174d",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  contactMetaTileLabelCompact: {
    fontSize: 10
  },
  contactMetaTileValue: {
    color: "#374151",
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1
  },
  contactMetaTileValueCompact: {
    fontSize: 12,
    lineHeight: 17
  },
  contactMetaTileLink: {
    color: "#b30f7f",
    textDecorationLine: "underline"
  },
  contactMetaActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2
  },
  metaActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  mapActionBtn: {
    backgroundColor: "#0f766e",
    shadowColor: "#0f766e",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5
  },
  websiteActionBtn: {
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.18)"
  },
  emailActionBtn: {
    backgroundColor: "rgba(217,70,239,0.10)",
    borderWidth: 1,
    borderColor: "rgba(217,70,239,0.18)"
  },
  metaActionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800"
  },
  emailActionBtnText: {
    color: "#d946ef"
  },
  websiteActionBtnText: {
    color: "#8b5cf6"
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
    minWidth: 70,
    paddingHorizontal: 2,
    paddingTop: 0,
    paddingBottom: 0
  },
  bottomCenterFloating: {
    position: "absolute",
    left: "50%",
    top: -18,
    alignItems: "center",
    justifyContent: "flex-start",
    zIndex: 50,
    elevation: 30
  },
  bottomCenterItem: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
    marginTop: 0
  },
  bottomVisualSlot: {
    width: 72,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
    position: "relative",
    overflow: "visible"
  },
  bottomSideVisualSlot: {
    marginBottom: 0
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
  bottomCenterAiText: {
    color: "#f4c542"
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
    marginTop: 0
  },
  bottomSideText: {
    marginTop: 0
  },
  bottomSubText: {
    color: "#ffd0f0",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 1
  },
  bannerCard: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(179,15,127,0.10)",
    shadowColor: "#7b7b86",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
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
  contactBackdropAndroid: {
    justifyContent: "flex-end",
    paddingHorizontal: 0
  },
  contactCardAndroid: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 10,
    maxHeight: "82%"
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
    alignItems: "stretch",
    justifyContent: "stretch",
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: "hidden",
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
  hintBackdropFill: {
    ...StyleSheet.absoluteFillObject
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
    marginBottom: 6
  },
  hintBody: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6
  },
  hintList: {
    gap: 8,
    marginTop: 2,
    marginBottom: 2
  },
  hintItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(249,250,251,0.94)",
    borderWidth: 1,
    borderColor: "rgba(234,236,242,0.95)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  hintMiniBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    position: "relative"
  },
  hintMiniBusiness: {
    backgroundColor: "#f3e8ff"
  },
  hintMiniAdd: {
    backgroundColor: "#fde7f7"
  },
  hintMiniContact: {
    backgroundColor: "#fde7f7"
  },
  hintMiniContactSparkles: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#d21695",
    alignItems: "center",
    justifyContent: "center"
  },
  hintItemText: {
    flex: 1,
    color: "#374151",
    fontSize: 12,
    lineHeight: 18
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
  },
  arabicUiFont: {
    fontFamily: Platform.select({
      ios: "Geeza Pro",
      android: "sans-serif",
      default: undefined
    })
  }
});
