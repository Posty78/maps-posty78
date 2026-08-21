const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const MCDO_GEOJSON_URL = "https://maps.posty78.fr/assets/mcdo_1500_points.geojson";
const PERIMETER_METERS = 200;
const DWELL_MS = 2 * 60 * 1000; // 2 min de présence avant de valider l'entrée dans la zone
const TOTAL_MCDO = 1500;

// Filtre le bruit GPS pour le calcul de rythme : sous ce seuil, un déplacement est
// considéré comme du jitter (véhicule à l'arrêt), pas un vrai mouvement.
const MIN_MOVEMENT_METERS = 5;
// Au-delà, une vitesse instantanée implicite est jugée aberrante (glitch GPS) et ignorée.
const MAX_PLAUSIBLE_KMH = 200;
// Demi-vie de la moyenne mobile exponentielle du rythme (km/jour lissé).
const PACE_HALF_LIFE_MINUTES = 20;

let pointsByOrdreCache = null;

async function getPointsByOrdre() {
  if (pointsByOrdreCache) return pointsByOrdreCache;

  const res = await fetch(MCDO_GEOJSON_URL);
  const data = await res.json();

  const map = new Map();
  for (const feature of data.features) {
    const ordre = feature.properties?.ordre;
    const [lng, lat] = feature.geometry.coordinates;
    map.set(ordre, { lat, lng, cumulKm: feature.properties?.cumul_km ?? null });
  }
  pointsByOrdreCache = map;
  return map;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Met à jour le rythme lissé (km/jour) à partir du déplacement GPS brut, indépendamment
// de toute validation de McDo : dès que le véhicule bouge de quelques mètres, le rythme
// commence à se calculer (permet de tester en roulant 5 min sans attendre un vrai arrêt).
function updatePace(statusData, position, now) {
  const last = statusData.lastPacePosition;

  if (!last) {
    return {
      lastPacePosition: { lat: position.lat, lng: position.lng, timestamp: now },
      smoothedPaceKmPerDay: statusData.smoothedPaceKmPerDay ?? null,
    };
  }

  const distanceMeters = haversineMeters(last, position);
  if (distanceMeters < MIN_MOVEMENT_METERS) {
    // Bruit GPS / véhicule à l'arrêt : on ne bouge pas la référence, la fenêtre de
    // mesure s'étend simplement jusqu'au prochain vrai mouvement.
    return {};
  }

  const elapsedMs = now - last.timestamp;
  const elapsedHours = elapsedMs / 3_600_000;
  if (elapsedHours <= 0) return {};

  const impliedKmh = (distanceMeters / 1000) / elapsedHours;
  if (impliedKmh > MAX_PLAUSIBLE_KMH) {
    // Glitch GPS (saut improbable) : on ignore cet échantillon sans casser la référence.
    return {};
  }

  const instantaneousPaceKmPerDay = impliedKmh * 24;
  const previous = statusData.smoothedPaceKmPerDay;

  let smoothed;
  if (typeof previous !== "number") {
    smoothed = instantaneousPaceKmPerDay; // premier échantillon réel : effet immédiat
  } else {
    const elapsedMinutes = elapsedMs / 60_000;
    const alpha = 1 - Math.exp((-elapsedMinutes / PACE_HALF_LIFE_MINUTES) * Math.LN2);
    smoothed = alpha * instantaneousPaceKmPerDay + (1 - alpha) * previous;
  }

  return {
    lastPacePosition: { lat: position.lat, lng: position.lng, timestamp: now },
    smoothedPaceKmPerDay: smoothed,
  };
}

// Se déclenche à chaque écriture de position par l'APK de tracking.
// 1) Met à jour le rythme réel lissé (indépendant des validations de McDo).
// 2) Fait évoluer project/status.currentMcdo (le même champ que l'admin modifie
//    aujourd'hui à la main) : entrée dans les 200m + 2 min de présence -> "en cours",
//    sortie de la zone -> validé, currentMcdo += 1.
exports.checkMcdoPerimeter = onDocumentWritten(
  { document: "tracking/live", region: "europe-west1" },
  async (event) => {
    const position = event.data?.after?.data();
    if (!position || typeof position.lat !== "number" || typeof position.lng !== "number") {
      return;
    }

    const now = Date.now();
    const statusRef = db.collection("project").doc("status");
    const statusSnap = await statusRef.get();
    const statusData = statusSnap.data() || {};

    const update = updatePace(statusData, position, now);

    const currentMcdo = statusData.currentMcdo ?? 1;
    if (currentMcdo >= TOTAL_MCDO) {
      if (Object.keys(update).length) await statusRef.set(update, { merge: true });
      return;
    }

    const pointsByOrdre = await getPointsByOrdre();
    const targetPoint = pointsByOrdre.get(currentMcdo);
    if (!targetPoint) {
      if (Object.keys(update).length) await statusRef.set(update, { merge: true });
      return;
    }

    const distance = haversineMeters({ lat: position.lat, lng: position.lng }, targetPoint);
    const inProgress = statusData.currentMcdoInProgress ?? false;
    const candidateEnteredAt = statusData.currentMcdoCandidateEnteredAt ?? null;

    if (distance <= PERIMETER_METERS) {
      if (!inProgress) {
        if (!candidateEnteredAt) {
          update.currentMcdoCandidateEnteredAt = now;
        } else if (now - candidateEnteredAt >= DWELL_MS) {
          update.currentMcdoInProgress = true;
        }
      }
    } else {
      if (inProgress) {
        update.currentMcdo = Math.min(TOTAL_MCDO, currentMcdo + 1);
        update.currentMcdoInProgress = false;
        update.currentMcdoCandidateEnteredAt = null;
      } else if (candidateEnteredAt) {
        // Sorti de la zone avant d'avoir rempli le temps de présence minimum : pas un vrai arrêt.
        update.currentMcdoCandidateEnteredAt = null;
      }
    }

    if (Object.keys(update).length) {
      await statusRef.set(update, { merge: true });
    }
  }
);
