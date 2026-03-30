(() => {
  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");
  const loginPanel = $("login-panel");
  const contactsPanel = $("contacts-panel");
  const addPanel = $("add-panel");
  const pendingPanel = $("pending-panel");
  const apiInput = $("api-base");
  const userInput = $("username");
  const passInput = $("password");
  const searchInput = $("search");
  const catFilter = $("cat-filter");
  const catSelect = $("cat-select");
  const contactsTbody = document.querySelector("#contacts-table tbody");
  const pendingTbody = document.querySelector("#pending-table tbody");
  const editModal = document.getElementById("edit-modal");
  const editForm = document.getElementById("edit-form");
  const editCat = document.getElementById("edit-cat");
  const editId = document.getElementById("edit-id");
  const editName = document.getElementById("edit-name");
  const editPhone = document.getElementById("edit-phone");
  const editGov = document.getElementById("edit-gov");
  const editAddress = document.getElementById("edit-address");
  const editNotes = document.getElementById("edit-notes");
  const editNonPhone = document.getElementById("edit-nonphone");
  const pendingModal = document.getElementById("pending-modal");
  const pendingForm = document.getElementById("pending-form");
  const pendingId = document.getElementById("pending-id");
  const pendingName = document.getElementById("pending-name");
  const pendingPhone = document.getElementById("pending-phone");
  const pendingCat = document.getElementById("pending-cat");
  const pendingGov = document.getElementById("pending-gov");
  const pendingAddress = document.getElementById("pending-address");
  const pendingNotes = document.getElementById("pending-notes");
  const pendingNonPhone = document.getElementById("pending-nonphone");

  let apiBase = window.location.origin;
  let authHeader = "";
  let categoriesCache = [];

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
        loginPanel.hidden = true;
        contactsPanel.hidden = false;
        addPanel.hidden = false;
        pendingPanel.hidden = false;
        setStatus(`Connected ${apiBase}`, true);
      } catch (err) {
        console.error(err);
        setStatus(err.message || "Auth failed", false);
      }
    };

    $("refresh-btn").onclick = () => loadContacts();
    $("refresh-req").onclick = () => loadPending();
    searchInput.oninput = () => loadContacts();
    catFilter.onchange = () => loadContacts();

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
  }

  function openEdit(row) {
    editId.value = row.id;
    editName.value = row.name_ar || "";
    editPhone.value = row.phone || "";
    editGov.value = row.governorate_code || "";
    editAddress.value = row.address || "";
    editNotes.value = row.notes || "";
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
    pendingCat.value = row.category_slug || "";
    pendingGov.value = "";
    pendingAddress.value = "";
    pendingNotes.value = row.message || "";
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
