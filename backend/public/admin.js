(() => {
  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");
  const loginPanel = $("login-panel");
  const contactsPanel = $("contacts-panel");
  const addPanel = $("add-panel");
  const pendingPanel = $("pending-panel");
  const notificationsPanel = $("notifications-panel");
  const updatesPanel = $("updates-panel");
  const overviewPanel = $("overview-panel");
  const quickActionBar = $("quick-action-bar");
  const apiInput = $("api-base");
  const userInput = $("username");
  const passInput = $("password");
  const searchInput = $("search");
  const catFilter = $("cat-filter");
  const catSelect = $("cat-select");
  const pushTargetGroup = $("push-target-group");
  const pushTargetCategory = $("push-target-category");
  const pushPlatform = $("push-platform");
  const pushServiceContact = $("push-service-contact");
  const pushServicePreview = $("push-service-preview");
  const pushStorePreview = $("push-store-preview");
  const pushServiceImage = $("push-service-image");
  const pushServiceName = $("push-service-name");
  const pushServicePhone = $("push-service-phone");
  const pushStats = $("push-stats");
  const pushForm = $("push-form");
  const pushDevicesBody = $("push-devices-body");
  const pushCampaignsBody = $("push-campaigns-body");
  const appUpdateForm = $("app-update-form");
  const appUpdateId = $("app-update-id");
  const appUpdateTitle = $("app-update-title");
  const appUpdateBody = $("app-update-body");
  const appUpdatePlatform = $("app-update-platform");
  const appUpdateLanguage = $("app-update-language");
  const appUpdateTargetScreen = $("app-update-target-screen");
  const appUpdateTargetGroup = $("app-update-target-group");
  const appUpdatesBody = $("app-updates-body");
  const overviewContacts = $("overview-contacts");
  const overviewPending = $("overview-pending");
  const overviewDevices = $("overview-devices");
  const overviewCampaigns = $("overview-campaigns");
  const contactsTbody = document.querySelector("#contacts-table tbody");
  const pendingTbody = document.querySelector("#pending-table tbody");
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  const editModal = document.getElementById("edit-modal");
  const editForm = document.getElementById("edit-form");
  const editCat = document.getElementById("edit-cat");
  const editId = document.getElementById("edit-id");
  const editName = document.getElementById("edit-name");
  const editPhone = document.getElementById("edit-phone");
  const editPhoneLabels = document.getElementById("edit-phone-labels");
  const editLogo = document.getElementById("edit-logo");
  const editLogoFile = document.getElementById("edit-logo-file");
  const editGov = document.getElementById("edit-gov");
  const editAddress = document.getElementById("edit-address");
  const editNotes = document.getElementById("edit-notes");
  const editPriority = document.getElementById("edit-priority");
  const editFeatured = document.getElementById("edit-featured");
  const editVerified = document.getElementById("edit-verified");
  const editNonPhone = document.getElementById("edit-nonphone");
  const pendingModal = document.getElementById("pending-modal");
  const pendingForm = document.getElementById("pending-form");
  const pendingId = document.getElementById("pending-id");
  const pendingName = document.getElementById("pending-name");
  const pendingPhone = document.getElementById("pending-phone");
  const pendingPhoneLabels = document.getElementById("pending-phone-labels");
  const pendingLogo = document.getElementById("pending-logo");
  const pendingLogoFile = document.getElementById("pending-logo-file");
  const pendingCat = document.getElementById("pending-cat");
  const pendingGov = document.getElementById("pending-gov");
  const pendingAddress = document.getElementById("pending-address");
  const pendingNotes = document.getElementById("pending-notes");
  const pendingPriority = document.getElementById("pending-priority");
  const pendingFeatured = document.getElementById("pending-featured");
  const pendingVerified = document.getElementById("pending-verified");
  const pendingNonPhone = document.getElementById("pending-nonphone");

  let apiBase = window.location.origin;
  let authHeader = "";
  let categoriesCache = [];
  let contactsCache = [];
  let lastPushStats = { active: 0 };
  let lastCampaignCount = 0;
  const ADMIN_CONTACTS_LIMIT = 10000;

  function setSparkline(id, value) {
    const el = $(id);
    if (!el) return;
    const base = Math.max(Number(value) || 0, 1);
    Array.from(el.children).forEach((bar, index) => {
      const wave = Math.sin(index * 1.1 + base * 0.17);
      const height = Math.max(18, Math.min(94, 32 + wave * 20 + Math.log10(base + 1) * 18 + index * 4));
      bar.style.setProperty("--spark-h", `${height}%`);
    });
  }

  function renderStatusPill(value, fallbackClass = "") {
    const raw = String(value || "").trim();
    const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-") || fallbackClass || "neutral";
    return `<span class="status-pill ${slug}">${raw || "-"}</span>`;
  }

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function applyServiceTemplate(value, service) {
    const raw = String(value || "");
    if (!service) return raw;
    return raw
      .replace(/\{service\}/gi, String(service.name_ar || "").trim())
      .replace(/\{phone\}/gi, String(service.phone || "").trim())
      .replace(/\{category\}/gi, String(service.category_name_ar || "").trim());
  }

  function getPushTargetSummary(row) {
    const targetScreen = String(row.target_screen || "home").trim() || "home";
    if (targetScreen === "store-update") return "store-update / Google Play";
    return [targetScreen, row.target_group || row.target_category_slug || "-"]
      .filter(Boolean)
      .join(" / ");
  }

  function updateOverviewCards() {
    const contactsCount = contactsTbody?.children?.length || 0;
    const pendingCount = pendingTbody?.children?.length || 0;
    const devicesCount = lastPushStats.active || 0;
    const campaignsCount = lastCampaignCount;
    if (overviewContacts) overviewContacts.textContent = String(contactsCount);
    if (overviewPending) overviewPending.textContent = String(pendingCount);
    if (overviewDevices) overviewDevices.textContent = String(devicesCount);
    if (overviewCampaigns) overviewCampaigns.textContent = String(campaignsCount);
    setSparkline("spark-contacts", contactsCount);
    setSparkline("spark-pending", pendingCount);
    setSparkline("spark-devices", devicesCount);
    setSparkline("spark-campaigns", campaignsCount);
  }

  async function refreshWorkspace() {
    await loadContacts();
    await loadPending();
    await loadPushStats();
    await loadPushDevices();
    await loadPushCampaigns();
    await loadAppUpdates();
  }

  function scrollToPanel(panelId) {
    const target = $(panelId);
    if (!target) return;
    target.hidden = false;
    target.classList.remove("panel-collapsed");
    const toggle = target.querySelector(".panel-toggle");
    if (toggle) {
      toggle.textContent = "Collapse";
      toggle.setAttribute("aria-expanded", "true");
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setupCollapsiblePanels() {
    document.querySelectorAll(".panel-toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const panel = button.closest(".panel");
        if (!panel) return;
        const collapsed = panel.classList.toggle("panel-collapsed");
        button.textContent = collapsed ? "Expand" : "Collapse";
        button.setAttribute("aria-expanded", String(!collapsed));
      });
    });
  }

  function setupQuickActions() {
    document.querySelectorAll("[data-scroll-target]").forEach((button) => {
      button.addEventListener("click", () => scrollToPanel(button.dataset.scrollTarget));
    });
    const refreshAll = $("quick-refresh-all");
    if (refreshAll) {
      refreshAll.addEventListener("click", async () => {
        try {
          await refreshWorkspace();
          setStatus("Workspace refreshed", true);
        } catch (err) {
          setStatus(err.message || "Refresh failed", false);
        }
      });
    }
  }

  function setupSidebarNav() {
    if (!navLinks.length) return;
    const sections = navLinks
      .map((link) => {
        const href = link.getAttribute("href") || "";
        return href.startsWith("#")
          ? { link, section: document.querySelector(href) }
          : null;
      })
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        navLinks.forEach((link) => link.classList.remove("active"));
        const match = sections.find((item) => item.section === visible.target);
        if (match) match.link.classList.add("active");
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: [0.2, 0.45, 0.7] }
    );

    sections.forEach(({ section }) => {
      if (section) observer.observe(section);
    });
  }

  function sanitizeFileName(name = "logo") {
    return String(name)
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "logo";
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });
  }

  function setStatus(text, ok = false) {
    statusEl.textContent = text;
    statusEl.style.opacity = "1";
    statusEl.style.color = ok ? "#bbf7d0" : "#fda4af";
    statusEl.classList.toggle("status-online", ok);
    statusEl.classList.toggle("status-offline", !ok);
  }

  function authFetch(path, opts = {}) {
    const url = path.startsWith("http") ? path : `${apiBase}${path}`;
    return fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        Authorization: authHeader
      }
    }).then(async (res) => {
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || res.statusText);
      }
      return res;
    });
  }

  async function uploadLogoFile(file, fallbackName = "logo") {
    const dataUrl = await readFileAsDataUrl(file);
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1) {
      throw new Error("Invalid image data");
    }

    const base64 = dataUrl.slice(commaIndex + 1);
    const filename = file.name || `${sanitizeFileName(fallbackName)}.png`;
    const res = await authFetch("/api/admin/upload-logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        contentType: file.type || "",
        dataBase64: base64
      })
    });
    return res.json();
  }

  function wireLogoUpload(inputEl, targetEl, getName) {
    if (!inputEl || !targetEl) return;
    inputEl.addEventListener("click", () => {
      inputEl.value = "";
    });
    inputEl.addEventListener("change", async () => {
      const file = inputEl.files?.[0];
      if (!file) return;

      try {
        setStatus("Uploading logo...", true);
        const result = await uploadLogoFile(file, getName?.() || "logo");
        targetEl.value = result.url || "";
        setStatus("Logo uploaded", true);
      } catch (err) {
        console.error(err);
        setStatus(err.message || "Logo upload failed", false);
      } finally {
        inputEl.value = "";
      }
    });
  }

  async function loadCategories() {
    const res = await authFetch("/api/admin/categories");
    const cats = await res.json();
    categoriesCache = cats;
    catFilter.innerHTML = '<option value="">All</option>' + cats.map((c) => `<option value="${c.slug}">${c.name_ar}</option>`).join("");
    const options = cats.map((c) => `<option value="${c.slug}">${c.name_ar}</option>`).join("");
    catSelect.innerHTML = options;
    editCat.innerHTML = options;
    pendingCat.innerHTML = '<option value="">Select category</option>' + options;
    if (pushTargetCategory) {
      pushTargetCategory.innerHTML = '<option value="">Choose category</option>' + options;
    }
  }

  async function loadContacts() {
    const params = new URLSearchParams();
    params.set("limit", String(ADMIN_CONTACTS_LIMIT));
    if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
    if (catFilter.value) params.set("category", catFilter.value);
    const res = await authFetch(`/api/admin/contacts?${params.toString()}`);
    const data = await res.json();
    contactsTbody.innerHTML = data
      .map(
        (row) => `
        <tr>
          <td>${row.id}</td>
          <td>${row.name_ar}</td>
          <td>${row.phone || "-"}</td>
          <td>${row.phone_labels || "-"}</td>
          <td>${row.category_name_ar}</td>
          <td>${row.governorate_code || "-"}</td>
          <td>${row.is_featured ? "⭐" : "-"}</td>
          <td>${row.is_verified ? "✔️" : "-"}</td>
          <td>${row.priority_rank || 0}</td>
          <td>${row.is_non_phone ? "✅" : ""}</td>
          <td>
            <button class="small" data-edit='${JSON.stringify(row)}'>Edit</button>
            <button class="small danger" data-del="${row.id}">Delete</button>
          </td>
        </tr>`
      )
      .join("");
    contactsCache = data;
    populatePushServiceOptions();
    updateOverviewCards();
  }

  function populatePushServiceOptions() {
    if (!pushServiceContact) return;
    const currentValue = pushServiceContact.value;
    const options = contactsCache
      .slice()
      .sort((a, b) => String(a.name_ar || "").localeCompare(String(b.name_ar || ""), "ar"))
      .map((row) => `<option value="${row.id}">${row.name_ar}${row.phone ? ` - ${row.phone}` : ""}</option>`)
      .join("");
    pushServiceContact.innerHTML = `<option value="">Choose service</option>${options}`;
    pushServiceContact.value = currentValue || "";
    updatePushServicePreview();
  }

  function updatePushServicePreview() {
    if (!pushServiceContact || !pushServicePreview) return null;
    const selectedId = Number.parseInt(String(pushServiceContact.value || "0"), 10) || 0;
    const service = contactsCache.find((row) => Number(row.id) === selectedId) || null;
    pushServicePreview.hidden = !service;
    if (!service) {
      if (pushServiceImage) pushServiceImage.removeAttribute("src");
      if (pushServiceName) pushServiceName.textContent = "-";
      if (pushServicePhone) pushServicePhone.textContent = "-";
      return null;
    }
    if (pushServiceName) pushServiceName.textContent = service.name_ar || "-";
    if (pushServicePhone) pushServicePhone.textContent = service.phone || "No phone";
    if (pushServiceImage) {
      if (service.logo_url) {
        pushServiceImage.src = service.logo_url;
        pushServiceImage.style.display = "block";
      } else {
        pushServiceImage.removeAttribute("src");
        pushServiceImage.style.display = "none";
      }
    }
    return service;
  }

  async function loadPending() {
    const res = await authFetch("/api/admin/requests?handled=0");
    const data = await res.json();
    pendingTbody.innerHTML = data
      .map(
        (row) => `
        <tr>
          <td>${row.id}</td>
          <td>${row.name_ar || "-"}</td>
          <td>${row.phone || "-"}</td>
          <td>${row.category_slug || "-"}</td>
          <td>${row.message || ""}</td>
          <td>${row.created_at}</td>
          <td>
            <button class="small" data-pending-edit='${JSON.stringify(row)}'>Open</button>
            <button class="small" data-resolve="${row.id}">Done</button>
          </td>
        </tr>`
      )
      .join("");
    updateOverviewCards();
  }

  async function loadPushStats() {
    if (!pushStats) return;
    const res = await authFetch("/api/admin/push/stats");
    const stats = await res.json();
    lastPushStats = stats || { active: 0 };
    pushStats.innerHTML = `
      <span>Active devices: ${stats.active || 0}</span>
      <span>Android: ${stats.android || 0}</span>
      <span>iOS: ${stats.ios || 0}</span>
      <span>Total saved: ${stats.total || 0}</span>
    `;
    updateOverviewCards();
  }

  async function loadPushDevices() {
    if (!pushDevicesBody) return;
    const res = await authFetch("/api/admin/push/recent?limit=20");
    const rows = await res.json();
    if (!rows.length) {
      pushDevicesBody.innerHTML = `<tr><td colspan="7">No registered devices yet.</td></tr>`;
      return;
    }
    pushDevicesBody.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${row.platform || "-"}</td>
            <td>${row.device_id || "-"}</td>
            <td>${row.ui_language || "-"}</td>
            <td>${row.screen_size || "-"}</td>
            <td>${renderStatusPill(row.enabled ? "Active" : "Disabled")}</td>
            <td>${row.updated_at || "-"}</td>
            <td><code>${row.token_preview || "-"}</code></td>
          </tr>`
      )
      .join("");
  }

  async function loadPushCampaigns() {
    if (!pushCampaignsBody) return;
    const res = await authFetch("/api/admin/push/campaigns?limit=20");
    const rows = await res.json();
    lastCampaignCount = rows.length;
    if (!rows.length) {
      pushCampaignsBody.innerHTML = `<tr><td colspan="10">No notification history yet.</td></tr>`;
      updateOverviewCards();
      return;
    }
    pushCampaignsBody.innerHTML = rows
      .map((row) => {
        const audience = `${row.audience_platform || "all"} / ${row.audience_language || "all"}`;
        const target = getPushTargetSummary(row);
        const serviceMarkup = row.service_name
          ? `<div>${row.service_name}</div><div class="service-preview-note">${row.service_phone || "-"}</div>`
          : "-";
        return `
          <tr>
            <td>${row.title || "-"}</td>
            <td>${serviceMarkup}</td>
            <td>${row.message_type || "-"}</td>
            <td>${audience}</td>
            <td>${target}</td>
            <td>${renderStatusPill(row.status || "-", "pending")}</td>
            <td>${row.sent_count ?? 0}</td>
            <td>${row.failed_count ?? 0}</td>
            <td>${row.scheduled_at || "-"}</td>
            <td><button class="small ghost" data-campaign-hide="${row.id}">Hide</button></td>
          </tr>`;
      })
      .join("");
    updateOverviewCards();
  }

  async function loadAppUpdates() {
    if (!appUpdatesBody) return;
    const res = await authFetch("/api/admin/updates?limit=50");
    const rows = await res.json();
    if (!rows.length) {
      appUpdatesBody.innerHTML = `<tr><td colspan="6">No internal updates yet.</td></tr>`;
      return;
    }
    appUpdatesBody.innerHTML = rows
      .map((row) => {
        const audience = `${row.audience_platform || "all"} / ${row.audience_language || "all"}`;
        const target = [row.target_screen || "updates", row.target_group || row.target_category_slug || ""]
          .filter(Boolean)
          .join(" / ");
        const encoded = encodeURIComponent(JSON.stringify(row));
        return `
          <tr>
            <td>${escapeHtml(row.title || "-")}</td>
            <td>${escapeHtml(row.body || "-")}</td>
            <td>${escapeHtml(audience)}</td>
            <td>${escapeHtml(target || "-")}</td>
            <td>${escapeHtml(row.updated_at || row.created_at || "-")}</td>
            <td>
              <button class="small" data-update-edit="${encoded}">Edit</button>
              <button class="small danger" data-update-delete="${row.id}">Delete</button>
            </td>
          </tr>`;
      })
      .join("");
  }

  function resetAppUpdateForm() {
    if (!appUpdateForm) return;
    appUpdateForm.reset();
    if (appUpdateId) appUpdateId.value = "";
    if (appUpdateTargetScreen) appUpdateTargetScreen.value = "updates";
    if (appUpdatePlatform) appUpdatePlatform.value = "all";
    if (appUpdateLanguage) appUpdateLanguage.value = "all";
    if (appUpdateTargetGroup) appUpdateTargetGroup.value = "";
  }

  function openAppUpdateEdit(row) {
    if (!appUpdateForm) return;
    appUpdateId.value = row.id || "";
    appUpdateTitle.value = row.title || "";
    appUpdateBody.value = row.body || "";
    appUpdatePlatform.value = row.audience_platform || "all";
    appUpdateLanguage.value = row.audience_language || "all";
    appUpdateTargetScreen.value = row.target_screen || "updates";
    appUpdateTargetGroup.value = row.target_group || "";
    scrollToPanel("updates-panel");
  }

  async function saveAppUpdate(form) {
    const fd = new FormData(form);
    const id = String(fd.get("id") || "").trim();
    const targetScreen = String(fd.get("target_screen") || "updates").trim();
    const payload = {
      title: String(fd.get("title") || "").trim(),
      body: String(fd.get("body") || "").trim(),
      audience_platform: String(fd.get("audience_platform") || "all").trim(),
      audience_language: String(fd.get("audience_language") || "all").trim(),
      target_screen: targetScreen,
      target_group: targetScreen === "group" ? String(fd.get("target_group") || "").trim() : "",
      target_category_slug: "",
      target_store_url: targetScreen === "store-update" ? "https://play.google.com/store/apps/details?id=com.hotline.egypt" : ""
    };
    const res = await authFetch(id ? `/api/admin/updates/${id}` : "/api/admin/updates", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await res.json();
    resetAppUpdateForm();
    await loadAppUpdates();
  }

  async function deleteAppUpdate(id) {
    await authFetch(`/api/admin/updates/${id}`, { method: "DELETE" });
    await loadAppUpdates();
  }

  async function sendPushNotification(form) {
    const fd = new FormData(form);
    const selectedServiceId = Number.parseInt(String(fd.get("service_contact_id") || "0"), 10) || 0;
    const service = contactsCache.find((row) => Number(row.id) === selectedServiceId) || null;
    const payload = {
      title: applyServiceTemplate(String(fd.get("title") || "").trim(), service),
      body: applyServiceTemplate(String(fd.get("body") || "").trim(), service),
      message_type: String(fd.get("message_type") || "update").trim(),
      audience_platform: String(fd.get("audience_platform") || "all").trim(),
      audience_language: String(fd.get("audience_language") || "all").trim(),
      target_screen: service ? "service" : String(fd.get("target_screen") || "home").trim(),
      target_group: String(fd.get("target_group") || "").trim(),
      target_category_slug: String(fd.get("target_category_slug") || "").trim(),
      target_store_url:
        !service && String(fd.get("target_screen") || "home").trim() === "store-update"
          ? "https://play.google.com/store/apps/details?id=com.hotline.egypt"
          : "",
      service_contact_id: service?.id || null,
      scheduled_at: String(fd.get("scheduled_at") || "").trim()
    };
    const res = await authFetch("/api/admin/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    form.reset();
    if (pushServiceContact) pushServiceContact.value = "";
    updatePushServicePreview();
    syncPushTargetInputs();
    await loadPushStats();
    await loadPushDevices();
    await loadPushCampaigns();
    return result;
  }

  async function deleteContact(id) {
    await authFetch(`/api/admin/contacts/${id}`, { method: "DELETE" });
    await loadContacts();
  }

  async function resolvePending(id) {
    await authFetch(`/api/admin/requests/${id}/resolve`, { method: "POST" });
    await loadPending();
  }

  async function deletePending(id) {
    await authFetch(`/api/admin/requests/${id}`, { method: "DELETE" });
    await loadPending();
  }

  async function hidePushCampaign(id) {
    await authFetch(`/api/admin/push/campaigns/${id}`, { method: "DELETE" });
    await loadPushCampaigns();
  }

  async function approvePending(payload) {
    const { id, ...rest } = payload;
    const res = await authFetch(`/api/admin/requests/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rest)
    });
    await res.json();
    await loadContacts();
    await loadPending();
  }

  async function addContact(form) {
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    payload.is_non_phone = fd.get("is_non_phone") === "on";
    payload.is_featured = fd.get("is_featured") === "on";
    payload.is_verified = fd.get("is_verified") === "on";
    payload.priority_rank = Number.parseInt(fd.get("priority_rank"), 10) || 0;
    const res = await authFetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await res.json();
    form.reset();
    await loadContacts();
    await loadPending();
  }

  function wireEvents() {
    $("connect-btn").onclick = async () => {
      apiBase = apiInput.value.trim() || window.location.origin;
      authHeader = "Basic " + btoa(`${userInput.value}:${passInput.value}`);
      try {
        await loadCategories();
        await loadContacts();
        await loadPending();
        await loadPushStats();
        await loadPushDevices();
        await loadPushCampaigns();
        await loadAppUpdates();
        loginPanel.hidden = true;
        if (quickActionBar) quickActionBar.hidden = false;
        if (overviewPanel) overviewPanel.hidden = false;
        contactsPanel.hidden = false;
        addPanel.hidden = false;
        pendingPanel.hidden = false;
        notificationsPanel.hidden = false;
        if (updatesPanel) updatesPanel.hidden = false;
        setStatus(`Connected ${apiBase}`, true);
      } catch (err) {
        console.error(err);
        setStatus(err.message || "Auth failed", false);
      }
    };

    $("refresh-btn").onclick = () => loadContacts();
    $("refresh-req").onclick = () => loadPending();
    $("refresh-push-stats").onclick = async () => {
      await loadPushStats();
      await loadPushDevices();
      await loadPushCampaigns();
    };
    const refreshAppUpdates = $("refresh-app-updates");
    if (refreshAppUpdates) refreshAppUpdates.onclick = () => loadAppUpdates();
    const appUpdateReset = $("app-update-reset");
    if (appUpdateReset) appUpdateReset.onclick = resetAppUpdateForm;
    searchInput.oninput = () => loadContacts();
    catFilter.onchange = () => loadContacts();
    document.getElementById("push-target-screen").onchange = syncPushTargetInputs;
    if (pushServiceContact) pushServiceContact.onchange = syncPushTargetInputs;

    pushForm.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const result = await sendPushNotification(e.target);
        if (result.scheduled) {
          setStatus(`Notification scheduled for ${result.scheduledAt}`, true);
        } else {
          setStatus(`Notification sent to ${result.sent || 0} users`, true);
        }
      } catch (err) {
        setStatus(err.message || "Notification failed", false);
      }
    };

    if (appUpdateForm) {
      appUpdateForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await saveAppUpdate(e.target);
          setStatus("Internal update saved", true);
        } catch (err) {
          setStatus(err.message || "Internal update failed", false);
        }
      };
    }

    $("add-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await addContact(e.target);
        setStatus("Added", true);
      } catch (err) {
        setStatus(err.message || "Add failed", false);
      }
    };

    contactsTbody.addEventListener("click", async (e) => {
      const id = e.target.dataset.del;
      const editPayload = e.target.dataset.edit;
      if (id) {
        if (confirm(`Delete contact ${id}?`)) {
          try {
            await deleteContact(id);
            setStatus("Deleted", true);
          } catch (err) {
            setStatus(err.message, false);
          }
        }
      } else if (editPayload) {
        const row = JSON.parse(editPayload);
        openEdit(row);
      }
    });

    pendingTbody.addEventListener("click", async (e) => {
      const id = e.target.dataset.resolve;
      const pendingPayload = e.target.dataset.pendingEdit;
      if (id) {
        try {
          await resolvePending(id);
          setStatus("Marked done", true);
        } catch (err) {
          setStatus(err.message, false);
        }
      } else if (pendingPayload) {
        openPending(JSON.parse(pendingPayload));
      }
    });

    if (pushCampaignsBody) {
      pushCampaignsBody.addEventListener("click", async (e) => {
        const id = e.target.dataset.campaignHide;
        if (!id) return;
        try {
          await hidePushCampaign(id);
          setStatus("Notification hidden from history", true);
        } catch (err) {
          setStatus(err.message || "Hide failed", false);
        }
      });
    }

    if (appUpdatesBody) {
      appUpdatesBody.addEventListener("click", async (e) => {
        const editPayload = e.target.dataset.updateEdit;
        const deleteId = e.target.dataset.updateDelete;
        if (editPayload) {
          openAppUpdateEdit(JSON.parse(decodeURIComponent(editPayload)));
          return;
        }
        if (!deleteId) return;
        if (!confirm(`Delete internal update ${deleteId}?`)) return;
        try {
          await deleteAppUpdate(deleteId);
          setStatus("Internal update deleted", true);
        } catch (err) {
          setStatus(err.message || "Delete failed", false);
        }
      });
    }
  }

  function initDefaults() {
    apiInput.value = window.location.origin.replace(/\/$/, "");
    userInput.value = "admin";
    if (editModal) editModal.hidden = true;
    if (pendingModal) pendingModal.hidden = true;
    wireLogoUpload(document.getElementById("add-logo-file"), document.querySelector('#add-form input[name="logo_url"]'), () => document.querySelector('#add-form input[name="name_ar"]')?.value || "logo");
    wireLogoUpload(editLogoFile, editLogo, () => editName.value || "logo");
    wireLogoUpload(pendingLogoFile, pendingLogo, () => pendingName.value || "logo");
    setupSidebarNav();
    setupCollapsiblePanels();
    setupQuickActions();
    updateOverviewCards();
    if (pushTargetGroup) pushTargetGroup.disabled = true;
    if (pushTargetCategory) pushTargetCategory.disabled = true;
    if (pushStorePreview) pushStorePreview.hidden = true;
    updatePushServicePreview();
    resetAppUpdateForm();
  }

  function syncPushTargetInputs() {
    if (!pushTargetGroup || !pushTargetCategory) return;
    const targetScreenValue = document.getElementById("push-target-screen")?.value || "home";
    const hasService = !!updatePushServicePreview();
    if (hasService) {
      const targetScreen = document.getElementById("push-target-screen");
      if (targetScreen) targetScreen.value = "service";
      pushTargetGroup.disabled = true;
      pushTargetCategory.disabled = true;
      pushTargetGroup.value = "";
      pushTargetCategory.value = "";
      if (pushStorePreview) pushStorePreview.hidden = true;
      return;
    }
    const isStoreUpdateTarget = targetScreenValue === "store-update";
    const isGroupTarget = targetScreenValue === "group";
    pushTargetGroup.disabled = !isGroupTarget;
    pushTargetCategory.disabled = !isGroupTarget;
    if (!isGroupTarget) {
      pushTargetGroup.value = "";
      pushTargetCategory.value = "";
    }
    if (pushStorePreview) pushStorePreview.hidden = !isStoreUpdateTarget;
    if (pushPlatform && isStoreUpdateTarget && pushPlatform.value === "all") {
      pushPlatform.value = "android";
    }
  }

  function openEdit(row) {
    editId.value = row.id;
    editName.value = row.name_ar || "";
    editPhone.value = row.phone || "";
    editPhoneLabels.value = row.phone_labels || "";
    editLogo.value = row.logo_url || "";
    editGov.value = row.governorate_code || "";
    editAddress.value = row.address || "";
    editNotes.value = row.notes || "";
    editPriority.value = row.priority_rank || 0;
    editFeatured.checked = !!row.is_featured;
    editVerified.checked = !!row.is_verified;
    editNonPhone.checked = !!row.is_non_phone;
    if (row.category_slug && categoriesCache.length) {
      editCat.value = row.category_slug;
    }
    editModal.hidden = false;
  }

  function closeEdit() {
    editModal.hidden = true;
  }

  function openPending(row) {
    pendingId.value = row.id;
    pendingName.value = row.name_ar || "";
    pendingPhone.value = row.phone || "";
    pendingPhoneLabels.value = row.phone_labels || "";
    pendingLogo.value = row.logo_url || "";
    pendingCat.value = row.category_slug || "";
    pendingGov.value = "";
    pendingAddress.value = "";
    pendingNotes.value = row.message || "";
    pendingPriority.value = row.priority_rank || 0;
    pendingFeatured.checked = !!row.is_featured;
    pendingVerified.checked = !!row.is_verified;
    pendingNonPhone.checked = false;
    pendingModal.hidden = false;
  }

  function closePending() {
    pendingModal.hidden = true;
  }

  document.getElementById("close-edit").onclick = closeEdit;
  document.getElementById("cancel-edit").onclick = (e) => {
    e.preventDefault();
    closeEdit();
  };
  document.getElementById("close-pending").onclick = closePending;
  document.getElementById("delete-pending").onclick = async (e) => {
    e.preventDefault();
    if (!pendingId.value) return;
    try {
      await deletePending(pendingId.value);
      closePending();
      setStatus("Pending request deleted", true);
    } catch (err) {
      setStatus(err.message || "Delete failed", false);
    }
  };
  document.getElementById("resolve-pending").onclick = async (e) => {
    e.preventDefault();
    if (!pendingId.value) return;
    try {
      await resolvePending(pendingId.value);
      closePending();
      setStatus("Pending request marked done", true);
    } catch (err) {
      setStatus(err.message || "Resolve failed", false);
    }
  };

  editForm.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(editForm);
    const id = fd.get("id");
    const payload = Object.fromEntries(fd.entries());
    payload.is_non_phone = fd.get("is_non_phone") === "on";
    payload.is_featured = fd.get("is_featured") === "on";
    payload.is_verified = fd.get("is_verified") === "on";
    payload.priority_rank = Number.parseInt(fd.get("priority_rank"), 10) || 0;
    delete payload.id;
    try {
      await authFetch(`/api/admin/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      closeEdit();
      await loadContacts();
      await loadPending();
      setStatus("Updated", true);
    } catch (err) {
      setStatus(err.message || "Update failed", false);
    }
  };

  pendingForm.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(pendingForm);
    const payload = Object.fromEntries(fd.entries());
    payload.is_non_phone = fd.get("is_non_phone") === "on";
    payload.is_featured = fd.get("is_featured") === "on";
    payload.is_verified = fd.get("is_verified") === "on";
    payload.priority_rank = Number.parseInt(fd.get("priority_rank"), 10) || 0;
    try {
      await authFetch(`/api/admin/requests/${payload.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name_ar: payload.name_ar,
          phone: payload.phone,
          phone_labels: payload.phone_labels,
          category_slug: payload.category_slug,
          message: payload.notes
        })
      });
      await approvePending(payload);
      closePending();
      pendingForm.reset();
      setStatus("Pending request added to contacts", true);
    } catch (err) {
      setStatus(err.message || "Approve failed", false);
    }
  };

  initDefaults();
  wireEvents();
})();
