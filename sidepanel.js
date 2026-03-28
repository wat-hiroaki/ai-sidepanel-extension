const DEFAULT_SERVICES = [
  { id: "claude", label: "C", name: "Claude", url: "https://claude.ai", color: "#d97757" },
  { id: "gemini", label: "G", name: "Gemini", url: "https://gemini.google.com/app", color: "#4285f4" },
  { id: "chatgpt", label: "O", name: "ChatGPT", url: "https://chatgpt.com", color: "#10a37f" },
  { id: "grok", label: "X", name: "Grok", url: "https://grok.com", color: "#1d9bf0", noIframe: true },
];

let services = [];
let activeId = null;
const iframes = {};

const topbar = document.getElementById("topbar");
const frames = document.getElementById("frames");

// --- Load/Save ---
function loadState(callback) {
  chrome.storage.local.get(["customServices", "activeId", "serviceOrder"], (data) => {
    const custom = data.customServices || [];
    const all = [...DEFAULT_SERVICES, ...custom];
    // Restore saved order
    if (data.serviceOrder && data.serviceOrder.length > 0) {
      const ordered = [];
      data.serviceOrder.forEach((id) => {
        const s = all.find((x) => x.id === id);
        if (s) ordered.push(s);
      });
      // Append any new services not in saved order
      all.forEach((s) => {
        if (!ordered.find((x) => x.id === s.id)) ordered.push(s);
      });
      services = ordered;
    } else {
      services = all;
    }
    activeId = data.activeId || services[0].id;
    callback();
  });
}

function saveCustomServices() {
  const custom = services.filter((s) => !DEFAULT_SERVICES.find((d) => d.id === s.id));
  chrome.storage.local.set({ customServices: custom });
  saveServiceOrder();
}

function saveServiceOrder() {
  chrome.storage.local.set({ serviceOrder: services.map((s) => s.id) });
}

function saveActiveId() {
  chrome.storage.local.set({ activeId });
}

// --- URL validation ---
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// --- Render tabs ---
function renderTabs() {
  topbar.innerHTML = "";

  services.forEach((service) => {
    const tab = document.createElement("button");
    tab.className = "tab" + (service.id === activeId ? " active" : "");
    tab.title = service.name;
    tab.dataset.serviceId = service.id;
    tab.textContent = service.label;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", service.id === activeId ? "true" : "false");
    tab.setAttribute("aria-label", service.name);
    tab.draggable = true;

    if (service.color) {
      tab.style.borderColor = service.id === activeId ? service.color : "#444";
      if (service.id === activeId) {
        tab.style.background = service.color;
      }
    }

    tab.addEventListener("click", () => switchTo(service.id));

    // Drag & drop reordering
    tab.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", service.id);
      tab.classList.add("dragging");
    });
    tab.addEventListener("dragend", () => {
      tab.classList.remove("dragging");
      document.querySelectorAll("#topbar .tab.drag-over").forEach((el) => el.classList.remove("drag-over"));
    });
    tab.addEventListener("dragover", (e) => {
      e.preventDefault();
      tab.classList.add("drag-over");
    });
    tab.addEventListener("dragleave", () => {
      tab.classList.remove("drag-over");
    });
    tab.addEventListener("drop", (e) => {
      e.preventDefault();
      tab.classList.remove("drag-over");
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId === service.id) return;
      const fromIdx = services.findIndex((s) => s.id === draggedId);
      const toIdx = services.findIndex((s) => s.id === service.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = services.splice(fromIdx, 1);
      services.splice(toIdx, 0, moved);
      saveServiceOrder();
      renderTabs();
    });

    // Right-click to remove custom services
    if (!DEFAULT_SERVICES.find((d) => d.id === service.id)) {
      tab.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (confirm(`Remove "${service.name}"?`)) {
          removeService(service.id);
        }
      });
    }

    topbar.appendChild(tab);
  });

  // Add button
  const addBtn = document.createElement("button");
  addBtn.className = "add-btn";
  addBtn.textContent = "+";
  addBtn.title = "Add custom URL";
  addBtn.setAttribute("aria-label", "Add custom service");
  addBtn.addEventListener("click", openModal);
  topbar.appendChild(addBtn);
}

// --- Update tab styles without rebuilding DOM ---
function updateTabStyles() {
  const tabs = document.querySelectorAll("#topbar .tab");
  tabs.forEach((tab) => {
    const service = services.find((s) => s.id === tab.dataset.serviceId);
    if (!service) return;
    const isActive = service.id === activeId;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    if (service.color) {
      tab.style.borderColor = isActive ? service.color : "#444";
      tab.style.background = isActive ? service.color : "";
    }
  });
}

