chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Default domains that have static rules in rules.json
const STATIC_RULE_DOMAINS = [
  "claude.ai",
  "anthropic.com",
  "gemini.google.com",
  "accounts.google.com",
  "chatgpt.com",
  "auth0.openai.com",
  "auth.openai.com",
  "login.chatgpt.com",
  "grok.com",
  "x.ai",
  "x.com",
];

// Extract domain from URL
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Sync dynamic rules and content scripts for custom services
async function syncCustomServiceRules() {
  const data = await chrome.storage.local.get(["customServices"]);
  const custom = data.customServices || [];

  // Get domains that need dynamic rules (not covered by static rules)
  const dynamicDomains = [];
  for (const service of custom) {
    const domain = extractDomain(service.url);
    if (domain && !STATIC_RULE_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) {
      dynamicDomains.push(domain);
    }
  }

  // Remove existing dynamic rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existingRules.map((r) => r.id);

  // Create new dynamic rules
  const addRules = [];
  if (dynamicDomains.length > 0) {
    addRules.push({
      id: 1000,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "X-Frame-Options", operation: "remove" },
          { header: "Content-Security-Policy", operation: "remove" },
          { header: "Content-Security-Policy-Report-Only", operation: "remove" },
        ],
        requestHeaders: [
          { header: "Sec-Fetch-Dest", operation: "set", value: "document" },
          { header: "Sec-Fetch-Mode", operation: "set", value: "navigate" },
          { header: "Sec-Fetch-Site", operation: "set", value: "none" },
          { header: "Sec-Fetch-User", operation: "set", value: "?1" },
        ],
      },
      condition: {
        resourceTypes: ["sub_frame"],
        requestDomains: dynamicDomains,
      },
    });

    addRules.push({
      id: 1001,
      priority: 2,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "X-Frame-Options", operation: "remove" },
          { header: "Content-Security-Policy", operation: "remove" },
          { header: "Content-Security-Policy-Report-Only", operation: "remove" },
        ],
      },
      condition: {
        resourceTypes: ["xmlhttprequest", "script", "stylesheet", "font", "image", "media", "websocket", "other"],
        requestDomains: dynamicDomains,
      },
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules });

  // Register content scripts for frame-bypass on custom domains
  try {
    await chrome.scripting.unregisterContentScripts({ ids: ["custom-frame-bypass"] });
  } catch {
    // May not exist yet
  }

  if (dynamicDomains.length > 0) {
    const patterns = dynamicDomains.map((d) => "*://*." + d + "/*").concat(dynamicDomains.map((d) => "*://" + d + "/*"));
    await chrome.scripting.registerContentScripts([
      {
        id: "custom-frame-bypass",
        matches: patterns,
        js: ["frame-bypass.js"],
        allFrames: true,
        runAt: "document_start",
        world: "MAIN",
      },
    ]);
  }
}

// Listen for storage changes to re-sync rules
chrome.storage.onChanged.addListener((changes) => {
  if (changes.customServices) {
    syncCustomServiceRules();
  }
});

// Initial sync on install/update
chrome.runtime.onInstalled.addListener(() => {
  syncCustomServiceRules();
});

// Sync on startup
syncCustomServiceRules();
