/**
 * Shared navigation — injected into every page that includes this script.
 * Detects the current page and marks the matching link as active.
 * Pages with children get a sub-navigation bar for mod selection.
 */
(function () {
  const MOD_CHILDREN = [
    { label: "Vanilla", hash: "vanilla" },
    { label: "Hamburg City", hash: "hamburg-city" },
    { label: "Crossfire 2.0", hash: "crossfire" },
    { label: "Discovery 5.3.2", hash: "discovery" },
    { label: "Freelancer-Universe", hash: "freelancer-universe" },
  ];

  const TRADE_SUB_LINKS = [
    { label: "Trade Routes", href: "docs/trade-routes.html" },
    { label: "Trade Compare", href: "docs/trade-compare.html" },
    { label: "Preis-Pattern", href: "docs/price-pattern.html" },
  ];

  const TRADE_TOOL_PAGES = new Set(TRADE_SUB_LINKS.map(function (item) { return item.href; }));

  const NAV_ITEMS = [
    { label: "Home", href: "index.html" },
    { label: "Freelancer 2D", href: "freelancer2d/index.html" },
    { label: "Trade Routes", href: "docs/trade-routes.html", children: MOD_CHILDREN },
    { label: "Schiff-Explorer", href: "docs/ship-explorer.html", children: MOD_CHILDREN },
    { label: "Equipment Explorer", href: "docs/equipment-explorer.html", children: MOD_CHILDREN },
    { label: "Universum", href: "docs/universe-viewer.html", children: MOD_CHILDREN },
    { label: "Rep Planner", href: "docs/rep-planner.html", children: MOD_CHILDREN },
    { label: "Signaturen", href: "docs/forum-signature-progress.html" },
  ];

  // Determine the base path from root to the current page's directory
  const path = window.location.pathname;
  const depth = (function () {
    if (/\/docs\//.test(path)) return 1;
    if (/\/about\//.test(path)) return 1;
    if (/\/help\//.test(path)) return 1;
    return 0;
  })();
  const prefix = depth ? "../" : "";

  // Build current page's canonical path segment for matching
  const segments = path.split("/");
  const fileName = segments.pop() || "index.html";
  const folder = segments.pop() || "";
  const current = folder && folder !== "" && !/flathack\.github\.io/i.test(folder)
    ? folder + "/" + fileName
    : fileName;

  // Find the nav container
  const nav = document.querySelector(".site-nav, .project-top-nav");
  if (!nav) return;

  var activeItem = null;
  var tradeRoutesItem = NAV_ITEMS.find(function (item) { return item.href === "docs/trade-routes.html"; }) || null;

  // ── Build the unified capsule navigation ──
  var navHtml = '';

  NAV_ITEMS.forEach(function (item) {
    const href = prefix + item.href;
    const isHelpSection = item.href === "help/index.html" && current.indexOf("help/") === 0;
    const isTradeGroup = item.href === "docs/trade-routes.html" && TRADE_TOOL_PAGES.has(current);
    const isActive = current === item.href || isHelpSection || isTradeGroup;
    if (isActive) activeItem = item;
    navHtml += '<a href="' + href + '"' + (isActive ? ' class="active"' : "") + ">" + item.label + "</a>";
  });

  if (!activeItem && TRADE_TOOL_PAGES.has(current)) {
    activeItem = tradeRoutesItem;
  }

  // ── Global language toggle ──
  var storedLang = null;
  try { storedLang = sessionStorage.getItem("flathack-lang"); } catch(e) {}
  var currentLang = storedLang || "en";

  var langToggleHtml =
    '<button data-lang="de"' + (currentLang === "de" ? ' class="active"' : '') + '>DE</button>' +
    '<button data-lang="en"' + (currentLang === "en" ? ' class="active"' : '') + '>EN</button>';

  // ── Build the complete capsule structure ──
  var capsule = document.createElement("div");
  capsule.className = "nav-capsule";
  capsule.innerHTML =
    '<div class="nav-capsule-header">' +
      '<a class="brand" href="' + prefix + 'index.html">' +
        '<img class="brand-mark" src="' + prefix + 'assets/img/icons/flathack_icon.png" alt="" width="36" height="36">' +
        '<span class="brand-text">Flathack Projects</span>' +
      '</a>' +
      '<div class="nav-capsule-actions">' +
        '<a class="nav-capsule-help" href="' + prefix + 'help/index.html" title="Help">?</a>' +
        '<div class="nav-capsule-lang" data-lang="' + currentLang + '">' + langToggleHtml + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="nav-capsule-divider"></div>' +
    '<div class="nav-capsule-items">' + navHtml + '</div>';

  // Replace the old header with the capsule
  var siteHeader = document.querySelector(".site-header");
  if (siteHeader) {
    siteHeader.parentNode.replaceChild(capsule, siteHeader);
  } else {
    nav.parentNode.replaceChild(capsule, nav);
  }

  // ── Language toggle event listener ──
  var langToggle = capsule.querySelector(".nav-capsule-lang");
  langToggle.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-lang]");
    if (!btn || btn.dataset.lang === currentLang) return;
    currentLang = btn.dataset.lang;
    try { sessionStorage.setItem("flathack-lang", currentLang); } catch(e) {}
    langToggle.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.lang === currentLang);
    });
    window.dispatchEvent(new CustomEvent("lang-change", { detail: { lang: currentLang } }));
  });

  // Fire initial lang-change so pages can pick up the stored language
  window.dispatchEvent(new CustomEvent("lang-change", { detail: { lang: currentLang } }));

  // Sub-navigation for items with children (mod selector)
  if (activeItem && activeItem.children) {
    // Persist mod selection across pages via localStorage
    var storedMod = null;
    try { storedMod = localStorage.getItem("flathack-mod"); } catch(e) {}
    var hashMod = window.location.hash.replace("#", "");
    var validHashes = activeItem.children.map(function(c) { return c.hash; });
    var currentHash = (hashMod && validHashes.indexOf(hashMod) !== -1) ? hashMod
                    : (storedMod && validHashes.indexOf(storedMod) !== -1) ? storedMod
                    : activeItem.children[0].hash;

    var subNav = document.createElement("nav");
    subNav.className = "project-sub-nav";
    subNav.setAttribute("aria-label", "Mod-Auswahl");

    var modLinksHtml = activeItem.children.map(function (child) {
      var isActive = currentHash === child.hash;
      return '<a href="#' + child.hash + '"' +
        (isActive ? ' class="active"' : '') +
        ' data-mod="' + child.hash + '">' + child.label + '</a>';
    }).join("\n");

    var tradeLinksHtml = "";
    if (activeItem.href === "docs/trade-routes.html") {
      tradeLinksHtml = TRADE_SUB_LINKS.map(function (item) {
        var href = prefix + item.href + (currentHash ? ('#' + currentHash) : '');
        var isActive = current === item.href;
        return '<a href="' + href + '"' + (isActive ? ' class="active"' : '') + '>' + item.label + '</a>';
      }).join("\n");
    }

    subNav.innerHTML =
      '<div class="project-sub-nav-main">' + modLinksHtml + '</div>' +
      (tradeLinksHtml ? '<div class="project-sub-nav-side">' + tradeLinksHtml + '</div>' : '');

    // Insert sub-nav after the capsule
    capsule.parentNode.insertBefore(subNav, capsule.nextSibling);

    // Handle sub-nav clicks
    subNav.addEventListener("click", function (e) {
      var link = e.target.closest("a[data-mod]");
      if (!link) return;
      e.preventDefault();
      var mod = link.dataset.mod;
      window.location.hash = mod;
      try { localStorage.setItem("flathack-mod", mod); } catch(e) {}
      subNav.querySelectorAll("a").forEach(function (a) {
        a.classList.toggle("active", a.dataset.mod === mod);
      });
      window.dispatchEvent(new CustomEvent("mod-change", { detail: { mod: mod } }));
    });

    // Fire initial mod-change so the page loads the right data
    window.dispatchEvent(new CustomEvent("mod-change", { detail: { mod: currentHash } }));
  }
})();
