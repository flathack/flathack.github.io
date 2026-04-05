const newsItems = [
  {
    date: "2026-04-04",
    title: { de: "Trade Route Calculator veröffentlicht", en: "Trade Route Calculator released" },
    text: { de: "Der Trade Route Calculator ist jetzt als Online-Tool auf der Webseite verfügbar — mit Unterstützung für Hamburg City und Crossfire.", en: "The Trade Route Calculator is now available as an online tool on the website — with support for Hamburg City and Crossfire." },
  },
  {
    date: "2026-03-11",
    title: { de: "Webseite überarbeitet", en: "Website redesigned" },
    text: { de: "Die Startseite wurde komplett neu aufgebaut: Projekt-Übersicht, Fortschrittsanzeigen und direkter Zugriff auf alle Tools.", en: "The homepage has been completely rebuilt: project overview, progress indicators, and direct access to all tools." },
  },
  {
    date: "2026-03-08",
    title: { de: "FL-Lingo Workflow verbessert", en: "FL-Lingo workflow improved" },
    text: { de: "Interne Übersetzungs- und Terminologie-Workflows wurden überarbeitet und optimiert.", en: "Internal translation and terminology workflows have been revised and optimized." },
  },
  {
    date: "2026-03-03",
    title: { de: "Savegame Editor Stabilitäts-Update", en: "Savegame Editor stability update" },
    text: { de: "Mehrere kleine Fixes verbessern die Stabilität beim Laden und Validieren von Savegames.", en: "Several small fixes improve stability when loading and validating savegames." },
  },
  {
    date: "2026-02-27",
    title: { de: "Visual Editor Roadmap erweitert", en: "Visual Editor roadmap expanded" },
    text: { de: "Neue Aufgaben für die nächste Entwicklungsphase wurden in die Roadmap aufgenommen.", en: "New tasks for the next development phase have been added to the roadmap." },
  },
];

function formatDate(isoDate) {
  const lang = (function() { try { return sessionStorage.getItem('flathack-lang') || 'en'; } catch(e) { return 'en'; } })();
  const locale = lang === 'en' ? 'en-GB' : 'de-DE';
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function renderNews() {
  const container = document.getElementById("news-feed");

  if (!container) {
    return;
  }

  const lang = (function() { try { return sessionStorage.getItem('flathack-lang') || 'en'; } catch(e) { return 'en'; } })();

  const sortedNews = [...newsItems].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  container.innerHTML = sortedNews
    .map((item) => {
      const title = typeof item.title === 'object' ? (item.title[lang] || item.title.de) : item.title;
      const text = typeof item.text === 'object' ? (item.text[lang] || item.text.de) : item.text;
      return `
        <article class="news-item">
          <h3>${title}</h3>
          <p>${text}</p>
          <span class="news-date">${formatDate(item.date)}</span>
        </article>
      `;
    })
    .join("");
}

document.addEventListener("DOMContentLoaded", renderNews);
window.addEventListener("lang-change", renderNews);
