import { getDb } from "./firebase.js?v=2";
import { doc, getDoc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getMap } from "./map.js?v=3";
import { CONFIG } from "./config.js?v=14";

// Historique du tracé réel (position GPS parcourue) : stocké côté serveur en docs
// "hebdomadaires" (tracking_history/w{N}) pour garder un volume de lecture raisonnable
// sur 365 jours. Les semaines passées sont figées et mises en cache localStorage (jamais
// re-téléchargées) ; seule la semaine en cours est écoutée en temps réel.
const CACHE_KEY = "mcdo_history_cache_v1";

let _layer = null;
let _visible = false;
let _closedWeeksPoints = new Map();
let _currentWeekPoints = [];

function weekIndexFor(ms) {
  const { tourStartMs, weekMs } = CONFIG.history;
  return Math.max(0, Math.floor((ms - tourStartMs) / weekMs));
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota dépassé ou navigation privée : tant pis, on retentera au prochain chargement.
  }
}

function rebuildLayer() {
  const currentIndex = weekIndexFor(Date.now());
  const allPoints = [];
  for (let i = 0; i < currentIndex; i++) {
    const pts = _closedWeeksPoints.get(`w${i}`);
    if (pts) allPoints.push(...pts);
  }
  allPoints.push(..._currentWeekPoints);

  if (_layer) {
    _layer.setLatLngs(allPoints);
  } else {
    _layer = L.polyline(allPoints, CONFIG.history.style);
    if (_visible) getMap().addLayer(_layer);
  }
}

export async function initHistory(startVisible = false) {
  _visible = startVisible;
  const db = getDb();
  const { collection } = CONFIG.history;
  const currentIndex = weekIndexFor(Date.now());

  const cache = readCache();
  const toFetch = [];
  for (let i = 0; i < currentIndex; i++) {
    const key = `w${i}`;
    if (cache[key]) {
      _closedWeeksPoints.set(key, cache[key]);
    } else {
      toFetch.push(key);
    }
  }

  if (toFetch.length) {
    await Promise.all(
      toFetch.map(async (key) => {
        try {
          const snap = await getDoc(doc(db, collection, key));
          const pts = snap.exists() ? snap.data().points || [] : [];
          _closedWeeksPoints.set(key, pts);
          cache[key] = pts;
        } catch (err) {
          console.warn("[history] lecture semaine impossible :", key, err.message);
        }
      })
    );
    writeCache(cache);
  }

  rebuildLayer();

  onSnapshot(
    doc(db, collection, `w${currentIndex}`),
    (snap) => {
      _currentWeekPoints = snap.exists() ? snap.data().points || [] : [];
      rebuildLayer();
    },
    (err) => console.warn("[history] écoute semaine en cours impossible :", err.message)
  );
}

export function toggleHistory() {
  const map = getMap();
  if (!_layer) return _visible;

  if (_visible) {
    map.removeLayer(_layer);
  } else {
    map.addLayer(_layer);
  }
  _visible = !_visible;
  return _visible;
}

export function isHistoryVisible() {
  return _visible;
}
