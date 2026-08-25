export const CONFIG = {

  firebase: {
    apiKey:            "AIzaSyAMpcR8oV6kCDPHwoPiCZky8JriA9TiRuc",
    authDomain:        "posty78-maps.firebaseapp.com",
    projectId:         "posty78-maps",
    storageBucket:     "posty78-maps.firebasestorage.app",
    messagingSenderId: "264681377127",
    appId:             "1:264681377127:web:59cc8c638a03c0ef9cb3c2",
  },

  firestore: {
    collection: "project",
    document:   "status",
    field:      "currentMcdo",
  },

  totalMcdo: 1500,

  geojson: {
    points:  "./assets/mcdo_1500_points.geojson?v=8",
    parcours:"./assets/mcdo_1500_parcours.geojson?v=4",
  },

  map: {
    center:  [46.6034, 1.8883],
    zoom:    6,
    minZoom: 5,
    maxZoom: 19,
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileAttribution: "",
  },

  markerColors: {
    visited: "#22c55e",
    current: "#ef4444",
    future:  "#3b82f6",
  },

  parcoursStyle: {
    traveled: {
      color:   "#ff1a1a",
      weight:  3,
      opacity: 0.9,
    },
    upcoming: {
      color:   "#1e3a5f",
      weight:  2.5,
      opacity: 0.85,
    },
  },

  livePosition: {
    collection: "tracking",
    document: "live",
    // Interroge la position toutes les 20s au lieu d'un listener temps réel (5s,
    // le rythme d'écriture de l'APK) : sur un site avec audience, un listener
    // temps réel facture une lecture Firestore à CHAQUE mise à jour à CHAQUE
    // visiteur qui garde la page ouverte - un simple poll plafonne ce coût à un
    // niveau fixe par visiteur, indépendant du rythme réel du GPS.
    pollIntervalMs: 20_000,
    style: {
      radius: 8,
      color: "#ffffff",
      weight: 3,
      fillColor: "#00cc44",
      fillOpacity: 1,
      className: "live-position-marker",
    },
  },

  history: {
    collection: "tracking_history",
    // Doit rester identique à TOUR_START_MS / WEEK_MS dans functions/index.js.
    tourStartMs: Date.UTC(2026, 8, 1),
    weekMs: 7 * 24 * 60 * 60 * 1000,
    style: {
      color:   "#3b0764",
      weight:  3,
      opacity: 0.95,
    },
  },

  search: {
    maxResults:      10,
    nominatimUrl:    "https://nominatim.openstreetmap.org/search",
    nominatimParams: "format=json&countrycodes=fr&limit=1",
  },

  admin: {
    password: "[PASSWORD_REDACTED]",
  },

};

Object.freeze(CONFIG);