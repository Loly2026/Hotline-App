import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
  Dimensions,
  ImageBackground
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
  { key: "food", title: "Food", icon: "🍽️" },
  { key: "finance", title: "Finance", icon: "💳" },
  { key: "mobility", title: "Transport", icon: "🚗" },
  { key: "retail", title: "Services", icon: "🧰" }
];
const GROUP_AR = {
  gov: "طوارئ وخدمات حكومية",
  health: "مستشفيات وخدمات طبية",
  food: "مطاعم وأكل",
  finance: "خدمات مالية",
  mobility: "نقل ومواصلات",
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
  gov: { accent: "#ef4444", card: "rgba(239,68,68,0.12)", cardActive: "rgba(239,68,68,0.18)" }, // أحمر
  health: { accent: "#ec4899", card: "rgba(236,72,153,0.12)", cardActive: "rgba(236,72,153,0.18)" }, // بينك
  food: { accent: "#f59e0b", card: "rgba(245,158,11,0.12)", cardActive: "rgba(245,158,11,0.18)" }, // أصفر
  finance: { accent: "#0ea5e9", card: "rgba(14,165,233,0.12)", cardActive: "rgba(14,165,233,0.18)" }, // لبني
  mobility: { accent: "#22c55e", card: "rgba(34,197,94,0.12)", cardActive: "rgba(34,197,94,0.18)" }, // أخضر
  retail: { accent: "#8b5cf6", card: "rgba(139,92,246,0.12)", cardActive: "rgba(139,92,246,0.18)" } // بنفسجي
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
  supermarkets: "retail",
  hotels: "retail",
  realestate: "retail",
  apps: "retail",
  charity: "retail",
  syndicates: "retail",
  education: "retail"
};
const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25; // ربع الشاشة
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

