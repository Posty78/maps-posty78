const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const MCDO_GEOJSON_URL = "https://maps.posty78.fr/assets/mcdo_1500_points.geojson";
const PERIMETER_METERS = 3000;
const TOTAL_MCDO = 1500;

let pointsByOrdreCache = null;

async function getPointsByOrdre() {
  if (pointsByOrdreCache) return pointsByOrdreCache;

  const res = await fetch(MCDO_GEOJSON_URL);
  const data = await res.json();

  const map = new Map();
  for (const feature of data.features) {
    const ordre = feature.properties?.ordre;
    const [lng, lat] = feature.geometry.coordinates;
    map.set(ordre, { lat, lng });
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

// Se déclenche à chaque écriture de position par l'APK de tracking.
// Fait évoluer automatiquement project/status.currentMcdo (le même champ que l'admin
// modifie aujourd'hui à la main) selon la distance au McDo actuellement "en cours" :
// entrée dans les 3km -> currentMcdoInProgress = true, sortie -> currentMcdo += 1.
exports.checkMcdoPerimeter = onDocumentWritten(
  { document: "tracking/live", region: "europe-west1" },
  async (event) => {
    const position = event.data?.after?.data();
    if (!position || typeof position.lat !== "number" || typeof position.lng !== "number") {
      return;
    }

    const statusRef = db.collection("project").doc("status");
    const statusSnap = await statusRef.get();
    const statusData = statusSnap.data() || {};

    const currentMcdo = statusData.currentMcdo ?? 1;
    const inProgress = statusData.currentMcdoInProgress ?? false;

    if (currentMcdo >= TOTAL_MCDO) return;

    const pointsByOrdre = await getPointsByOrdre();
    const targetPoint = pointsByOrdre.get(currentMcdo);
    if (!targetPoint) return;

    const distance = haversineMeters(
      { lat: position.lat, lng: position.lng },
      targetPoint
    );

    if (distance <= PERIMETER_METERS && !inProgress) {
      await statusRef.set({ currentMcdoInProgress: true }, { merge: true });
    } else if (distance > PERIMETER_METERS && inProgress) {
      await statusRef.set(
        {
          currentMcdo: Math.min(TOTAL_MCDO, currentMcdo + 1),
          currentMcdoInProgress: false,
        },
        { merge: true }
      );
    }
  }
);
