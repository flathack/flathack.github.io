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

  const NAV_ITEMS = [
    { label: "Home", href: "index.html" },
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

  const nav = document.querySelector(".site-nav, .project-top-nav");
  if (!nav) return;

  nav.setAttribute("aria-label", "Projekt-Navigation");
  nav.className = "project-top-nav";

  var activeItem = null;
  nav.innerHTML = NAV_ITEMS.map(function (item) {
    const href = prefix + item.href;
    const isActive = current === item.href;
    if (isActive) activeItem = item;
    return '<a href="' + href + '"' + (isActive ? ' class="active"' : "") + ">" + item.label + "</a>";
  }).join("\n");

  // ── Global language toggle ──
  var storedLang = null;
  try { storedLang = sessionStorage.getItem("flathack-lang"); } catch(e) {}
  var currentLang = storedLang || "en";

  var langToggle = document.createElement("div");
  langToggle.className = "nav-lang-toggle";
  langToggle.innerHTML =
    '<button data-lang="de"' + (currentLang === "de" ? ' class="active"' : '') + '>DE</button>' +
    '<button data-lang="en"' + (currentLang === "en" ? ' class="active"' : '') + '>EN</button>';
  nav.appendChild(langToggle);

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

    subNav.innerHTML = activeItem.children.map(function (child) {
      var isActive = currentHash === child.hash;
      return '<a href="#' + child.hash + '"' +
        (isActive ? ' class="active"' : '') +
        ' data-mod="' + child.hash + '">' + child.label + '</a>';
    }).join("\n");

    // Insert sub-nav after the header
    var header = nav.closest(".site-header");
    if (header) {
      header.parentNode.insertBefore(subNav, header.nextSibling);
    } else {
      nav.parentNode.insertBefore(subNav, nav.nextSibling);
    }

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
