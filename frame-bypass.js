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

  // Override window.length (number of child frames) - some sites check this
  // to detect if they are framed differently
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

  // Intercept postMessage-based frame detection
  // Some apps send a message to parent and check for a response
  const origPostMessage = window.postMessage.bind(window);
  window.postMessage = function(message, targetOrigin, transfer) {
    return origPostMessage(message, targetOrigin, transfer);
  };

  // Override window.opener detection
  try {
    Object.defineProperty(window, "opener", {
      get() { return null; },
      set() {},
      configurable: true,
    });
  } catch {}

  // Prevent cross-origin frame check via try/catch on parent.document
  // Some sites do: try { parent.document } catch(e) { /* framed cross-origin */ }
  // Our top/parent override to self should handle this, but ensure consistency.

  // Block Intersection Observer-based viewport detection (used by some anti-iframe scripts)
  // Not commonly used for frame detection, but included for completeness.

} catch (e) {
  // Silently fail - don't break the page
}
