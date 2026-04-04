const newsItems = [
  {
    date: "2026-04-04",
    title: "Trade Route Calculator veröffentlicht",
    text: "Der Trade Route Calculator ist jetzt als Online-Tool auf der Webseite verfügbar — mit Unterstützung für Hamburg City und Crossfire.",
  },
  {
    date: "2026-03-11",
    title: "Webseite überarbeitet",
    text: "Die Startseite wurde komplett neu aufgebaut: Projekt-Übersicht, Fortschrittsanzeigen und direkter Zugriff auf alle Tools.",
  },
  {
    date: "2026-03-08",
    title: "FL-Lingo Workflow verbessert",
    text: "Interne Übersetzungs- und Terminologie-Workflows wurden überarbeitet und optimiert.",
  },
  {
    date: "2026-03-03",
    title: "Savegame Editor Stabilitäts-Update",
    text: "Mehrere kleine Fixes verbessern die Stabilität beim Laden und Validieren von Savegames.",
  },
  {
    date: "2026-02-27",
    title: "Visual Editor Roadmap erweitert",
    text: "Neue Aufgaben für die nächste Entwicklungsphase wurden in die Roadmap aufgenommen.",
  },
];

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("de-DE", {
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

  const sortedNews = [...newsItems].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  container.innerHTML = sortedNews
    .map((item) => {
      return `
        <article class="news-item">
          <h3>${item.title}</h3>
          <p>${item.text}</p>
          <span class="news-date">${formatDate(item.date)}</span>
        </article>
      `;
    })
    .join("");
}

document.addEventListener("DOMContentLoaded", renderNews);
