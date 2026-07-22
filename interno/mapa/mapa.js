// app.js — Mapa de lugares visitados (Argentina)
// Mismo patrón que cuentacorriente/app.js: solo Firebase, sin localStorage.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

/* =========================
   FIREBASE INIT (mismo proyecto que cuentacorriente)
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyAuIf3Hv2ymT4AP3tdg2IOIEnTaYUez7eU",
  authDomain: "cuenta-c-bertinelli-lin.firebaseapp.com",
  projectId: "cuenta-c-bertinelli-lin",
  messagingSenderId: "456522423280",
  appId: "1:456522423280:web:e26a3ad2c45d27117f9b35"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const EDITOR_UID = "uQ3bumEGUFWBaPC28M5BxZVWaqn2";
const MAP_REF = doc(db, "interno", "mapa");

/* =========================
   GLOBALS
========================= */
const $ = (id) => document.getElementById(id);

let canWrite = false;
let currentUid = null;

let currentLevel = "departamentos"; // "departamentos" | "municipios"
const datasets = { departamentos: null, municipios: null }; // geojson cache
const visited = { departamentos: {}, municipios: {} }; // ids -> true

const LEVEL_LABEL = { departamentos: "departamentos", municipios: "municipios" };

/* =========================
   PROYECCIÓN (equirectangular simple, sin librerías externas)
========================= */
function project(features, width, height, padding = 16) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  features.forEach((f) => {
    const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    rings.forEach((poly) => poly.forEach((ring) => ring.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    })));
  });
  const scaleX = (width - padding * 2) / (maxX - minX);
  const scaleY = (height - padding * 2) / (maxY - minY);
  const scale = Math.min(scaleX, scaleY);
  return (pt) => {
    const x = (pt[0] - minX) * scale + padding;
    const y = height - ((pt[1] - minY) * scale + padding);
    return [x, y];
  };
}

function ringToPath(ring, proj) {
  return ring.map((pt, i) => {
    const [x, y] = proj(pt);
    return (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ") + " Z";
}

function featureToPathD(feature, proj) {
  const rings = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return rings.map((poly) => poly.map((ring) => ringToPath(ring, proj)).join(" ")).join(" ");
}

/* =========================
   DATA LOADING
========================= */
async function loadDataset(level) {
  if (datasets[level]) return datasets[level];
  const res = await fetch(`./data/${level}.json`);
  const geo = await res.json();
  datasets[level] = geo;
  return geo;
}

/* =========================
   RENDER
========================= */
async function renderLevel(level) {
  currentLevel = level;
  $("btnDepartamentos").classList.toggle("primary", level === "departamentos");
  $("btnMunicipios").classList.toggle("primary", level === "municipios");
  $("contadorExtra").textContent = "Cargando datos…";

  const geo = await loadDataset(level);
  const svg = $("map");
  svg.innerHTML = "";

  const [, , vbW, vbH] = svg.getAttribute("viewBox").split(" ").map(Number);
  const proj = project(geo.features, vbW, vbH);

  geo.features.forEach((f) => {
    const id = f.properties.id;
    const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathEl.setAttribute("d", featureToPathD(f, proj));
    pathEl.setAttribute("fill", visited[level][id] ? "var(--visited)" : "rgba(255,255,255,.05)");
    pathEl.setAttribute("stroke", "rgba(255,255,255,.15)");
    pathEl.setAttribute("stroke-width", "0.6");

    pathEl.addEventListener("mouseenter", () => {
      pathEl.setAttribute("stroke", "rgba(255,255,255,.5)");
      pathEl.setAttribute("stroke-width", "1.4");
      $("tooltip").textContent = `${f.properties.n} (${f.properties.p})`;
    });
    pathEl.addEventListener("mouseleave", () => {
      pathEl.setAttribute("stroke", "rgba(255,255,255,.15)");
      pathEl.setAttribute("stroke-width", "0.6");
    });
    pathEl.addEventListener("click", () => toggleVisited(level, id));

    svg.appendChild(pathEl);
  });

  updateCounter(geo.features.length);
}

function updateCounter(total) {
  const count = Object.values(visited[currentLevel]).filter(Boolean).length;
  $("contador").textContent = `${count} de ${total}`;
  $("contadorExtra").textContent = canWrite
    ? `${LEVEL_LABEL[currentLevel]} visitados — hacé click en el mapa para marcar`
    : `${LEVEL_LABEL[currentLevel]} visitados — inicio de sesión requerido para editar`;
}

/* =========================
   FIRESTORE
========================= */
async function toggleVisited(level, id) {
  if (!canWrite) {
    alert("Necesitás iniciar sesión como editor para marcar lugares.");
    return;
  }
  const newVal = !visited[level][id];
  visited[level][id] = newVal;
  renderLevel(currentLevel); // repinta con el estado local (respuesta inmediata)

  try {
    if (auth.currentUser) await auth.currentUser.getIdToken(true);
    await updateDoc(MAP_REF, { [`${level}.${id}`]: newVal });
  } catch (e) {
    console.error("No se pudo guardar en Firestore:", e);
    // revertimos si falló el guardado
    visited[level][id] = !newVal;
    renderLevel(currentLevel);
    alert("No se pudo guardar el cambio. Revisá tu conexión o permisos.");
  }
}

async function ensureDocExists() {
  const snap = await getDoc(MAP_REF);
  if (!snap.exists()) {
    await setDoc(MAP_REF, { departamentos: {}, municipios: {} }, { merge: true });
  }
}

function bindRealtime() {
  onSnapshot(MAP_REF, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    visited.departamentos = data.departamentos || {};
    visited.municipios = data.municipios || {};
    if (datasets[currentLevel]) {
      updateCounter(datasets[currentLevel].features.length);
      // repintar colores sin reconstruir todo el SVG
      const svg = $("map");
      const geo = datasets[currentLevel];
      Array.from(svg.children).forEach((pathEl, i) => {
        const id = geo.features[i]?.properties?.id;
        if (id) pathEl.setAttribute("fill", visited[currentLevel][id] ? "var(--visited)" : "rgba(255,255,255,.05)");
      });
    }
  });
}

/* =========================
   ESTADO DE SESIÓN (solo lectura acá; el login vive en /interno/)
========================= */

/* =========================
   INIT
========================= */
$("btnDepartamentos").onclick = () => renderLevel("departamentos");
$("btnMunicipios").onclick = () => renderLevel("municipios");

onAuthStateChanged(auth, async (user) => {
  const statusPill = $("statusPill");

  currentUid = user ? user.uid : null;
  const isEditor = !!user && user.uid === EDITOR_UID;
  canWrite = isEditor;

  if (statusPill) {
    if (isEditor) {
      statusPill.textContent = "Modo editor habilitado";
    } else if (user) {
      statusPill.textContent = "Sesión iniciada (solo lectura)";
    } else {
      statusPill.textContent = "Solo lectura — iniciá sesión en /interno/ para editar";
    }
  }

  try {
    await ensureDocExists();
  } catch (e) {
    console.error("No se pudo verificar el documento de Firestore:", e);
  }

  bindRealtime();
  renderLevel(currentLevel);
});
