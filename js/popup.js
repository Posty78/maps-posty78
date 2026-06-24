import { CONFIG } from "./config.js";

const panel = document.getElementById("popup-panel");

export function closePopup() {
  panel?.classList.remove("is-open");
}

// ─── Date estimée ──────────────────────────────────────────────────────────────
const DEPART_DATE = new Date(2026, 8, 1); // 1er septembre 2026
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

// ─── Formatage ─────────────────────────────────────────────────────────────────
function formatVille(raw) {
  return raw
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Popup ─────────────────────────────────────────────────────────────────────
export function buildPopup(layer, props) {
  if (!panel) return;

  const id      = props?.id      ?? "—";
  const nom     = props?.name    ?? "—";
  const adresse = props?.adresse ?? "—";
  const cumul   = props?.cumul_km ?? null;
  const ordre   = props?.ordre   ?? null;
  const index   = parseInt(id.replace("MC", ""), 10);

  const ville = formatVille(nom);

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

  const distanceText = cumul !== null
    ? `${cumul.toLocaleString("fr-FR")} km`
    : "—";

  const etapeText = ordre !== null
    ? `${ordre} / ${CONFIG.totalMcdo}`
    : "—";

  const dateText = ordre !== null
    ? dateEstimee(ordre)
    : "—";

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
        <span class="popup-cell__value">${adresse}</span>
      </div>
      <div class="popup-cell">
        <span class="popup-cell__label">Date estimée</span>
        <span class="popup-cell__value">${dateText}</span>
      </div>
      <div class="popup-cell">
        <span class="popup-cell__label">Distance depuis départ</span>
        <span class="popup-cell__value">${distanceText}</span>
      </div>
      <div class="popup-cell">
        <span class="popup-cell__label">Étape n°</span>
        <span class="popup-cell__value">${etapeText}</span>
      </div>
    </div>
  `;

  panel.querySelector(".popup-close-btn")?.addEventListener("click", closePopup);
  panel.classList.add("is-open");
}