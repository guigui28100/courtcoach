// Copie les fichiers du détecteur de posture (WebAssembly) dans public/ : ils sont servis par NOTRE site (aucun service extérieur).
import { cpSync, existsSync, mkdirSync } from "node:fs";
const from = "node_modules/@mediapipe/tasks-vision/wasm", to = "public/mediapipe/wasm";
if (existsSync(from)) { mkdirSync(to, { recursive: true }); cpSync(from, to, { recursive: true }); console.log("Détecteur de posture copié dans", to); }
else console.warn("Détecteur de posture introuvable (npm install ?) : le suivi automatique sera indisponible.");
