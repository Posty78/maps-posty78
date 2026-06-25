import { getMap }     from "./map.js";
import { buildPopup } from "./popup.js";
import { CONFIG }     from "./config.js";

let _mcdoLayer     = null;
let _parcoursLayer = null;
let _mcdoVisible     = false;
let _parcoursVisible = false;

const _markerIndex = new Map();

function getMarkerColor(markerIndex, currentMcdo) {
  if (markerIndex < currentMcdo)   return CONFIG.markerColors.visited;
  if (markerIndex === currentMcdo) return CONFIG.markerColors.current;
  return CONFIG.markerColors.future;
}

function createMarkerIcon(color, isCurrent = false) {
  const size   = isCurrent ? 14 : 8;
  const shadow = isCurrent
    ? `drop-shadow(0 0 6px ${color})`
    : `drop-shadow(0 0 2px rgba(0,0,0,0.6))`;

  return L.divIcon({
    className: "",
    html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
             xmlns="http://www.w3.org/2000/svg" style="filter:${shadow}">
             <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"
               fill="${color}" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
           </svg>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
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

export async function loadLayers(currentMcdo) {
  const [pointsData, parcoursData] = await Promise.all([
    fetch(CONFIG.geojson.points).then((r) => r.json()),
    fetch(CONFIG.geojson.parcours).then((r) => r.json()),
  ]);

  _buildMcdoLayer(pointsData, currentMcdo);
  _buildParcoursLayer(parcoursData);
}

function _buildMcdoLayer(geojsonData, currentMcdo) {
  _markerIndex.clear();

  _mcdoLayer = L.geoJSON(geojsonData, {
    pointToLayer(feature, latlng) {
      const id    = feature.properties?.id ?? "";
      const ordre = feature.properties?.ordre ?? 0;
      const index = parseInt(id.replace("MC", ""), 10);
      const color = getMarkerColor(index, currentMcdo);

      // Icône spéciale pour départ et arrivée
      let icon;
      if (ordre === 1) {
        icon = createSpecialIcon("🏁", "#22c55e", "DÉPART");
      } else if (ordre === 1500) {
        icon = createSpecialIcon("🏆", "#ef4444", "ARRIVÉE");
      } else {
        icon = createMarkerIcon(color, index === currentMcdo);
      }

      const marker = L.marker(latlng, { icon, zIndexOffset: ordre === 1 || ordre === 1500 ? 1000 : 0 });

      _markerIndex.set(id, { marker, index });

      return marker;
    },

    onEachFeature(feature, layer) {
      layer.on("click", () => {
        buildPopup(layer, feature.properties);
      });
    },
  });
}

function _buildParcoursLayer(geojsonData) {
  _parcoursLayer = L.geoJSON(geojsonData, {
    style: CONFIG.parcoursStyle,
  });
}

export function toggleMcdo() {
  const map = getMap();
  if (_mcdoVisible) {
    map.removeLayer(_mcdoLayer);
  } else {
    map.addLayer(_mcdoLayer);
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

export function updateMarkerColors(currentMcdo) {
  if (!_mcdoLayer) return;

  _markerIndex.forEach(({ marker, index }, id) => {
    // Ne pas changer les icônes spéciales départ/arrivée
    if (index === 1 || index === 1500) return;
    const color = getMarkerColor(index, currentMcdo);
    const icon  = createMarkerIcon(color, index === currentMcdo);
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