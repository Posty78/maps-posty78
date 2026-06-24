```javascript
import { db } from "./firebase.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const map = L.map("map").setView([46.6,2.2],6);

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom:19,
        attribution:"© OpenStreetMap"
    }
).addTo(map);

const snap = await getDoc(doc(db,"project","status"));

if(snap.exists()){

    const current = snap.data().currentMcdo;

    document.getElementById("progress").innerHTML =
        current +
        " / 1500<br>" +
        ((current/1500)*100).toFixed(1) +
        " %";

}
```
