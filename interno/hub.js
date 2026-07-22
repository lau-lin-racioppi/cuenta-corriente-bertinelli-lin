// app.js — Hub de "Acceso interno"
// Login único; adentro, una lista de herramientas que se puede ir ampliando.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAuIf3Hv2ymT4AP3tdg2IOIEnTaYUez7eU",
  authDomain: "cuenta-c-bertinelli-lin.firebaseapp.com",
  projectId: "cuenta-c-bertinelli-lin",
  messagingSenderId: "456522423280",
  appId: "1:456522423280:web:e26a3ad2c45d27117f9b35"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);

/* =========================
   HERRAMIENTAS DISPONIBLES
   Para agregar una nueva: sumá un objeto acá. Nada más hay que tocar.
========================= */
const TOOLS = [
  {
    title: "Lugares visitados",
    desc: "Mapa de departamentos y municipios recorridos.",
    href: "./mapa/"
  }
];

function renderTools() {
  const grid = $("toolsGrid");
  grid.innerHTML = TOOLS.map((t) => `
    <a class="toolCard" href="${t.href}">
      <div class="ttl">${t.title}</div>
      <div class="desc">${t.desc}</div>
    </a>
  `).join("");
}

/* =========================
   LOGIN
========================= */
$("btnLogin").onclick = async () => {
  const email = $("loginEmail").value.trim();
  const pass = $("loginPass").value;
  $("loginErr").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    $("loginPass").value = "";
  } catch (e) {
    $("loginErr").textContent = "No pude iniciar sesión. Revisá email/contraseña.";
  }
};

$("btnLogout").onclick = async () => {
  await signOut(auth);
};

/* =========================
   INIT
========================= */
renderTools();

onAuthStateChanged(auth, (user) => {
  const loginCard = $("loginCard");
  const hub = $("hub");
  const whoami = $("whoami");

  if (user) {
    loginCard.classList.add("hide");
    hub.classList.remove("hide");
    whoami.textContent = user.email || "Sesión iniciada";
  } else {
    loginCard.classList.remove("hide");
    hub.classList.add("hide");
  }
});
