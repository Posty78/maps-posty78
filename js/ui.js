import { CONFIG }                                  from "./config.js";
import { toggleMcdo, toggleParcours, getAllMcdoFeatures, getRawFeatures } from "./layers.js";
import { openSearch, closeSearch, searchByQuery }  from "./search.js";
import { locateUser }                              from "./geolocation.js";

const elCount     = document.getElementById("progress-count");
const elPercent   = document.getElementById("progress-percent");
const elBar       = document.getElementById("progress-bar-fill");
const elDistance  = document.getElementById("progress-distance");
const elVillesCount   = document.getElementById("villes-count");
const elVillesPercent = document.getElementById("villes-percent");
const elVillesBar     = document.getElementById("villes-bar-fill");
const btnMcdo     = document.getElementById("btn-mcdo");
const btnParcours = document.getElementById("btn-parcours");
const btnSearch   = document.getElementById("btn-search");
const searchInput = document.getElementById("search-input");
const searchForm  = document.getElementById("search-form");

// Extrait le nom de commune depuis l'adresse (dernier segment après la dernière virgule)
function communeFromAdresse(adresse) {
  if (!adresse) return null;
  const parts = adresse.split(",");
  return parts[parts.length - 1].trim().toLowerCase();
}

let _totalVilles = null;

function getTotalVilles(features) {
  if (_totalVilles !== null) return _totalVilles;
  const set = new Set();
  features.forEach((f) => {
    const commune = communeFromAdresse(f.properties?.adresse);
    if (commune) set.add(commune);
  });
  _totalVilles = set.size;
  return _totalVilles;
}

function updateVillesUI(currentMcdo) {
  if (!elVillesCount) return;
  const features = getRawFeatures();
  if (!features.length) return;

  const total = getTotalVilles(features);
  const visited = new Set();
  features.forEach((f) => {
    const index = parseInt(String(f.id).replace("MC", ""), 10);
    if (index <= currentMcdo) {
      const commune = communeFromAdresse(f.properties?.adresse);
      if (commune) visited.add(commune);
    }
  });

  const count   = visited.size;
  const percent = total ? ((count / total) * 100).toFixed(1) : "0.0";

  elVillesCount.textContent   = `${count} / ${total}`;
  if (elVillesPercent) elVillesPercent.textContent = `${percent} %`;
  if (elVillesBar)     elVillesBar.style.width     = `${percent}%`;
}

export function updateProgressUI(currentMcdo) {
  const total   = CONFIG.totalMcdo;
  const percent = ((currentMcdo / total) * 100).toFixed(1);

  if (elCount)   elCount.textContent   = `${currentMcdo} / ${total}`;
  if (elPercent) elPercent.textContent = `${percent} %`;
  if (elBar)     elBar.style.width     = `${percent}%`;

  window.__currentMcdo = currentMcdo;

  updateVillesUI(currentMcdo);

  // Distance parcourue - on cherche le Macdo actuel dans le GeoJSON
  if (elDistance && currentMcdo > 0) {
    const features = getAllMcdoFeatures();
    const id = "MC" + String(currentMcdo).padStart(4, "0");
    const found = features.find((f) => f.id === id);
    if (found && found.properties?.cumul_km) {
      const km = found.properties.cumul_km.toLocaleString("fr-FR");
      elDistance.textContent = `${km} km`;
    } else {
      elDistance.textContent = "- km";
    }
  } else if (elDistance) {
    elDistance.textContent = "0 km";
  }
}

export function bindLayerButtons() {
  if (btnMcdo)     btnMcdo.classList.add("is-active");
  if (btnParcours) btnParcours.classList.add("is-active");

  if (btnMcdo) {
    btnMcdo.addEventListener("click", () => {
      const visible = toggleMcdo();
      btnMcdo.classList.toggle("is-active", visible);
      btnMcdo.setAttribute("aria-pressed", String(visible));
    });
  }

  if (btnParcours) {
    btnParcours.addEventListener("click", () => {
      const visible = toggleParcours();
      btnParcours.classList.toggle("is-active", visible);
      btnParcours.setAttribute("aria-pressed", String(visible));
    });
  }
}

export function bindSearchUI() {
  if (btnSearch) {
    btnSearch.addEventListener("click", () => {
      const panel = document.getElementById("search-panel");
      if (panel?.classList.contains("is-open")) {
        closeSearch();
      } else {
        openSearch();
      }
    });
  }

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = searchInput?.value?.trim();
      if (q) searchByQuery(q);
    });
  }

  document.addEventListener("click", (e) => {
    const panel  = document.getElementById("search-panel");
    const isOpen = panel?.classList.contains("is-open");
    if (!isOpen) return;
    const inside = panel.contains(e.target) || btnSearch?.contains(e.target);
    if (!inside) closeSearch();
  });
}

export function bindLocateButton() {
  const btnLocate = document.getElementById("btn-locate");
  if (btnLocate) {
    btnLocate.addEventListener("click", locateUser);
  }
}

export function hideLoader() {
  const loader = document.getElementById("app-loader");
  if (loader) {
    loader.classList.add("is-hidden");
    setTimeout(() => loader.remove(), 600);
  }
}