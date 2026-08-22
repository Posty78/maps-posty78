import { getDb } from "./firebase.js?v=2";
import { doc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getMap } from "./map.js?v=2";
import { CONFIG } from "./config.js?v=3";

// Point bleu "position actuelle" sur la grosse carte, comme sur la mini map de
// l'overlay - même doc source (tracking/live, écrit par l'APK toutes les 5s).
let _marker = null;

export function initLivePosition() {
  const db = getDb();
  const { collection, document: docId, style } = CONFIG.livePosition;
  const ref = doc(db, collection, docId);

  onSnapshot(
    ref,
    (snapshot) => {
      const data = snapshot.data();
      if (!data || typeof data.lat !== "number" || typeof data.lng !== "number") return;

      const latlng = [data.lat, data.lng];
      if (_marker) {
        _marker.setLatLng(latlng);
      } else {
        _marker = L.circleMarker(latlng, style).addTo(getMap());
      }
    },
    (err) => console.warn("[live-position] lecture position impossible :", err.message)
  );
}
