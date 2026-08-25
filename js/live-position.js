import { getDb } from "./firebase.js?v=2";
import { doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getMap } from "./map.js?v=3";
import { CONFIG } from "./config.js?v=13";

// Point vert "position actuelle" sur la grosse carte, comme le point bleu de la
// mini map de l'overlay - même doc source (tracking/live, écrit par l'APK
// toutes les 5s). Contrairement à la mini map (un seul spectateur : la source
// OBS), cette page a une audience variable - un listener temps réel (onSnapshot)
// facturerait une lecture Firestore à CHAQUE écriture GPS (5s) à CHAQUE visiteur
// qui garde la page ouverte, un coût qui grandit sans plafond avec l'audience.
// On interroge donc juste périodiquement (getDoc) : 1 lecture par intervalle et
// par visiteur, quel que soit le rythme réel du GPS.
let _marker = null;

async function poll() {
  const db = getDb();
  const { collection, document: docId } = CONFIG.livePosition;

  try {
    const snap = await getDoc(doc(db, collection, docId));
    const data = snap.data();
    if (!data || typeof data.lat !== "number" || typeof data.lng !== "number") return;

    const latlng = [data.lat, data.lng];
    if (_marker) {
      _marker.setLatLng(latlng);
    } else {
      _marker = L.circleMarker(latlng, CONFIG.livePosition.style).addTo(getMap());
    }
  } catch (err) {
    console.warn("[live-position] lecture position impossible :", err.message);
  }
}

export function initLivePosition() {
  poll();
  setInterval(poll, CONFIG.livePosition.pollIntervalMs);
}
