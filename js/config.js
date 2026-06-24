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
    points:  "./assets/mcdo_1500_points.geojson",
    parcours:"./assets/mcdo_1500_parcours.geojson",
  },

  map: {
    center:  [46.6034, 1.8883],
    zoom:    6,
    minZoom: 5,
    maxZoom: 19,
    tileUrl: "https://tile.openstreetmap.bzh/br/{z}/{x}/{y}.png",
    tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },

  markerColors: {
    visited: "#22c55e",
    current: "#ef4444",
    future:  "#3b82f6",
  },

  parcoursStyle: {
    color:   "#f59e0b",
    weight:  2.5,
    opacity: 0.75,
  },

  search: {
    maxResults:      10,
    nominatimUrl:    "https://nominatim.openstreetmap.org/search",
    nominatimParams: "format=json&countrycodes=fr&limit=1",
  },

  admin: {
    password: "mcdo1500",
  },

};

Object.freeze(CONFIG);