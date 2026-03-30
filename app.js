const API_BASE_URL = "http://localhost:4000";

const cardsEl = document.getElementById("cards");
const searchEl = document.getElementById("searchInput");
const categoryEl = document.getElementById("categorySelect");
const governorateEl = document.getElementById("governorateSelect");
const statsEl = document.getElementById("stats");

let debounceTimer;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadMetadata() {
  try {
    const [catRes, govRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/categories`),
      fetch(`${API_BASE_URL}/api/governorates`)
    ]);

    const [categories, governorates] = await Promise.all([catRes.json(), govRes.json()]);

    for (const cat of categories) {
      const option = document.createElement("option");
      option.value = cat.slug;
      option.textContent = cat.name_ar;
      categoryEl.appendChild(option);
    }

    for (const gov of governorates) {
      const option = document.createElement("option");
      option.value = gov.code;
      option.textContent = gov.name_ar;
      governorateEl.appendChild(option);
    }
  } catch {
    statsEl.textContent = "تعذر تحميل الفئات والمحافظات. تأكد من تشغيل الخادم.";
  }
}

function renderCards(data) {
  if (!data.length) {
    cardsEl.innerHTML = '<div class="empty">لا توجد نتائج مطابقة.</div>';
    statsEl.textContent = "0 نتيجة";
    return;
  }

  statsEl.textContent = `${data.length} نتيجة`;

  cardsEl.innerHTML = data
    .map(
      (item) => `
      <article class="card">
        <h3>${escapeHtml(item.name_ar)}</h3>
        <div class="meta">${escapeHtml(item.category_name_ar)} | ${escapeHtml(
        item.is_national ? "رقم موحد" : item.governorate_name_ar
      )}</div>
        <div class="number">${escapeHtml(item.phone)}</div>
        ${item.address ? `<div class="meta">${escapeHtml(item.address)}</div>` : ""}
        ${item.notes ? `<div class="meta">${escapeHtml(item.notes)}</div>` : ""}
        <div class="actions">
          <a class="btn btn-call" href="tel:${escapeHtml(item.phone)}">اتصال</a>
          <button class="btn btn-copy" data-number="${escapeHtml(item.phone)}">نسخ الرقم</button>
        </div>
      </article>
    `
    )
    .join("");
}

async function loadContacts() {
  const params = new URLSearchParams();
  const query = searchEl.value.trim();
  if (query) params.set("q", query);
  if (categoryEl.value) params.set("category", categoryEl.value);
  if (governorateEl.value) params.set("governorate", governorateEl.value);
  params.set("limit", "300");

  try {
    const res = await fetch(`${API_BASE_URL}/api/contacts?${params.toString()}`);
    const data = await res.json();
    renderCards(data);
  } catch {
    cardsEl.innerHTML = '<div class="empty">فشل تحميل الأرقام. تأكد أن الخادم يعمل على المنفذ 4000.</div>';
    statsEl.textContent = "خطأ اتصال";
  }
}

function handleFiltersChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    loadContacts();
  }, 200);
}

searchEl.addEventListener("input", handleFiltersChange);
categoryEl.addEventListener("change", handleFiltersChange);
governorateEl.addEventListener("change", handleFiltersChange);

cardsEl.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const number = target.dataset.number;
  if (!number) return;

  try {
    await navigator.clipboard.writeText(number);
    const oldText = target.textContent;
    target.textContent = "تم النسخ";
    setTimeout(() => {
      target.textContent = oldText;
    }, 1200);
  } catch {
    target.textContent = "فشل النسخ";
  }
});

(async function bootstrap() {
  await loadMetadata();
  await loadContacts();
})();
