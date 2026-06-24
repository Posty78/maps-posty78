import { CONFIG }                          from "./config.js";
import { initFirebase, startRealtimeListener } from "./firebase.js";
import { initMap }                         from "./map.js";
import { loadLayers, updateMarkerColors }  from "./layers.js";
import {
  updateProgressUI,
  bindLayerButtons,
  bindSearchUI,
  bindLocateButton,
  hideLoader,
}                                          from "./ui.js";

async function bootstrap() {
  try {
    initMap("map", CONFIG.map);

    initFirebase(CONFIG.firebase);

    await loadLayers(0);

    startRealtimeListener(CONFIG.firestore);

    bindLayerButtons();
    bindSearchUI();
    bindLocateButton();

    hideLoader();

  } catch (err) {
    console.error("[app] Erreur au démarrage :", err);
    document.getElementById("app-loader")?.classList.add("has-error");
  }
}

window.addEventListener("mcdo:update", (e) => {
  const { currentMcdo } = e.detail;
  updateProgressUI(currentMcdo);
  updateMarkerColors(currentMcdo);
});

bootstrap();