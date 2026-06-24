import { CONFIG } from "./config.js";

const panel = document.getElementById("popup-panel");

export function closePopup() {
  panel?.classList.remove("is-open");
}

// Point de départ : Les Ulis
const DEPART = { lat: 48.6819, lng: 2.1693 };

function toRad(deg) { return deg * (Math.PI / 180); }

function distanceKm(lat1, lng1, lat2, lng2) {
  const R  = 6371;
  const dL = toRad(lat2 - lat1);
  const dG = toRad(lng2 - lng1);
  const x  =
    Math.sin(dL / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatName(raw) {
  // "MC0857 - pontault combault" → "Pontault Combault"
  const parts = raw.split(" - ");
  if (parts.length < 2) return raw;
  return parts[1]
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatId(raw) {
  // "MC0857 - pontault combault" → "MC0857"
  const parts = raw.split(" - ");
  return parts[0].trim();
}

export function buildPopup(layer, props) {
  if (!panel) return;

  const raw    = props?.name ?? "";
  const id     = formatId(raw);
  const ville  = formatName(raw);
  const index  = parseInt(id.replace("MC", ""), 10);
  const latlng = layer.getLatLng();

  const dist   = distanceKm(DEPART.lat, DEPART.lng, latlng.lat, latlng.lng);

  const current = window.__currentMcdo ?? 0;
  const status  = index < current
    ? "Visité"
    : index === current
    ? "En cours"
    : "À venir";

  const statusClass = index < current
    ? "status--visited"
    : index === current
    ? "status--current"
    : "status--future";

  panel.innerHTML = `
    <button class="popup-close-btn" aria-label="Fermer">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>

    <div class="popup-header">
      <span class="popup-id">Macdo n°${String(index).padStart(4, "0")}</span>
      <span class="popup-status ${statusClass}">${status}</span>
    </div>

    <h2 class="popup-name">${ville}</h2>

    <div class="popup-grid">
      <div class="popup-cell">
        <span class="popup-cell__label">Adresse</span>
        <span class="popup-cell__value">—</span>
      </div>
      <div class="popup-cell">
        <span class="popup-cell__label">Date estimée</span>
        <span class="popup-cell__value">—</span>
      </div>
      <div class="popup-cell">
        <span class="popup-cell__label">Distance départ</span>
        <span class="popup-cell__value">${dist.toFixed(0)} km</span>
      </div>
      <div class="popup-cell">
        <span class="popup-cell__label">Étape n°</span>
        <span class="popup-cell__value">${index} / ${CONFIG.totalMcdo}</span>
      </div>
    </div>
  `;

  panel.querySelector(".popup-close-btn")?.addEventListener("click", closePopup);
  panel.classList.add("is-open");
}