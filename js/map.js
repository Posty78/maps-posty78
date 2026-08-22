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

  // Leaflet mesure la taille du conteneur a l'initialisation et la garde en
  // cache. Si cette mesure est prise trop tot (loader encore visible, mise en
  // page pas totalement stable), elle reste figee a une valeur perimee/nulle
  // et casse tout calcul de projection ensuite (flyTo part n'importe ou ou
  // plante avec "Invalid LatLng object: NaN, NaN"). On la recale a chaque
  // vrai changement de taille du conteneur, pas seulement au demarrage.
  new ResizeObserver(() => _map.invalidateSize())
    .observe(document.getElementById(elementId));

  return _map;
}

export function getMap() {
  if (!_map) throw new Error("[map] getMap() appelé avant initMap().");
  return _map;
}

export function flyTo(latlng, zoom = 13) {
  _map.flyTo(latlng, zoom, { duration: 1.2 });
}