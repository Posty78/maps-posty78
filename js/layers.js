import { getMap }     from "./map.js?v=2";
import { buildPopup } from "./popup.js?v=2";
import { CONFIG }     from "./config.js?v=2";

let _mcdoLayer     = null;
let _mcdoCluster   = null;
let _mcdoSpecial   = null;
let _parcoursLayer = null;
let _parcoursTraveled = null;
let _parcoursUpcoming = null;
let _parcoursCoords   = [];
let _mcdoVisible     = false;
let _parcoursVisible = false;

const _markerIndex = new Map();
let _rawFeatures = [];

function getMarkerColor(markerIndex, currentMcdo) {
  if (markerIndex < currentMcdo)   return CONFIG.markerColors.visited;
  if (markerIndex === currentMcdo) return CONFIG.markerColors.current;
  return CONFIG.markerColors.future;
}

function createMarkerIcon(color, isCurrent = false, inProgress = false) {
  const size = isCurrent ? 22 : 12;

  if (isCurrent) {
    // Orange quand la position GPS est entrée dans le rayon de 3km ("en cours"),
    // rouge tant que le point n'a pas encore été atteint.
    const pulseColor = inProgress ? "#f97316" : "#ef4444";
    return L.divIcon({
      className: "",
      html: `
        <div style="position:relative; width:40px; height:40px; transform:translate(-10px,-10px);">
          <div style="
            position:absolute;
            top:50%; left:50%;
            transform:translate(-50%,-50%);
            width:40px; height:40px;
            border-radius:50%;
            background:${pulseColor}4d;
            animation: pulseRing 1.5s ease-out infinite;
          "></div>
          <div style="
            position:absolute;
            top:50%; left:50%;
            transform:translate(-50%,-50%);
            width:20px; height:20px;
            border-radius:50%;
            background:${pulseColor};
            border:2px solid white;
            box-shadow: 0 0 10px ${pulseColor};
          "></div>
        </div>
        <style>
          @keyframes pulseRing {
            0%   { transform:translate(-50%,-50%) scale(0.5); opacity:1; }
            100% { transform:translate(-50%,-50%) scale(2);   opacity:0; }
          }
        </style>
      `,
      iconSize:   [40, 40],
      iconAnchor: [10, 10],
    });
  }

  // Pas de filtre drop-shadow ici (coûteux à répéter sur ~1500 marqueurs) : le
  // contour blanc suffit à distinguer le point du fond de carte.
  return L.divIcon({
    className: "",
    html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
             xmlns="http://www.w3.org/2000/svg">
             <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}"
               fill="${color}" stroke="rgba(255,255,255,0.9)" stroke-width="1.5"/>
           </svg>`,
    iconSize:   [size, size],
    iconAnchor: [size/2, size/2],
  });
}

function createClusterIcon(cluster) {
  const count = cluster.getChildCount();
  const size  = count < 10 ? 32 : count < 100 ? 40 : 48;
  const fontSize = count < 100 ? 13 : 11;
  return L.divIcon({
    className: "",
    html: `<div style="
        width:${size}px; height:${size}px;
        background: rgba(0,204,68,0.88);
        border: 2px solid #ffffff;
        border-radius: 50%;
        display:flex; align-items:center; justify-content:center;
        color:#031a0a; font-weight:800; font-family:'Inter',sans-serif;
        font-size:${fontSize}px;
      ">${count}</div>`,
    iconSize: [size, size],
  });
}

