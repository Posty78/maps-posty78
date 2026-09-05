const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

// Meme secret que celui deja stocke sur le telephone (Prefs.trackingSecret) pour
// submitTracking - reutilise tel quel pour submitSpeed, aucun changement cote app
// pour la position existante. VEHICLE_SECRET est un secret different, partage
// uniquement avec commandWebhook (posty78-overlay) pour !jauge/!essence.
const TRACKING_SECRET = defineSecret("TRACKING_SECRET");
const VEHICLE_SECRET = defineSecret("VEHICLE_SECRET");

// Comparaison en temps constant (meme raisonnement que commandWebhook cote
// posty78-overlay : evite qu'une comparaison "!==" laisse fuir, via le temps de
// reponse, le nombre de caracteres corrects d'un secret).
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Reservoir reel de la 206 1.4i 75ch (fiche constructeur) et conso fixe estimee
// pour une conduite moyenne a soutenue (~6.3L/100km constructeur, ~6-8.5L/100km
// releves reels) - volontairement une constante simple : Posty78 corrige lui-meme
// au feeling via !jauge si l'estimation derive, plutot qu'un calcul dynamique a
// partir des pleins (il fait le plein en petites quantites tres frequemment, pas
// de vrai "plein complet" a partir duquel calculer une conso reelle fiable).
const FUEL_TANK_LITERS = 50;
const FUEL_CONSUMPTION_L_PER_100KM = 6.5;
const FUEL_DEFAULT_PERCENT = 100;

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

// Historique du tracé réel : un nouveau point n'est enregistré que tous les
// BREADCRUMB_MIN_METERS parcourus (pas à chaque écriture GPS), pour garder un volume
// de stockage/lecture raisonnable sur 365 jours.
const BREADCRUMB_MIN_METERS = 75;
// Ancrage des "semaines" de sharding de l'historique (1er septembre 2026, début du tour).
const TOUR_START_MS = Date.UTC(2026, 8, 1);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function historyWeekKey(ms) {
  const index = Math.max(0, Math.floor((ms - TOUR_START_MS) / WEEK_MS));
  return `w${index}`;
}

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

  // Odomètre réel : accumule chaque déplacement valide (même filtre anti-bruit/glitch
  // que le calcul de rythme ci-dessus), indépendamment de la progression sur le tracé.
  // Alimente "Distance parcourue" sur le site une fois que de vraies positions arrivent.
  const previousDistanceKm = statusData.realDistanceKm ?? 0;
  const realDistanceKm = previousDistanceKm + distanceMeters / 1000;

  return {
    lastPacePosition: { lat: position.lat, lng: position.lng, timestamp: now },
    smoothedPaceKmPerDay: smoothed,
    realDistanceKm,
    fuelPercent: nextFuelPercent(statusData, distanceMeters),
  };
}

// Fait baisser la jauge essence en fonction de la distance reellement parcourue
// depuis le dernier point valide (meme filtre anti-bruit/glitch que l'odometre,
// vu qu'elle est calculee dans la meme fonction sur le meme distanceMeters).
// Conso fixe (voir FUEL_CONSUMPTION_L_PER_100KM) : pas de recalcul dynamique a
// partir des pleins, corrige manuellement via !jauge si besoin.
function nextFuelPercent(statusData, distanceMeters) {
  const current = typeof statusData.fuelPercent === "number" ? statusData.fuelPercent : FUEL_DEFAULT_PERCENT;
  const litersUsed = (distanceMeters / 1000) * (FUEL_CONSUMPTION_L_PER_100KM / 100);
  const percentUsed = (litersUsed / FUEL_TANK_LITERS) * 100;
  return Math.max(0, current - percentUsed);
}

// Enregistre un point du tracé réel (historique GPS) dans un doc "hebdomadaire"
// (tracking_history/w{N}) uniquement si le véhicule a parcouru au moins
// BREADCRUMB_MIN_METERS depuis le dernier point enregistré. Écrit `lastBreadcrumbPosition`
// dans `update` (fusionné avec project/status) pour se souvenir du dernier point posé.
// Retourne une Promise (résolue immédiatement si rien à écrire) à attendre par l'appelant.
function updateBreadcrumbHistory(statusData, position, now, update) {
  const last = statusData.lastBreadcrumbPosition;

  if (last) {
    const distanceMeters = haversineMeters(last, position);
    if (distanceMeters < BREADCRUMB_MIN_METERS) return Promise.resolve();
  }

  update.lastBreadcrumbPosition = { lat: position.lat, lng: position.lng };

  const weekKey = historyWeekKey(now);
  return db.collection("tracking_history").doc(weekKey).set(
    // Firestore n'autorise pas les tableaux imbriqués dans arrayUnion, d'où l'objet {lat,lng}
    // plutôt qu'une paire [lat,lng].
    { points: admin.firestore.FieldValue.arrayUnion({ lat: position.lat, lng: position.lng }) },
    { merge: true }
  );
}

