import { CONFIG }             from "./config.js";
import { getAllMcdoFeatures } from "./layers.js";
import { flyTo }              from "./map.js";
import { buildPopup }         from "./popup.js";

function toRad(deg) { return deg * (Math.PI / 180); }

function haversine(a, b) {
  const R  = 6371;
  const dL = toRad(b.lat - a.lat);
  const dG = toRad(b.lng - a.lng);
  const x  =
    Math.sin(dL / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function geocode(query) {
  const url =
    `${CONFIG.search.nominatimUrl}?q=${encodeURIComponent(query)}&${CONFIG.search.nominatimParams}`;

  const res  = await fetch(url, {
    headers: { "Accept-Language": "fr", "User-Agent": "maps.posty78.fr" },
  });
  const data = await res.json();

  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

function findNearest(point, n = CONFIG.search.maxResults) {
  return getAllMcdoFeatures()
    .map((f) => ({
      ...f,
      distance: haversine(point, { lat: f.latlng.lat, lng: f.latlng.lng }),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, n);
}

const resultsContainer = document.getElementById("search-results");

function renderResults(results) {
  if (!resultsContainer) return;

  if (!results.length) {
    resultsContainer.innerHTML =
      `<p class="search-empty">Aucun Macdo trouvé à proximité.</p>`;
    return;
  }

  resultsContainer.innerHTML = results
    .map((r) => {
      const nom = r.properties?.name ?? "Macdo";
      const ville = nom.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      const date = r.properties?.ordre ? dateEstimee(r.properties.ordre) : "—";
      return `
        <button class="search-result-item"
          data-lat="${r.latlng.lat}"
          data-lng="${r.latlng.lng}"
          data-id="${r.id}">
          <span class="result-id">${r.id}</span>
          <span class="result-info">
            <span class="result-name">${ville}</span>
            <span class="result-date">${date}</span>
          </span>
          <span class="result-distance">${r.distance.toFixed(1)} km</span>
        </button>`;
    })
    .join("");

  resultsContainer.querySelectorAll(".search-result-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      const id  = btn.dataset.id;

      flyTo([lat, lng], 15);
      closeSearch();

      // Ouvrir la popup du Macdo sélectionné
      const features = getAllMcdoFeatures();
      const found = features.find((f) => f.id === id);
      if (found) {
        buildPopup(found.layer, found.properties);
      }
    });
  });
}

// Calcul date estimée (même logique que popup.js)
const DEPART_DATE = new Date(2026, 8, 1);
const TOTAL_JOURS = 365;
const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

function dateEstimee(ordre) {
  const joursEcoules = Math.floor((ordre / CONFIG.totalMcdo) * TOTAL_JOURS);
  const date = new Date(DEPART_DATE);
  date.setDate(date.getDate() + joursEcoules);
  return `${date.getDate()} ${MOIS[date.getMonth()]} ${date.getFullYear()}`;
}

function showSearchLoader() {
  if (resultsContainer)
    resultsContainer.innerHTML = `<p class="search-loading">Recherche en cours…</p>`;
}

function showSearchError(msg) {
  if (resultsContainer)
    resultsContainer.innerHTML = `<p class="search-error">${msg}</p>`;
}

export async function searchByQuery(query) {
  if (!query.trim()) return;
  showSearchLoader();

  const point = await geocode(query);

  if (!point) {
    showSearchError("Lieu introuvable. Essayez une ville ou un code postal.");
    return;
  }

  const results = findNearest(point);
  renderResults(results);
  flyTo([point.lat, point.lng], 10);
}

export function searchByCoords(lat, lng) {
  const results = findNearest({ lat, lng });
  renderResults(results);
  flyTo([lat, lng], 12);
}

export function openSearch() {
  document.getElementById("search-panel")?.classList.add("is-open");
  document.getElementById("search-input")?.focus();
}

export function closeSearch() {
  document.getElementById("search-panel")?.classList.remove("is-open");
}