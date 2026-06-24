import { CONFIG }             from "./config.js";
import { getAllMcdoFeatures } from "./layers.js";
import { flyTo }              from "./map.js";

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
      `<p class="search-empty">Aucun McDonald's trouvé à proximité.</p>`;
    return;
  }

  resultsContainer.innerHTML = results
    .map(
      (r) => `
      <button class="search-result-item" data-lat="${r.latlng.lat}" data-lng="${r.latlng.lng}">
        <span class="result-id">${r.id}</span>
        <span class="result-name">${r.properties?.name ?? "McDonald's"}</span>
        <span class="result-distance">${r.distance.toFixed(1)} km</span>
      </button>`
    )
    .join("");

  resultsContainer.querySelectorAll(".search-result-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      flyTo([parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng)], 15);
      closeSearch();
    });
  });
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