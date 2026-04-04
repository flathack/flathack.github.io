/**
 * Shared navigation — injected into every page that includes this script.
 * Detects the current page and marks the matching link as active.
 */
(function () {
  const NAV_ITEMS = [
    { label: "Home",            href: "index.html" },
    { label: "Trade Routes",    href: "docs/trade-routes.html" },
    { label: "Schiff-Explorer", href: "docs/ship-explorer.html" },
    { label: "Signaturen",      href: "docs/forum-signature-progress.html" },
  ];

  // Determine the base path from root to the current page's directory
  const path = window.location.pathname;
  const depth = (function () {
    if (/\/docs\//.test(path)) return 1;
    if (/\/about\//.test(path)) return 1;
    return 0;
  })();
  const prefix = depth ? "../" : "";

  // Build current page's canonical path segment for matching
  const segments = path.split("/");
  const fileName = segments.pop() || "index.html";
  const folder = segments.pop() || "";
  // e.g. "docs/fleditor.html" or "index.html" or "about/index.html"
  const current = folder && folder !== "" && !/flathack\.github\.io/i.test(folder)
    ? folder + "/" + fileName
    : fileName;

  const nav = document.querySelector(".site-nav, .project-top-nav");
  if (!nav) return;

  nav.setAttribute("aria-label", "Projekt-Navigation");
  // Ensure correct CSS class
  nav.className = "project-top-nav";

  nav.innerHTML = NAV_ITEMS.map(function (item) {
    const href = prefix + item.href;
    const isActive = current === item.href;
    return '<a href="' + href + '"' + (isActive ? ' class="active"' : "") + ">" + item.label + "</a>";
  }).join("\n");
})();
