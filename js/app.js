import { CONFIG }                          from "./config.js?v=11";
import { initFirebase, startRealtimeListener } from "./firebase.js?v=2";
import { initMap }                         from "./map.js?v=3";
import { loadLayers, updateMarkerColors, updateParcoursColors, toggleMcdo, toggleParcours }  from "./layers.js?v=2";
import { initHistory }                     from "./history.js?v=2";
import { initLivePosition }                from "./live-position.js?v=3";
import {
  updateProgressUI,
  bindLayerButtons,
  bindInfosButton,
  bindToggleButtonsButton,
  bindSearchUI,
  bindLocateButton,
  hideLoader,
}                                          from "./ui.js?v=2";

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
    initLivePosition();

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
  const { currentMcdo, currentMcdoInProgress, smoothedPaceKmPerDay, realDistanceKm } = e.detail;
  window.__smoothedPaceKmPerDay = smoothedPaceKmPerDay;
  updateProgressUI(currentMcdo, realDistanceKm);
  updateMarkerColors(currentMcdo, currentMcdoInProgress);
  updateParcoursColors(currentMcdo);
});

bootstrap();