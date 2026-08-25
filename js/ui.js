import { CONFIG }                                  from "./config.js?v=12";
import { toggleMcdo, toggleParcours, getAllMcdoFeatures, getRawFeatures } from "./layers.js?v=6";
import { toggleHistory }                           from "./history.js?v=2";
import { openSearch, closeSearch, searchByQuery }  from "./search.js?v=5";
import { locateUser }                              from "./geolocation.js?v=3";

const elCount     = document.getElementById("progress-count");
const elPercent   = document.getElementById("progress-percent");
const elBar       = document.getElementById("progress-bar-fill");
const elDistance  = document.getElementById("progress-distance");
const elVillesCount   = document.getElementById("villes-count");
const elVillesPercent = document.getElementById("villes-percent");
const elVillesBar     = document.getElementById("villes-bar-fill");
const btnMcdo          = document.getElementById("btn-mcdo");
const btnParcours      = document.getElementById("btn-parcours");
const btnHistorique    = document.getElementById("btn-historique");
const btnInfos         = document.getElementById("btn-infos");
const btnToggleButtons = document.getElementById("btn-toggle-buttons");
const btnSearch   = document.getElementById("btn-search");
const searchInput = document.getElementById("search-input");
const searchForm  = document.getElementById("search-form");

// Commune officielle (reverse-geocodee Google, verifiee point par point) precalculee
// dans le geojson lui-meme : bien plus fiable que parser le champ "adresse" en texte
// libre (formats incoherents d'un point a l'autre, voir l'audit complet du 22/08/2026).
function communeOf(properties) {
  if (!properties?.commune) return null;
  return properties.commune.trim().toLowerCase();
}

let _totalVilles = null;

function getTotalVilles(features) {
  if (_totalVilles !== null) return _totalVilles;
  const set = new Set();
  features.forEach((f) => {
    const commune = communeOf(f.properties);
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
      const commune = communeOf(f.properties);
      if (commune) visited.add(commune);
    }
  });

  const count   = visited.size;
  const percent = total ? ((count / total) * 100).toFixed(1) : "0.0";

  elVillesCount.textContent   = `${count} / ${total}`;
  if (elVillesPercent) elVillesPercent.textContent = `${percent} %`;
  if (elVillesBar)     elVillesBar.style.width     = `${percent}%`;
}

export function updateProgressUI(currentMcdo, realDistanceKm) {
  const total   = CONFIG.totalMcdo;
  const percent = ((currentMcdo / total) * 100).toFixed(1);

  if (elCount)   elCount.textContent   = `${currentMcdo} / ${total}`;
  if (elPercent) elPercent.textContent = `${percent} %`;
  if (elBar)     elBar.style.width     = `${percent}%`;

  window.__currentMcdo = currentMcdo;

  updateVillesUI(currentMcdo);

  // cumul_km du dernier McDo valide : reference utilisee par "date estimee" (popup.js),
  // un calcul base sur le trace, distinct de l'affichage "Distance parcourue" ci-dessous.
  if (currentMcdo > 0) {
    const features = getAllMcdoFeatures();
    const id = "MC" + String(currentMcdo).padStart(4, "0");
    const found = features.find((f) => f.id === id);
    const cumulKm = found?.properties?.cumul_km;
    window.__currentMcdoCumulKm = typeof cumulKm === "number" ? cumulKm : null;
  } else {
    window.__currentMcdoCumulKm = null;
  }

  // "Distance parcourue" affichee : odometre GPS reel (project/status.realDistanceKm,
  // alimente par l'APK) des qu'il existe ; sinon repli sur le cumul_km du trace prevu
  // jusqu'au dernier McDo valide (comportement historique, tant que l'APK n'existe pas).
  if (elDistance) {
    if (typeof realDistanceKm === "number") {
      elDistance.textContent = `${realDistanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
    } else if (typeof window.__currentMcdoCumulKm === "number") {
      elDistance.textContent = `${window.__currentMcdoCumulKm.toLocaleString("fr-FR")} km`;
    } else {
      elDistance.textContent = "0 km";
    }
  }
}

export function bindLayerButtons() {
  if (btnMcdo)       btnMcdo.classList.add("is-active");
  if (btnParcours)   btnParcours.classList.add("is-active");
  if (btnHistorique) btnHistorique.classList.add("is-active");

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

  if (btnHistorique) {
    btnHistorique.addEventListener("click", () => {
      const visible = toggleHistory();
      btnHistorique.classList.toggle("is-active", visible);
      btnHistorique.setAttribute("aria-pressed", String(visible));
    });
  }
}

export function bindInfosButton() {
  const hud = document.getElementById("hud");
  const topControls = document.getElementById("top-controls");
  if (!btnInfos || !hud) return;

  btnInfos.classList.add("is-active");
  btnInfos.addEventListener("click", () => {
    const isNowHidden = hud.classList.toggle("is-hidden");
    if (topControls) topControls.classList.toggle("is-hidden", isNowHidden);
    if (isNowHidden) closeSearch();
    btnInfos.classList.toggle("is-active", !isNowHidden);
    btnInfos.setAttribute("aria-pressed", String(!isNowHidden));
  });
}

export function bindToggleButtonsButton() {
  const floatingControls = document.getElementById("floating-controls");
  const hud              = document.getElementById("hud");
  const topControls      = document.getElementById("top-controls");
  if (!btnToggleButtons || !floatingControls) return;

  // Le bouton oeil/fleche vit dans le meme groupe que les 4 autres (#floating-controls)
  // mais ne doit jamais se masquer lui-meme : on cache individuellement les autres
  // boutons (.fab), pas le conteneur entier. Il masque aussi le HUD (progression,
  // legende, infos giveaway) et la recherche : un seul geste pour degager toute la
  // carte, plutot que de devoir en plus aller chercher le bouton "Infos".
  const otherButtons = Array.from(floatingControls.querySelectorAll(".fab"));

  btnToggleButtons.classList.add("is-active");
  btnToggleButtons.addEventListener("click", () => {
    const isNowHidden = !otherButtons[0]?.classList.contains("is-hidden");
    otherButtons.forEach((btn) => btn.classList.toggle("is-hidden", isNowHidden));
    if (hud) hud.classList.toggle("is-hidden", isNowHidden);
    if (topControls) topControls.classList.toggle("is-hidden", isNowHidden);
    if (isNowHidden) closeSearch();

    btnToggleButtons.classList.toggle("is-active", !isNowHidden);
    btnToggleButtons.setAttribute("aria-pressed", String(!isNowHidden));
    btnInfos?.classList.toggle("is-active", !isNowHidden);
    btnInfos?.setAttribute("aria-pressed", String(!isNowHidden));
  });
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