```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAMpcR8oV6kCDPHwoPiCZky8JriA9TiRuc",
  authDomain: "posty78-maps.firebaseapp.com",
  projectId: "posty78-maps",
  storageBucket: "posty78-maps.firebasestorage.app",
  messagingSenderId: "264681377127",
  appId: "1:264681377127:web:59cc8c638a03c0ef9cb3c2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
```
