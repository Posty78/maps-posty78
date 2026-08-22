import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let _db    = null;
let _unsub = null;

export function initFirebase(firebaseConfig) {
  const app = initializeApp(firebaseConfig);
  _db = getFirestore(app);
}

export function startRealtimeListener(firestoreConfig) {
  if (!_db) {
    console.error("[firebase] initFirebase() doit être appelé avant startRealtimeListener().");
    return;
  }

  if (_unsub) _unsub();

  const { collection, document: docId, field } = firestoreConfig;
  const ref = doc(_db, collection, docId);

  _unsub = onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      console.warn("[firebase] Document introuvable :", collection, docId);
      return;
    }

    const data = snapshot.data();
    const value = data?.[field] ?? 0;
    const inProgress = data?.currentMcdoInProgress ?? false;
    const smoothedPaceKmPerDay = typeof data?.smoothedPaceKmPerDay === "number" ? data.smoothedPaceKmPerDay : null;
    const realDistanceKm = typeof data?.realDistanceKm === "number" ? data.realDistanceKm : null;

    window.dispatchEvent(
      new CustomEvent("mcdo:update", {
        detail: { currentMcdo: value, currentMcdoInProgress: inProgress, smoothedPaceKmPerDay, realDistanceKm },
      })
    );
  });
}

export function getDb() {
  return _db;
}