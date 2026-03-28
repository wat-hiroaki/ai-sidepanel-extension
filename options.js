const DEFAULT_SERVICES = [
  { id: "claude", label: "C", name: "Claude", url: "https://claude.ai", color: "#d97757" },
  { id: "gemini", label: "G", name: "Gemini", url: "https://gemini.google.com/app", color: "#4285f4" },
  { id: "chatgpt", label: "O", name: "ChatGPT", url: "https://chatgpt.com", color: "#10a37f" },
  { id: "grok", label: "X", name: "Grok", url: "https://grok.com", color: "#1d9bf0" },
];

// Load current shortcut
chrome.commands.getAll((commands) => {
  const toggle = commands.find((c) => c.name === "_execute_action");
  if (toggle?.shortcut) {
    document.getElementById("current-shortcut").textContent = toggle.shortcut;
  }
});

// Copy shortcuts URL to clipboard (chrome:// URLs can't be opened programmatically)
document.getElementById("open-shortcuts").addEventListener("click", (e) => {
  e.preventDefault();
  const url = "chrome://extensions/shortcuts";
  navigator.clipboard.writeText(url).then(() => {
    const el = document.getElementById("open-shortcuts");
    const original = el.textContent;
    el.textContent = "Copied! Paste in address bar.";
    el.style.color = "#22c55e";
    setTimeout(() => {
      el.textContent = original;
      el.style.color = "";
    }, 2000);
  });
});

// Render default services
function renderDefaultServices() {
  chrome.storage.local.get(["hiddenServices"], (data) => {
    const hidden = data.hiddenServices || [];
    const defaultList = document.getElementById("default-services");
    defaultList.innerHTML = "";

    DEFAULT_SERVICES.forEach((s) => {
      const li = document.createElement("li");
      const isHidden = hidden.includes(s.id);

      if (isHidden) li.classList.add("hidden-service");

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = isHidden ? "#555" : s.color;
      const nameSpan = document.createElement("span");
      nameSpan.className = "name";
      nameSpan.textContent = s.name;
      const urlSpan = document.createElement("span");
      urlSpan.className = "url";
      urlSpan.textContent = s.url;
      li.append(dot, nameSpan, urlSpan);

      if (isHidden) {
        const restoreBtn = document.createElement("button");
        restoreBtn.className = "restore-btn";
        restoreBtn.textContent = "+";
        restoreBtn.title = "Restore " + s.name;
        restoreBtn.setAttribute("aria-label", "Restore " + s.name);
        restoreBtn.addEventListener("click", () => {
          const updated = hidden.filter((id) => id !== s.id);
          chrome.storage.local.set({ hiddenServices: updated }, renderDefaultServices);
        });
        li.appendChild(restoreBtn);
      } else {
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-btn";
        removeBtn.textContent = "\u00d7";
        removeBtn.setAttribute("aria-label", "Remove " + s.name);
        removeBtn.addEventListener("click", () => {
          hidden.push(s.id);
          chrome.storage.local.set({ hiddenServices: hidden }, renderDefaultServices);
        });
        li.appendChild(removeBtn);
      }

      defaultList.appendChild(li);
    });
  });
}
renderDefaultServices();

// Render custom services
function renderCustomServices() {
  chrome.storage.local.get(["customServices"], (data) => {
    const custom = data.customServices || [];
    const list = document.getElementById("custom-services");
    list.innerHTML = "";
    if (custom.length === 0) {
      list.innerHTML = '<li style="color:#666;border:1px dashed #333;">No custom services added</li>';
      return;
    }
    custom.forEach((s) => {
      const li = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = s.color || "#6366f1";
      const nameSpan = document.createElement("span");
      nameSpan.className = "name";
      nameSpan.textContent = s.name;
      const urlSpan = document.createElement("span");
      urlSpan.className = "url";
      urlSpan.textContent = s.url;
      li.append(dot, nameSpan, urlSpan);
      const btn = document.createElement("button");
      btn.className = "remove-btn";
      btn.textContent = "\u00d7";
      btn.setAttribute("aria-label", "Remove " + s.name);
      btn.addEventListener("click", () => {
        const updated = custom.filter((c) => c.id !== s.id);
        chrome.storage.local.set({ customServices: updated }, renderCustomServices);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  });
}
renderCustomServices();

// URL validation
function isValidUrl(str) {
  try {
    const parsed = new URL(str);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

// Enter key support for add form
document.getElementById("add-name").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("add-btn").click();
});
document.getElementById("add-url").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("add-btn").click();
});

// Add custom service
document.getElementById("add-btn").addEventListener("click", () => {
  const name = document.getElementById("add-name").value.trim();
  let url = document.getElementById("add-url").value.trim();
  const errorEl = document.getElementById("add-error");
  errorEl.style.display = "none";
  errorEl.textContent = "";

  if (!name || !url) {
    errorEl.textContent = "Both name and URL are required.";
    errorEl.style.display = "block";
    return;
  }
  if (!url.startsWith("http")) url = "https://" + url;

  if (!isValidUrl(url)) {
    errorEl.textContent = "Please enter a valid URL.";
    errorEl.style.display = "block";
    document.getElementById("add-url").style.borderColor = "#ef4444";
    return;
  }
  document.getElementById("add-url").style.borderColor = "";

  chrome.storage.local.get(["customServices"], (data) => {
    const custom = data.customServices || [];
    custom.push({
      id: "custom-" + Date.now(),
      label: name.charAt(0).toUpperCase(),
      name,
      url,
      color: "#6366f1",
    });
    chrome.storage.local.set({ customServices: custom }, () => {
      document.getElementById("add-name").value = "";
      document.getElementById("add-url").value = "";
      renderCustomServices();
    });
  });
});