// --- Switch service ---
function switchTo(id) {
  activeId = id;
  saveActiveId();

  // Create iframe if not exists
  if (!iframes[id]) {
    const service = services.find((s) => s.id === id);
    if (!service) return;

    // Services that block iframe embedding get a direct "open in tab" view
    if (service.noIframe) {
      const fallback = document.createElement("div");
      fallback.className = "loader";
      fallback.dataset.serviceId = id;

      const msg = document.createElement("div");
      msg.textContent = service.name + " does not support panel embedding.";
      msg.style.cssText = "margin-bottom:12px;font-size:14px;color:#ccc;";

      const btn = document.createElement("button");
      btn.textContent = "Open " + service.name + " in new tab";
      btn.style.cssText = "padding:8px 16px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;";
      btn.addEventListener("click", () => {
        chrome.tabs.create({ url: service.url });
      });

      fallback.append(msg, btn);
      frames.appendChild(fallback);
      // Use fallback div as placeholder in iframes map so show/hide works
      iframes[id] = fallback;
    } else {
      // Loading indicator
      const loader = document.createElement("div");
      loader.className = "loader";
      loader.dataset.serviceId = id;
      loader.textContent = "Loading " + service.name + "...";
      frames.appendChild(loader);

      const iframe = document.createElement("iframe");
      iframe.src = service.url;
      iframe.setAttribute("allow", "clipboard-read; clipboard-write");
      iframe.dataset.serviceId = id;

      let loadResolved = false;

      const clearLoader = () => {
        if (loadResolved) return;
        loadResolved = true;
        loader.remove();
      };

      iframe.addEventListener("load", () => setTimeout(clearLoader, 500));
      iframe.addEventListener("error", clearLoader);
      setTimeout(() => clearLoader(), 15000);

      frames.appendChild(iframe);
      iframes[id] = iframe;
    }
  }

  // Show/hide iframes
  Object.keys(iframes).forEach((key) => {
    iframes[key].classList.toggle("hidden", key !== id);
  });

  // Show/hide loaders
  frames.querySelectorAll(".loader").forEach((loader) => {
    loader.classList.toggle("hidden", loader.dataset.serviceId !== id);
  });

  updateTabStyles();
}

// --- Add/Remove service ---
function removeService(id) {
  services = services.filter((s) => s.id !== id);
  saveCustomServices();

  if (iframes[id]) {
    iframes[id].remove();
    delete iframes[id];
  }

  const loader = frames.querySelector(`.loader[data-service-id="${id}"]`);
  if (loader) loader.remove();

  if (activeId === id) {
    activeId = services[0].id;
  }

  renderTabs();
  switchTo(activeId);
}

// --- Modal ---
function openModal() {
  document.getElementById("modal-backdrop").classList.add("open");
  document.getElementById("modal").classList.add("open");
  document.getElementById("modal-name").focus();
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.remove("open");
  document.getElementById("modal").classList.remove("open");
  document.getElementById("modal-name").value = "";
  document.getElementById("modal-url").value = "";
  const err = document.getElementById("modal-error");
  err.style.display = "none";
  err.textContent = "";
}

function confirmAdd() {
  const name = document.getElementById("modal-name").value.trim();
  let url = document.getElementById("modal-url").value.trim();
  const err = document.getElementById("modal-error");

  if (!name || !url) {
    err.textContent = "Both name and URL are required.";
    err.style.display = "block";
    return;
  }

  if (!url.startsWith("http")) url = "https://" + url;

  if (!isValidUrl(url)) {
    err.textContent = "Please enter a valid URL.";
    err.style.display = "block";
    return;
  }

  const id = "custom-" + Date.now();
  const label = name.charAt(0).toUpperCase();
  services.push({ id, label, name, url, color: "#6366f1" });
  saveCustomServices();

  closeModal();
  renderTabs();
  switchTo(id);
}

document.getElementById("modal-cancel").addEventListener("click", closeModal);
document.getElementById("modal-confirm").addEventListener("click", confirmAdd);
document.getElementById("modal-backdrop").addEventListener("click", closeModal);
document.getElementById("modal").addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
  else if (e.key === "Enter") confirmAdd();
});

// --- Init ---
loadState(() => {
  renderTabs();
  switchTo(activeId);
});