// Se déclenche à chaque écriture de position par l'APK de tracking.
// 1) Met à jour le rythme réel lissé + l'odomètre réel (indépendant des validations
//    de McDo, alimente "Distance parcourue" une fois de vraies positions reçues).
// 2) Enregistre un point d'historique du tracé réel tous les BREADCRUMB_MIN_METERS.
// 3) Fait évoluer project/status.currentMcdo (le même champ que l'admin modifie
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
    const historyWrite = updateBreadcrumbHistory(statusData, position, now, update);

    const currentMcdo = statusData.currentMcdo ?? 1;
    if (currentMcdo >= TOTAL_MCDO) {
      await Promise.all([
        Object.keys(update).length ? statusRef.set(update, { merge: true }) : null,
        historyWrite,
      ]);
      return;
    }

    const pointsByOrdre = await getPointsByOrdre();
    const targetPoint = pointsByOrdre.get(currentMcdo);
    if (!targetPoint) {
      await Promise.all([
        Object.keys(update).length ? statusRef.set(update, { merge: true }) : null,
        historyWrite,
      ]);
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

    await Promise.all([
      Object.keys(update).length ? statusRef.set(update, { merge: true }) : null,
      historyWrite,
    ]);
  }
);

// Recoit la vitesse depuis l'APK de tracking (canal separe de submitTracking, a
// une cadence bien plus rapide - 1-2s au lieu de 5s). Ecrit uniquement en RTDB,
// jamais en Firestore : a cette frequence, Firestore facturerait a l'operation
// (risque reel de depasser le quota gratuit sur 15h/jour), alors que RTDB facture
// au volume de donnees, negligeable ici (quelques octets par ecriture). Meme
// principe que battery_status, deja utilise par PostyMonitor pour la batterie.
exports.submitSpeed = onRequest(
  { region: "europe-west1", secrets: [TRACKING_SECRET], cors: true, maxInstances: 5 },
  async (req, res) => {
    const providedSecret = req.get("x-tracking-secret") || "";
    if (!safeEqual(providedSecret, TRACKING_SECRET.value())) {
      res.status(403).json({ ok: false, error: "invalid secret" });
      return;
    }

    const speedKmh = parseFloat(req.body?.speedKmh);
    if (!Number.isFinite(speedKmh) || speedKmh < 0 || speedKmh > 300) {
      res.status(400).json({ ok: false, error: "invalid speedKmh" });
      return;
    }

    try {
      await rtdb.ref("vehicle_status").update({
        speedKmh,
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// Appelee par commandWebhook (posty78-overlay) pour !jauge (mode "set", valeur
// exacte en %) et !essence (mode "add", litres ajoutes - recalcule le % selon
// FUEL_TANK_LITERS). Secret dedie (VEHICLE_SECRET), different de celui de
// submitSpeed/submitTracking : cet endpoint est appele serveur-a-serveur depuis
// posty78-overlay, jamais directement par le telephone ou par Botsty78.
exports.updateFuel = onRequest(
  { region: "europe-west1", secrets: [VEHICLE_SECRET], cors: true, maxInstances: 5 },
  async (req, res) => {
    const providedSecret = req.get("x-vehicle-secret") || "";
    if (!safeEqual(providedSecret, VEHICLE_SECRET.value())) {
      res.status(403).json({ ok: false, error: "invalid secret", error_code: "invalid_secret" });
      return;
    }

    const payload = req.method === "POST" ? req.body : req.query;
    const mode = payload?.mode;
    const statusRef = db.collection("project").doc("status");

    // error_code attache directement sur l'erreur : remonte tel quel jusqu'a
    // commandWebhook (posty78-overlay), qui le fait suivre a Botsty78.
    function codedError(message, code) {
      const err = new Error(message);
      err.code = code;
      return err;
    }

    try {
      let nextPercent;
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(statusRef);
        const current = typeof snap.data()?.fuelPercent === "number" ? snap.data().fuelPercent : FUEL_DEFAULT_PERCENT;

        if (mode === "set") {
          const value = parseFloat(String(payload?.value ?? "").replace(",", "."));
          if (!Number.isFinite(value)) throw codedError("invalid value", "invalid_value");
          nextPercent = Math.max(0, Math.min(100, value));
        } else if (mode === "add") {
          const liters = parseFloat(String(payload?.liters ?? "").replace(",", "."));
          if (!Number.isFinite(liters) || liters < 0) throw codedError("invalid liters", "invalid_liters");
          const percentAdded = (liters / FUEL_TANK_LITERS) * 100;
          nextPercent = Math.max(0, Math.min(100, current + percentAdded));
        } else {
          throw codedError("invalid mode", "invalid_mode");
        }

        tx.set(statusRef, { fuelPercent: nextPercent }, { merge: true });
      });

      res.json({ ok: true, fuelPercent: nextPercent });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message, error_code: err.code || "invalid_request" });
    }
  }
);