export default function App() {
  const scrollRef = useRef(null);
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
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [businessModalVisible, setBusinessModalVisible] = useState(false);
  const [newHotlineName, setNewHotlineName] = useState("");
  const [newHotlinePhone, setNewHotlinePhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const focusAnim = useRef(new Animated.Value(0)).current;
  const detailAnim = useRef(new Animated.Value(0)).current;
  const addSheetAnim = useRef(new Animated.Value(0)).current;
  const addSheetDrag = useRef(new Animated.Value(0)).current;
  const [detailGroup, setDetailGroup] = useState("");
  const [detailCategory, setDetailCategory] = useState("");
  const lastDetail = useRef({ group: "", category: "" });
  const [showIntro, setShowIntro] = useState(true);
  const [introLoaded, setIntroLoaded] = useState(true);
  const [suggestHintReady, setSuggestHintReady] = useState(false);
  const [showSuggestHint, setShowSuggestHint] = useState(false);

  const closeDetailView = () => {
    setDetailGroup("");
    setActiveGroup("all");
    setActiveCategorySlug("");
    setDetailCategory("");
    setQuickResult(null);
    setPendingScrollContactId(null);
    lastDetail.current = { group: "", category: "" };
  };

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
        if (g.dx > SWIPE_THRESHOLD || g.vx > 0.75) {
          Animated.timing(swipeBackX, {
            toValue: SCREEN_WIDTH,
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

  useEffect(() => {
    async function load() {
      let seededFromLocal = false;

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

      setLoading(false);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch(`${API_BASE_URL}/api/contacts?limit=3000`, {
          signal: controller.signal
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setAllContacts(sortContacts(data));
          setError("");
          await FileSystem.writeAsStringAsync(CONTACTS_CACHE_PATH, JSON.stringify(sortContacts(data)));
        } else {
          setError("يتم عرض آخر نسخة محفوظة من البيانات حالياً.");
        }
      } catch {
        setError(`تعذر تحميل البيانات من ${API_BASE_URL} - يتم عرض آخر نسخة محفوظة.`);
      } finally {
        clearTimeout(timeoutId);
      }
    }
    load();
  }, []);

  useEffect(() => {
    // introLoaded stays true (no persistent storage)
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
    if (showIntro) {
      const t = setTimeout(() => setShowIntro(false), 3500);
      return () => clearTimeout(t);
    }
  }, [showIntro]);

  useEffect(() => {
    if (!showIntro && suggestHintReady) {
      setShowSuggestHint(true);
    }
  }, [showIntro, suggestHintReady]);

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
      group.items.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
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
    return allCategoryList.filter((cat) => cat.group === selectedGroupKey);
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
          <View key={badge.key} style={[styles.contactBadge, badge.style]}>
            <Text style={[styles.contactBadgeText, badge.text]}>{badge.label}</Text>
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
            <View style={styles.categoryImageWrap}>
              <View style={styles.categoryBadge}>
                <IconComp name={iconMeta.name || "apps"} size={46} color={iconMeta.color || "#6b7280"} />
              </View>
            </View>
            <Text style={[styles.categoryText, selected && styles.categoryTextActive]}>{item.title}</Text>
            <Text style={styles.categoryTextSub}>{GROUP_AR[item.key]}</Text>
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
    if (detailGroup || activeCategorySlug || quickResult) {
      handleHomePress();
      return;
    }
    setBusinessModalVisible(true);
  };

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

  const handleContactSubmit = async () => {
    const msg = contactMessage.trim();
    if (!msg) {
      Alert.alert("Missing Message", "Please write your suggestion first.");
      return;
    }
    try {
      await sendFeedback({
        type: "suggestion",
        message: msg
      });
      setContactModalVisible(false);
      setContactMessage("");
      Alert.alert("Done", "Your suggestion was sent successfully.");
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to send suggestion.");
    }
  };

  const openBusinessInquiry = (plan = "Premium") => {
    setBusinessModalVisible(false);
    setContactMessage(
      `Hello, I’m interested in the ${plan} business plan for my listing.\n\nمرحباً، أنا مهتم بباقة ${plan} لنشاطي داخل التطبيق وأريد معرفة التفاصيل.`
    );
    setContactModalVisible(true);
  };

  if (!introLoaded) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#b30f7f" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.appGlowTop} pointerEvents="none" />
      <View style={styles.appGlowBottom} pointerEvents="none" />
      <View style={styles.appGlowMid} pointerEvents="none" />

      <View style={styles.hero}>
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
            <Ionicons name="phone-portrait" size={40} color="#fff" />
          </Animated.View>
          <View style={styles.welcomeTextWrap}>
            <Text style={styles.welcomeTitle}>Welcome to</Text>
            <Text style={styles.welcomeSub}>Hotline app</Text>
          </View>
          {detailGroup ? (
            <Pressable style={styles.heroBackBtn} onPress={closeDetailView}>
              <Text style={styles.heroBackText}>Back</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.heroInfoBtn} onPress={() => setAboutModalVisible(true)}>
              <Ionicons name="information-circle" size={22} color="#ffffff" />
            </Pressable>
          )}
        </View>

        <View style={styles.searchShell}>
          <View style={styles.searchBar}>
          {query.trim() && isArabicInput ? (
            <TouchableOpacity style={[styles.clearSearchBtn, styles.clearSearchBtnLeft]} onPress={clearSearch}>
              <Text style={styles.clearSearchText}>×</Text>
            </TouchableOpacity>
          ) : null}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search hotline"
            placeholderTextColor="#8b8b8b"
            style={styles.searchInput}
          />
          {query.trim() && !isArabicInput ? (
            <TouchableOpacity style={[styles.clearSearchBtn, styles.clearSearchBtnRight]} onPress={clearSearch}>
              <Text style={styles.clearSearchText}>×</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.searchIconBadge}>
            <Text style={styles.searchIcon}>🔎</Text>
          </View>
          </View>
          <Text style={styles.searchCaption}>Search by name or hotline number</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <View style={styles.suggestBox}>
            {predictions.map((p) => (
              <TouchableOpacity key={p.id} style={styles.suggestItem} onPress={() => handlePredictionPress(p)}>
                <View style={styles.suggestMeta}>
                  <Text style={styles.suggestText}>{p.name_ar}</Text>
                  {renderContactBadges(p, true)}
                  <Text style={styles.suggestCategoryPreview}>{p.category_name_ar}</Text>
                  <View style={styles.suggestBottomRow}>
                    <TouchableOpacity style={styles.suggestPhoneBadge} onPress={() => callNumber(p)} disabled={!!p.is_non_phone}>
                      <Text style={styles.suggestPhonePreview}>{p.phone || "--"}</Text>
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
          <TouchableOpacity style={styles.typoBox} onPress={() => handlePredictionPress(typoSuggestion)}>
            <Text style={styles.typoText}>Did you mean: {typoSuggestion} ?</Text>
          </TouchableOpacity>
        ) : null}

        {quickResult ? (
          <View style={styles.quickResultCard}>
            <Text style={styles.quickResultTitle}>{quickResult.name_ar}</Text>
            {renderContactBadges(quickResult)}
            <Text style={styles.quickResultSub}>{quickResult.category_name_ar}</Text>
            {quickResult.is_non_phone ? (
              <Text style={styles.nonPhone}>غير هاتفي / عبر التطبيق</Text>
            ) : (
              <TouchableOpacity style={styles.callBtn} onPress={() => callNumber(quickResult)}>
                <Text style={styles.callBtnText}>{quickResult.phone}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {!detailGroup ? (
          <FlatList
            data={GROUPS}
            renderItem={renderCategory}
            keyExtractor={(item) => item.key}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridRow}
          />
        ) : null}

        {detailGroup && focusedGroup ? (
          <Animated.View
            style={[
              styles.detailPage,
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
                    <View key={cat.slug} style={styles.subCard}>
                      <Pressable
                        style={({ pressed }) => [styles.subHeader, pressed && { opacity: 0.85 }]}
                        onPress={() => setDetailCategory(opened ? "" : cat.slug)}
                      >
                        <Text style={styles.subTitle} numberOfLines={1} ellipsizeMode="tail">
                          {cat.name}
                        </Text>
                        <Text style={styles.subToggle}>{opened ? "▲" : "▼"}</Text>
                      </Pressable>
                      {opened ? (
                        getDetailContactsForSlug(cat.slug)
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
                                    <Pressable
                                      style={({ pressed }) => [
                                        styles.callBtn,
                                        { backgroundColor: palette.accent },
                                        pressed && styles.callBtnPressed
                                      ]}
                                      android_ripple={{ color: "rgba(255,255,255,0.25)", borderless: true }}
                                      onPress={() => callNumber(item)}
                                    >
                                      <Text style={styles.callBtnText}>{item.phone}</Text>
                                    </Pressable>
                                  )}
                                </View>
                              </View>
                            );
                          })
                      ) : null}
                    </View>
                  );
                });
              })()}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      <LinearGradient colors={["#6c47f5", "#b30f7f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomItem} onPress={onPrimaryNavPress}>
          <View style={[styles.bottomVisualSlot, styles.bottomSideVisualSlot]}>
            {detailGroup || activeCategorySlug || quickResult ? (
              <Text style={styles.bottomIcon}>🏠</Text>
            ) : (
              <Ionicons name="rocket-outline" size={30} color="#ffffff" />
            )}
          </View>
          <Text style={[styles.bottomText, styles.bottomSideText]}>{detailGroup || activeCategorySlug || quickResult ? "Home" : "Business Plans"}</Text>
          {!detailGroup && !activeCategorySlug && !quickResult ? (
            <Text style={styles.bottomSubText}>Advertise</Text>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bottomItem, styles.bottomCenterItem]} onPress={() => setAddModalVisible(true)}>
          <View style={styles.bottomVisualSlot}>
            <View style={styles.bottomCenterBadgeShadowCircle} />
            <View style={styles.bottomCenterBadge}>
              <Ionicons name="sparkles" size={22} color="#9a0f6f" />
            </View>
          </View>
          <Text style={styles.bottomCenterText}>Add Number</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomItem} onPress={() => setContactModalVisible(true)}>
          <View style={[styles.bottomVisualSlot, styles.bottomSideVisualSlot]}>
            <Ionicons name="chatbubble-ellipses-outline" size={30} color="#ffffff" />
          </View>
          <Text style={[styles.bottomText, styles.bottomSideText]}>Contact us</Text>
        </TouchableOpacity>
      </LinearGradient>

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
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <View style={styles.suggestHero}>
                      <View style={styles.suggestHeroBadge}>
                        <Ionicons name="sparkles" size={22} color="#9a0f6f" />
                      </View>
                      <Text style={styles.modalTitle}>Suggest A Number</Text>
                      <Text style={styles.modalSubTitle}>Send a new hotline and we will review it.</Text>
                    </View>
                    <TextInput
                      style={[styles.modalInput, styles.suggestInput]}
                      placeholder="Place or organization"
                      placeholderTextColor="#7b8799"
                      value={newHotlineName}
                      onChangeText={setNewHotlineName}
                    />
                    <TextInput
                      style={[styles.modalInput, styles.suggestInput]}
                      placeholder="Phone or hotline number"
                      placeholderTextColor="#7b8799"
                      keyboardType="phone-pad"
                      value={newHotlinePhone}
                      onChangeText={setNewHotlinePhone}
                    />
                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setAddModalVisible(false)}>
                        <Text style={styles.modalBtnGhostText}>Cancel</Text>
                      </TouchableOpacity>
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
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.suggestHero}>
                  <View style={[styles.suggestHeroBadge, styles.contactHeroBadge]}>
                    <Ionicons name="chatbubble-ellipses" size={22} color="#9a0f6f" />
                  </View>
                  <Text style={styles.modalTitle}>Contact us</Text>
                  <Text style={styles.modalSubTitle}>Share a suggestion or tell us what to improve.</Text>
                </View>
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  placeholder="Write your suggestion"
                  placeholderTextColor="#7b8799"
                  multiline
                  textAlignVertical="top"
                  value={contactMessage}
                  onChangeText={setContactMessage}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setContactModalVisible(false)}>
                    <Text style={styles.modalBtnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleContactSubmit}>
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
                      <Text style={styles.planTitle}>Verified</Text>
                    </View>
                    <Text style={styles.planPrice}>250 EGP / month</Text>
                    <Text style={styles.planBody}>Trusted badge for your business and stronger customer confidence.</Text>
                    <TouchableOpacity style={styles.planBtn} onPress={() => openBusinessInquiry("Verified")}>
                      <Text style={styles.planBtnText}>Request this plan</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.planCard}>
                    <View style={styles.planCardTop}>
                      <View style={[styles.planIconBadge, styles.planIconFeatured]}>
                        <Ionicons name="star" size={18} color="#d97706" />
                      </View>
                      <Text style={styles.planTitle}>Featured</Text>
                    </View>
                    <Text style={styles.planPrice}>400 EGP / month</Text>
                    <Text style={styles.planBody}>Higher visibility inside categories and better placement in search results.</Text>
                    <TouchableOpacity style={styles.planBtn} onPress={() => openBusinessInquiry("Featured")}>
                      <Text style={styles.planBtnText}>Request this plan</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.planCard, styles.planCardPremium]}>
                    <View style={styles.planCardTop}>
                      <View style={[styles.planIconBadge, styles.planIconPremium]}>
                        <Ionicons name="sparkles" size={18} color="#7c3aed" />
                      </View>
                      <Text style={styles.planTitle}>Premium</Text>
                    </View>
                    <Text style={styles.planPrice}>800 EGP / month</Text>
                    <Text style={styles.planBody}>Featured + Verified + top priority for the strongest exposure in the app.</Text>
                    <TouchableOpacity style={[styles.planBtn, styles.planBtnPremium]} onPress={() => openBusinessInquiry("Premium")}>
                      <Text style={styles.planBtnText}>Request this plan</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.businessCta} onPress={openBusinessInquiry}>
                  <Text style={styles.businessCtaText}>Advertise with us</Text>
                </TouchableOpacity>
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
        <View style={styles.introOverlay}>
          <ImageBackground source={introLocal} style={styles.introImage} resizeMode="cover">
            <View style={styles.introTint} />
            <View style={styles.introGlowTop} />
            <View style={styles.introGlowBottom} />
            <View style={styles.introBrandWrap}>
              <View style={styles.introBrandBadge}>
                <Ionicons name="call" size={18} color="#ffffff" />
              </View>
              <Text style={styles.introBrandTitle}>Hotline App</Text>
              <Text style={styles.introBrandSub}>Fast access to important numbers in Egypt</Text>
            </View>
            <TouchableOpacity style={styles.introBtnFloating} onPress={handleIntroContinue}>
              <Text style={styles.introBtnText}>Enter App</Text>
            </TouchableOpacity>
          </ImageBackground>
        </View>
      ) : null}

      {showSuggestHint ? (
        <Pressable style={styles.hintOverlay} onPress={dismissSuggestHint}>
          <View style={styles.hintCard}>
            <View style={styles.hintBadge}>
              <Ionicons name="sparkles" size={20} color="#b30f7f" />
            </View>
            <Text style={styles.hintTitle}>الخدمات السريعة</Text>
            <Text style={[styles.hintBody, styles.aboutBodyAr]}>
              البار السفلي يساعدك على: الوصول إلى Business Plans لمعرفة الباقات، استخدام Add Number لإضافة رقم جديد، و Contact us لإرسال اقتراح أو ملاحظة.
            </Text>
            <Text style={styles.hintBody}>
              Use the bottom bar for quick actions: Business Plans, Add Number, and Contact us.
            </Text>
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
    backgroundColor: "rgba(255,255,255,0.22)",
    padding: 4,
    shadowColor: "#0f1b66",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
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
    backgroundColor: "rgba(255,255,255,0.58)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ffffff",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
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
    borderBottomColor: "rgba(232,226,240,0.8)"
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
    flex: 1
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
    fontWeight: "800"
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
    columnGap: 14,
    rowGap: 14
  },
  categoryCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 26,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 132,
    marginBottom: 0,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.28)",
    shadowColor: "#ffffff",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    overflow: "hidden"
  },
  categoryCardActive: {
    borderColor: "#5d67e8",
    backgroundColor: "rgba(255,255,255,0.22)"
  },
  categoryCardPressed: {
    transform: [{ scale: 0.95 }, { translateY: 3 }],
    shadowOpacity: 0.35,
    shadowRadius: 12
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
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
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
    width: "100%"
  },
  fallbackIcon: {
    fontSize: 48
  },
  categoryText: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center"
  },
  categoryTextSub: {
    color: "#475569",
    fontSize: 12,
    textAlign: "center",
    marginTop: 2
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
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#56093f",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
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
  callBtn: {
    marginTop: 10,
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
  bottomBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 0,
    height: 104,
    borderRadius: 26,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    overflow: "visible"
  },
  bottomItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 96
  },
  bottomCenterItem: {
    justifyContent: "center"
  },
  bottomVisualSlot: {
    width: 72,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    position: "relative"
  },
  bottomSideVisualSlot: {
    marginBottom: 8
  },
  bottomCenterBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.98)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.88)",
    shadowColor: "#7b7b86",
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    zIndex: 2
  },
  bottomCenterBadgeShadowCircle: {
    position: "absolute",
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#f7e8f3",
    top: -5,
    zIndex: 1
  },
  bottomCenterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 5
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
    borderColor: "rgba(236,205,227,0.85)"
  },
  planCardPremium: {
    backgroundColor: "rgba(248,242,255,0.95)",
    borderColor: "rgba(206,186,255,0.9)"
  },
  planCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8
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
    marginBottom: 10
  },
  planBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.9)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  planBtnPremium: {
    backgroundColor: "rgba(255,255,255,0.9)"
  },
  planBtnText: {
    color: "#7c3aed",
    fontSize: 13,
    fontWeight: "800"
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
  businessCta: {
    backgroundColor: "#b30f7f",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#b30f7f",
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  businessCtaText: {
    color: "#ffffff",
    fontSize: 15,
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
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderColor: "rgba(255,255,255,0.82)"
  },
  suggestHero: {
    alignItems: "center",
    marginBottom: 12
  },
  suggestHeroBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fde7f7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  contactHeroBadge: {
    backgroundColor: "#fce7f3"
  },
  modalTitle: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 4
  },
  modalSubTitle: {
    color: "#334155",
    fontSize: 14,
    marginBottom: 10
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
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  modalBtnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  modalBtnGhostText: {
    color: "#334155",
    fontWeight: "700"
  },
  modalBtnPrimary: {
    backgroundColor: "#4a56d7",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  modalBtnPrimaryText: {
    color: "#fff",
    fontWeight: "800"
  },
  introOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(16, 0, 32, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 0
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
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)"
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
