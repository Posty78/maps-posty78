import { CONFIG }                          from "./config.js";
import { initFirebase, startRealtimeListener } from "./firebase.js";
import { initMap }                         from "./map.js";
import { loadLayers, updateMarkerColors, updateParcoursColors, toggleMcdo, toggleParcours }  from "./layers.js";
import { initHistory }                     from "./history.js";
import {
  updateProgressUI,
  bindLayerButtons,
  bindInfosButton,
  bindToggleButtonsButton,
  bindSearchUI,
  bindLocateButton,
  hideLoader,
}                                          from "./ui.js";

async function bootstrap() {
  try {
    initMap("map", CONFIG.map);

    initFirebase(CONFIG.firebase);

    await loadLayers(0);

    // Afficher les trois couches dès le départ (comme les 3 autres boutons Afficher/Masquer)
    toggleMcdo();
    toggleParcours();

    startRealtimeListener(CONFIG.firestore);
    initHistory(true);

    bindLayerButtons();
    bindInfosButton();
    bindToggleButtonsButton();
    bindSearchUI();
    bindLocateButton();

    hideLoader();

  } catch (err) {
    console.error("[app] Erreur au démarrage :", err);
    document.getElementById("app-loader")?.classList.add("has-error");
  }
}

window.addEventListener("mcdo:update", (e) => {
  const { currentMcdo, currentMcdoInProgress, smoothedPaceKmPerDay } = e.detail;
  window.__smoothedPaceKmPerDay = smoothedPaceKmPerDay;
  updateProgressUI(currentMcdo);
  updateMarkerColors(currentMcdo, currentMcdoInProgress);
  updateParcoursColors(currentMcdo);
});

bootstrap();