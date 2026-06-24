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

    const value = snapshot.data()?.[field] ?? 0;

    window.dispatchEvent(
      new CustomEvent("mcdo:update", { detail: { currentMcdo: value } })
    );
  });
}

export function getDb() {
  return _db;
}