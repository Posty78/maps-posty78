import { openPopup } from './popup.js';

export function initUI({ map, layerParcours, layerMacdo }) {

  /* ── Boutons Afficher/Masquer ─────────────────────────────── */
  const btnParcours = document.getElementById('btn-parcours');
  const btnMacdo    = document.getElementById('btn-mcdo');

  btnParcours.addEventListener('click', () => {
    const visible = map.hasLayer(layerParcours);
    visible ? map.removeLayer(layerParcours) : map.addLayer(layerParcours);
    btnParcours.classList.toggle('is-active', !visible);
  });

  btnMacdo.addEventListener('click', () => {
    const visible = map.hasLayer(layerMacdo);
    visible ? map.removeLayer(layerMacdo) : map.addLayer(layerMacdo);
    btnMacdo.classList.toggle('is-active', !visible);
  });

  /* ── Bouton recherche ─────────────────────────────────────── */
  const btnSearch   = document.getElementById('btn-search');
  const searchPanel = document.getElementById('search-panel');

  btnSearch.addEventListener('click', () => {
    const isOpen = searchPanel.classList.toggle('is-open');
    btnSearch.setAttribute('aria-expanded', isOpen);
    if (isOpen) {
      document.getElementById('search-input')?.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (
      searchPanel.classList.contains('is-open') &&
      !searchPanel.contains(e.target) &&
      !btnSearch.contains(e.target)
    ) {
      searchPanel.classList.remove('is-open');
      btnSearch.setAttribute('aria-expanded', 'false');
    }
  });
}