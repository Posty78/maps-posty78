import { CONFIG } from "./config.js";

const panel      = document.getElementById("popup-panel");
const panelClose = document.getElementById("popup-close");

if (panelClose) {
  panelClose.addEventListener("click", closePopup);
}

export function closePopup() {
  panel?.classList.remove("is-open");
}

export function buildPopup(layer, props) {
  if (!panel) return;

  const id     = props?.id     ?? "—";
  const name   = props?.name   ?? "McDonald's";
  const index  = parseInt(id.replace("MC", ""), 10);

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
    <button class="popup-close-btn" id="popup-close" aria-label="Fermer">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>

    <div class="popup-header">
      <span class="popup-id">${id}</span>
      <span class="popup-status ${statusClass}">${status}</span>
    </div>

    <h2 class="popup-name">${name}</h2>

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
        <span class="popup-cell__value">—</span>
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