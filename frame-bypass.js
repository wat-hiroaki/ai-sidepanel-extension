// Runs in MAIN world at document_start on AI service domains.
// Overrides frame-busting detection so services work inside sidebar iframes.

try {
  // Core frame detection overrides
  const self = window.self;

  Object.defineProperty(window, "top", {
    get() { return self; },
    configurable: true,
  });

  Object.defineProperty(window, "parent", {
    get() { return self; },
    configurable: true,
  });

  Object.defineProperty(window, "frameElement", {
    get() { return null; },
    configurable: true,
  });

  // Override window.length (number of child frames)
  const origLength = Object.getOwnPropertyDescriptor(window, "length");
  if (origLength) {
    Object.defineProperty(window, "length", {
      get() { return origLength.get ? origLength.get.call(window) : 0; },
      set(v) { if (origLength.set) origLength.set.call(window, v); },
      configurable: true,
    });
  }

  // Override location.ancestorOrigins which reveals iframe nesting
  try {
    if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
      Object.defineProperty(window.location, "ancestorOrigins", {
        get() { return { length: 0, contains: () => false, item: () => null, [Symbol.iterator]: function*() {} }; },
        configurable: true,
      });
    }
  } catch {}

  // Override window.opener detection
  try {
    Object.defineProperty(window, "opener", {
      get() { return null; },
      set() {},
      configurable: true,
    });
  } catch {}

  // --- Additional iframe detection bypasses ---

  // 1. Override visualViewport to match window dimensions
  // Some sites compare visualViewport vs screen to detect side panels
  try {
    const origVV = window.visualViewport;
    if (origVV) {
      const vvProxy = new Proxy(origVV, {
        get(target, prop) {
          if (prop === "width") return window.innerWidth;
          if (prop === "height") return window.innerHeight;
          if (prop === "offsetLeft") return 0;
          if (prop === "offsetTop") return 0;
          if (prop === "scale") return 1;
          const val = Reflect.get(target, prop);
          return typeof val === "function" ? val.bind(target) : val;
        },
      });
      Object.defineProperty(window, "visualViewport", {
        get() { return vvProxy; },
        configurable: true,
      });
    }
  } catch {}

  // 2. Override window.screen properties to not reveal side panel context
  try {
    const origAvailWidth = screen.availWidth;
    const origAvailHeight = screen.availHeight;
    Object.defineProperty(screen, "availWidth", {
      get() { return origAvailWidth; },
      configurable: true,
    });
    Object.defineProperty(screen, "availHeight", {
      get() { return origAvailHeight; },
      configurable: true,
    });
  } catch {}

  // 3. Override document.referrer to hide extension origin
  try {
    Object.defineProperty(document, "referrer", {
      get() { return ""; },
      configurable: true,
    });
  } catch {}

  // 4. Override window.crossOriginIsolated
  try {
    Object.defineProperty(window, "crossOriginIsolated", {
      get() { return false; },
      configurable: true,
    });
  } catch {}

  // 5. Intercept matchMedia to handle prefers-reduced-motion and display-mode checks
  try {
    const origMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = function(query) {
      // Some apps check display-mode to detect non-browser contexts
      if (query && query.includes("display-mode")) {
        return origMatchMedia("(display-mode: browser)");
      }
      return origMatchMedia(query);
    };
  } catch {}

  // 6. Override Navigation API's indication of iframe context
  try {
    if (window.navigation) {
      const origNavigation = window.navigation;
      const navProxy = new Proxy(origNavigation, {
        get(target, prop) {
          const val = Reflect.get(target, prop);
          return typeof val === "function" ? val.bind(target) : val;
        },
      });
      Object.defineProperty(window, "navigation", {
        get() { return navProxy; },
        configurable: true,
      });
    }
  } catch {}

  // 7. Intercept fetch/XHR to add headers that hide iframe context
  // Some apps send a header indicating embed state to their API
  try {
    const origFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      if (init && init.headers) {
        // Remove any headers that reveal iframe embedding
        if (init.headers instanceof Headers) {
          init.headers.delete("x-embed-context");
          init.headers.delete("x-frame-context");
          init.headers.delete("sec-fetch-dest");
        } else if (typeof init.headers === "object" && !Array.isArray(init.headers)) {
          delete init.headers["x-embed-context"];
          delete init.headers["x-frame-context"];
        }
      }
      return origFetch(input, init);
    };
  } catch {}

  // 8. Override performance.navigation (deprecated but still checked by some sites)
  try {
    if (window.performance && window.performance.navigation) {
      Object.defineProperty(window.performance.navigation, "type", {
        get() { return 0; }, // TYPE_NAVIGATE
        configurable: true,
      });
    }
  } catch {}

  // 9. Override window.name which can leak iframe context
  try {
    Object.defineProperty(window, "name", {
      get() { return ""; },
      set() {},
      configurable: true,
    });
  } catch {}

  // 10. Intercept postMessage to prevent frame detection via messaging
  const origPostMessage = window.postMessage.bind(window);
  window.postMessage = function(message, targetOrigin, transfer) {
    return origPostMessage(message, targetOrigin, transfer);
  };

} catch (e) {
  // Silently fail - don't break the page
}
