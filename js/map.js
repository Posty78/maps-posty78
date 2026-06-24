let _map = null;

export function initMap(elementId, mapConfig) {
  _map = L.map(elementId, {
    center:             mapConfig.center,
    zoom:               mapConfig.zoom,
    minZoom:            mapConfig.minZoom,
    maxZoom:            mapConfig.maxZoom,
    zoomControl:        false,
    attributionControl: false,
  });

  L.tileLayer(mapConfig.tileUrl, {
    attribution: mapConfig.tileAttribution,
    subdomains:  "abcd",
    maxZoom:     mapConfig.maxZoom,
  }).addTo(_map);

  L.control.zoom({ position: "bottomright" }).addTo(_map);

  L.control.attribution({ position: "bottomleft", prefix: false })
    .addTo(_map)
    .setPrefix(mapConfig.tileAttribution);

  return _map;
}

export function getMap() {
  if (!_map) throw new Error("[map] getMap() appelé avant initMap().");
  return _map;
}

export function flyTo(latlng, zoom = 13) {
  _map.flyTo(latlng, zoom, { duration: 1.2 });
}