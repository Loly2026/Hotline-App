(() => {
  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");
  const loginPanel = $("login-panel");
  const contactsPanel = $("contacts-panel");
  const addPanel = $("add-panel");
  const pendingPanel = $("pending-panel");
  const notificationsPanel = $("notifications-panel");
  const apiInput = $("api-base");
  const userInput = $("username");
  const passInput = $("password");
  const searchInput = $("search");
  const catFilter = $("cat-filter");
  const catSelect = $("cat-select");
  const pushStats = $("push-stats");
  const pushForm = $("push-form");
  const pushDevicesBody = $("push-devices-body");
  const pushCampaignsBody = $("push-campaigns-body");
  const contactsTbody = document.querySelector("#contacts-table tbody");
  const pendingTbody = document.querySelector("#pending-table tbody");
  const editModal = document.getElementById("edit-modal");
  const editForm = document.getElementById("edit-form");
  const editCat = document.getElementById("edit-cat");
  const editId = document.getElementById("edit-id");
  const editName = document.getElementById("edit-name");
  const editPhone = document.getElementById("edit-phone");
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
  }

  async function loadContacts() {
    const params = new URLSearchParams();
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
  }

  async function loadPushStats() {
    if (!pushStats) return;
    const res = await authFetch("/api/admin/push/stats");
    const stats = await res.json();
    pushStats.innerHTML = `
      <span>Active devices: ${stats.active || 0}</span>
      <span>Android: ${stats.android || 0}</span>
      <span>iOS: ${stats.ios || 0}</span>
      <span>Total saved: ${stats.total || 0}</span>
    `;
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
            <td>${row.enabled ? "Active" : "Disabled"}</td>
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
    if (!rows.length) {
      pushCampaignsBody.innerHTML = `<tr><td colspan="8">No notification history yet.</td></tr>`;
      return;
    }
    pushCampaignsBody.innerHTML = rows
      .map((row) => {
        const audience = `${row.audience_platform || "all"} / ${row.audience_language || "all"}`;
        const target = [row.target_screen || "home", row.target_group || row.target_category_slug || "-"]
          .filter(Boolean)
          .join(" / ");
        return `
          <tr>
            <td>${row.title || "-"}</td>
            <td>${row.message_type || "-"}</td>
            <td>${audience}</td>
            <td>${target}</td>
            <td>${row.status || "-"}</td>
            <td>${row.sent_count ?? 0}</td>
            <td>${row.failed_count ?? 0}</td>
            <td>${row.scheduled_at || "-"}</td>
          </tr>`;
      })
      .join("");
  }

  async function sendPushNotification(form) {
    const fd = new FormData(form);
    const payload = {
      title: String(fd.get("title") || "").trim(),
      body: String(fd.get("body") || "").trim(),
      message_type: String(fd.get("message_type") || "update").trim(),
      audience_platform: String(fd.get("audience_platform") || "all").trim(),
      audience_language: String(fd.get("audience_language") || "all").trim(),
      target_screen: String(fd.get("target_screen") || "home").trim(),
      target_group: String(fd.get("target_group") || "").trim(),
      target_category_slug: String(fd.get("target_category_slug") || "").trim(),
      scheduled_at: String(fd.get("scheduled_at") || "").trim()
    };
    const res = await authFetch("/api/admin/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    form.reset();
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
        loginPanel.hidden = true;
        contactsPanel.hidden = false;
        addPanel.hidden = false;
        pendingPanel.hidden = false;
        notificationsPanel.hidden = false;
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
    searchInput.oninput = () => loadContacts();
    catFilter.onchange = () => loadContacts();

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
  }

  function initDefaults() {
    apiInput.value = window.location.origin.replace(/\/$/, "");
    userInput.value = "admin";
    if (editModal) editModal.hidden = true;
    if (pendingModal) pendingModal.hidden = true;
    wireLogoUpload(document.getElementById("add-logo-file"), document.querySelector('#add-form input[name="logo_url"]'), () => document.querySelector('#add-form input[name="name_ar"]')?.value || "logo");
    wireLogoUpload(editLogoFile, editLogo, () => editName.value || "logo");
    wireLogoUpload(pendingLogoFile, pendingLogo, () => pendingName.value || "logo");
  }

  function openEdit(row) {
    editId.value = row.id;
    editName.value = row.name_ar || "";
    editPhone.value = row.phone || "";
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
