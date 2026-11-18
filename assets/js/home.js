// Keep the German HTML usable before JavaScript loads.
const translations = Array.from(document.querySelectorAll("[data-en]"), element => ({
  element,
  de: element.textContent,
  en: element.dataset.en,
}));

window.addEventListener("lang-change", ({ detail }) => {
  const language = detail.lang === "de" ? "de" : "en";
  document.documentElement.lang = language;
  for (const entry of translations) entry.element.textContent = entry[language];
});
