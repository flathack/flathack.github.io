const newsItems = [
  {
    date: "2026-03-11",
    title: "Homepage Structure Updated",
    text: "The main page now prioritizes news and provides direct access to all core projects.",
  },
  {
    date: "2026-03-08",
    title: "FL-Lingo Workflow Improved",
    text: "Internal translation and terminology workflows were revised and streamlined.",
  },
  {
    date: "2026-03-03",
    title: "Savegame Editor Stability Pass",
    text: "Multiple small fixes improve stability while loading and validating save files.",
  },
  {
    date: "2026-02-27",
    title: "Visual Editor Roadmap Expanded",
    text: "New tasks for the next development phase were added to the roadmap.",
  },
];

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
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