function createSpecialIcon(emoji, color, label) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
      ">
        <div style="
          background: ${color};
          border: 2px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="transform: rotate(45deg); font-size: 18px; line-height:1;">${emoji}</span>
        </div>
        <div style="
          background: ${color};
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          margin-top: 2px;
          white-space: nowrap;
          font-family: Inter, sans-serif;
          letter-spacing: 0.05em;
        ">${label}</div>
      </div>
    `,
    iconSize:   [60, 56],
    iconAnchor: [18, 54],
  });
}

export async function loadLayers(currentMcdo, currentMcdoInProgress = false) {
  const [pointsData, parcoursData] = await Promise.all([
    fetch(CONFIG.geojson.points).then((r) => r.json()),
    fetch(CONFIG.geojson.parcours).then((r) => r.json()),
  ]);

  _rawFeatures = pointsData.features.map((f) => ({
    id: f.properties?.id,
    properties: f.properties,
  }));

  _buildMcdoLayer(pointsData, currentMcdo, currentMcdoInProgress);
  _buildParcoursLayer(parcoursData, currentMcdo);
}

function _buildMcdoLayer(geojsonData, currentMcdo, currentMcdoInProgress = false) {
  _markerIndex.clear();

  // Départ et arrivée restent toujours visibles individuellement (jamais regroupés
  // dans une bulle), tout le reste (~1498 points) va dans le groupe de clusters :
  // avec 1500 marqueurs DOM individuels, le premier chargement de la carte devenait
  // lent (creation DOM + rendu), surtout sur mobile.
  _mcdoLayer = L.geoJSON(geojsonData, {
    pointToLayer(feature, latlng) {
      const id    = feature.properties?.id ?? "";
      const ordre = feature.properties?.ordre ?? 0;
      const index = parseInt(id.replace("MC", ""), 10);
      const color = getMarkerColor(index, currentMcdo);

      let icon;
      if (ordre === 1) {
        icon = createSpecialIcon("🏁", "#22c55e", "DÉPART");
      } else if (ordre === 1500) {
        icon = createSpecialIcon("🏆", "#ef4444", "ARRIVÉE");
      } else {
        icon = createMarkerIcon(color, index === currentMcdo, index === currentMcdo && currentMcdoInProgress);
      }

      const marker = L.marker(latlng, {
        icon,
        zIndexOffset: ordre === 1 || ordre === 1500 ? 1000 : index === currentMcdo ? 500 : 0
      });

      _markerIndex.set(id, { marker, index });
      return marker;
    },

    onEachFeature(feature, layer) {
      layer.on("click", () => {
        buildPopup(layer, feature.properties);
      });
    },
  });

  _mcdoCluster = L.markerClusterGroup({
    iconCreateFunction: createClusterIcon,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    maxClusterRadius: 70,
  });

  const specialMarkers = [];
  _mcdoLayer.eachLayer((marker) => {
    const ordre = marker.feature?.properties?.ordre ?? 0;
    if (ordre === 1 || ordre === 1500) {
      specialMarkers.push(marker);
    } else {
      _mcdoCluster.addLayer(marker);
    }
  });
  _mcdoSpecial = L.layerGroup(specialMarkers);
}

function _buildParcoursLayer(geojsonData, currentMcdo) {
  const feature = geojsonData.features[0];
  // Coordonnées GeoJSON en [lng, lat] -> Leaflet attend [lat, lng]
  _parcoursCoords = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

  const splitIndex = _splitIndexFor(currentMcdo);

  _parcoursTraveled = L.polyline(_parcoursCoords.slice(0, splitIndex + 1), CONFIG.parcoursStyle.traveled);
  _parcoursUpcoming = L.polyline(_parcoursCoords.slice(splitIndex), CONFIG.parcoursStyle.upcoming);

  _parcoursLayer = L.layerGroup([_parcoursUpcoming, _parcoursTraveled]);
}

// L'index 0 du tracé correspond au départ (MC0001), donc index de coupure = currentMcdo
function _splitIndexFor(currentMcdo) {
  const max = _parcoursCoords.length - 1;
  return Math.max(0, Math.min(currentMcdo, max));
}

export function updateParcoursColors(currentMcdo) {
  if (!_parcoursTraveled || !_parcoursUpcoming || !_parcoursCoords.length) return;
  const splitIndex = _splitIndexFor(currentMcdo);
  _parcoursTraveled.setLatLngs(_parcoursCoords.slice(0, splitIndex + 1));
  _parcoursUpcoming.setLatLngs(_parcoursCoords.slice(splitIndex));
}

export function toggleMcdo() {
  const map = getMap();
  if (_mcdoVisible) {
    map.removeLayer(_mcdoCluster);
    map.removeLayer(_mcdoSpecial);
  } else {
    map.addLayer(_mcdoCluster);
    map.addLayer(_mcdoSpecial);
  }
  _mcdoVisible = !_mcdoVisible;
  return _mcdoVisible;
}

export function toggleParcours() {
  const map = getMap();
  if (_parcoursVisible) {
    map.removeLayer(_parcoursLayer);
  } else {
    map.addLayer(_parcoursLayer);
  }
  _parcoursVisible = !_parcoursVisible;
  return _parcoursVisible;
}

export function isMcdoVisible()     { return _mcdoVisible; }
export function isParcoursVisible() { return _parcoursVisible; }

export function updateMarkerColors(currentMcdo, currentMcdoInProgress = false) {
  if (!_mcdoLayer) return;

  _markerIndex.forEach(({ marker, index }, id) => {
    if (index === 1 || index === 1500) return;
    const color = getMarkerColor(index, currentMcdo);
    const icon  = createMarkerIcon(color, index === currentMcdo, index === currentMcdo && currentMcdoInProgress);
    marker.setIcon(icon);
  });
}

export function getAllMcdoFeatures() {
  if (!_mcdoLayer) return [];
  const features = [];
  _mcdoLayer.eachLayer((layer) => {
    features.push({
      id:         layer.feature?.properties?.id,
      latlng:     layer.getLatLng(),
      properties: layer.feature?.properties,
      layer,
    });
  });
  return features;
}

export function getRawFeatures() {
  return _rawFeatures;
}