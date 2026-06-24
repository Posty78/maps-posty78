import { searchByCoords, openSearch } from "./search.js";

export function locateUser() {
  if (!("geolocation" in navigator)) {
    alert("Votre navigateur ne supporte pas la géolocalisation.");
    return;
  }

  const btn = document.getElementById("btn-locate");
  if (btn) btn.classList.add("is-loading");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      openSearch();
      searchByCoords(latitude, longitude);
      if (btn) btn.classList.remove("is-loading");
    },
    (err) => {
      console.warn("[geolocation]", err.message);
      alert(
        err.code === 1
          ? "Permission de géolocalisation refusée."
          : "Impossible d'obtenir votre position."
      );
      if (btn) btn.classList.remove("is-loading");
    },
    {
      enableHighAccuracy: true,
      timeout:            10_000,
      maximumAge:         60_000,
    }
  );
}