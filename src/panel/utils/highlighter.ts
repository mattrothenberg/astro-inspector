/**
 * Highlights an element in the inspected page
 */
export async function highlightElement(path: string): Promise<void> {
  const tabId = chrome.devtools.inspectedWindow.tabId;
  if (!tabId) return;

  await chrome.scripting.executeScript({
    target: { tabId },
    args: [path],
    func: (elementPath: string) => {
      // Remove any existing highlight
      const existing = document.getElementById("__astro_devtools_highlight__");
      if (existing) existing.remove();

      // Find the element by path
      let element: Element | null = document.body;
      if (elementPath) {
        const indices = elementPath.split(".").map(Number);
        for (const index of indices) {
          if (!element) break;
          element = element.children[index] || null;
        }
      }

      if (!element) return;

      // Get element bounds - for astro-island, get bounds of all children combined
      let rect = element.getBoundingClientRect();

      // If element has no dimensions (common for astro-island), calculate from children
      if (
        (rect.width === 0 || rect.height === 0) &&
        element.children.length > 0
      ) {
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        const calculateBounds = (el: Element) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            minX = Math.min(minX, r.left);
            minY = Math.min(minY, r.top);
            maxX = Math.max(maxX, r.right);
            maxY = Math.max(maxY, r.bottom);
          }
          // Also check children
          for (const child of el.children) {
            calculateBounds(child);
          }
        };

        calculateBounds(element);

        if (minX !== Infinity) {
          rect = {
            top: minY,
            left: minX,
            right: maxX,
            bottom: maxY,
            width: maxX - minX,
            height: maxY - minY,
            x: minX,
            y: minY,
            toJSON: () => ({}),
          };
        }
      }

      // Skip if still no dimensions
      if (rect.width === 0 || rect.height === 0) return;

      // Create highlight overlay
      const highlight = document.createElement("div");
      highlight.id = "__astro_devtools_highlight__";
      highlight.style.cssText = `
        position: fixed;
        top: ${rect.top}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background: rgba(78, 201, 176, 0.3);
        border: 2px solid #4ec9b0;
        pointer-events: none;
        z-index: 999999;
        box-sizing: border-box;
      `;

      // Add label
      const label = document.createElement("div");
      label.style.cssText = `
        position: absolute;
        top: -20px;
        left: 0;
        background: #4ec9b0;
        color: #000;
        font-size: 11px;
        font-family: monospace;
        padding: 2px 6px;
        border-radius: 2px;
        white-space: nowrap;
      `;
      label.textContent = element.tagName.toLowerCase();
      if (element.tagName.toLowerCase() === "astro-island") {
        const name = element.getAttribute("opts");
        if (name) {
          try {
            const opts = JSON.parse(name);
            if (opts.name) {
              label.textContent = `<${opts.name} />`;
            }
          } catch {}
        }
      }
      highlight.appendChild(label);

      document.body.appendChild(highlight);
    },
  });
}

/**
 * Removes the highlight overlay
 */
export async function clearHighlight(): Promise<void> {
  const tabId = chrome.devtools.inspectedWindow.tabId;
  if (!tabId) return;

  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const existing = document.getElementById("__astro_devtools_highlight__");
      if (existing) existing.remove();
    },
  });
}

/**
 * Scrolls an element into view in the inspected page
 */
export async function scrollToElement(path: string): Promise<void> {
  const tabId = chrome.devtools.inspectedWindow.tabId;
  if (!tabId) return;

  await chrome.scripting.executeScript({
    target: { tabId },
    args: [path],
    func: (elementPath: string) => {
      // Find the element by path
      let element: Element | null = document.body;
      if (elementPath) {
        const indices = elementPath.split(".").map(Number);
        for (const index of indices) {
          if (!element) break;
          element = element.children[index] || null;
        }
      }

      if (!element) return;

      // For astro-island, try to find the first visible child
      if (
        element.tagName.toLowerCase() === "astro-island" &&
        element.children.length > 0
      ) {
        const findVisibleChild = (el: Element): Element | null => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return el;
          for (const child of el.children) {
            const visible = findVisibleChild(child);
            if (visible) return visible;
          }
          return null;
        };
        const visibleChild = findVisibleChild(element);
        if (visibleChild) element = visibleChild;
      }

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    },
  });
}
