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
      const index = parseInt(id.replace("MC", ""), 10);
      const color = getMarkerColor(index, currentMcdo);
      const icon  = createMarkerIcon(color, index === currentMcdo);

      const marker = L.marker(latlng, { icon });

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

  _markerIndex.forEach(({ marker, index }) => {
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