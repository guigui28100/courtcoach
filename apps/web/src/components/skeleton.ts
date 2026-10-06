// Squelette du joueur : 15 points repérés sur l'image (coordonnées entre 0 et 1, par rapport à la largeur et à la hauteur de l'image),
// segments, mesures d'alignement et détection automatique. Tout se passe dans le navigateur : aucune image n'est envoyée ailleurs.
export type P = [number, number];
export const JOINTS = ["nose", "lShoulder", "rShoulder", "lElbow", "rElbow", "lWrist", "rWrist", "lHip", "rHip", "lKnee", "rKnee", "lAnkle", "rAnkle", "lFoot", "rFoot"] as const;
export type Joint = (typeof JOINTS)[number];
export type Skeleton = Record<Joint, P>;

export const JOINT_LABEL: Record<Joint, string> = {
  nose: "Tête", lShoulder: "Épaule gauche", rShoulder: "Épaule droite", lElbow: "Coude gauche", rElbow: "Coude droit", lWrist: "Poignet gauche", rWrist: "Poignet droit",
  lHip: "Hanche gauche", rHip: "Hanche droite", lKnee: "Genou gauche", rKnee: "Genou droit", lAnkle: "Cheville gauche", rAnkle: "Cheville droite", lFoot: "Pied gauche", rFoot: "Pied droit",
};
// Numéros des points dans le détecteur (33 points du corps) pour les 15 que nous gardons
const LANDMARK: Record<Joint, number> = { nose: 0, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28, lFoot: 31, rFoot: 32 };

const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export const neckOf = (s: Skeleton) => mid(s.lShoulder, s.rShoulder);
export const pelvisOf = (s: Skeleton) => mid(s.lHip, s.rHip);
export const feetOf = (s: Skeleton) => mid(s.lAnkle, s.rAnkle);

// Segments du squelette, par partie du corps (une couleur chacun)
type Seg = { from: Joint | "neck" | "pelvis"; to: Joint | "neck" | "pelvis"; color: string };
const C = { head: "#facc15", arms: "#38bdf8", trunk: "#4ade80", hips: "#fb923c", thigh: "#f472b6", calf: "#c084fc", foot: "#ffffff" };
export const SEGMENTS: Seg[] = [
  { from: "nose", to: "neck", color: C.head },
  { from: "lShoulder", to: "rShoulder", color: C.arms },
  { from: "lShoulder", to: "lElbow", color: C.arms }, { from: "lElbow", to: "lWrist", color: C.arms },
  { from: "rShoulder", to: "rElbow", color: C.arms }, { from: "rElbow", to: "rWrist", color: C.arms },
  { from: "neck", to: "pelvis", color: C.trunk },
  { from: "lHip", to: "rHip", color: C.hips },
  { from: "lHip", to: "lKnee", color: C.thigh }, { from: "rHip", to: "rKnee", color: C.thigh },
  { from: "lKnee", to: "lAnkle", color: C.calf }, { from: "rKnee", to: "rAnkle", color: C.calf },
  { from: "lAnkle", to: "lFoot", color: C.foot }, { from: "rAnkle", to: "rFoot", color: C.foot },
];
const pt = (s: Skeleton, k: Joint | "neck" | "pelvis"): P => (k === "neck" ? neckOf(s) : k === "pelvis" ? pelvisOf(s) : s[k]);

// Un squelette de départ (joueur debout, de face), à replacer à la main sur l'image
export function defaultSkeleton(): Skeleton {
  return {
    nose: [0.5, 0.2], lShoulder: [0.58, 0.31], rShoulder: [0.42, 0.31], lElbow: [0.62, 0.43], rElbow: [0.38, 0.43], lWrist: [0.63, 0.54], rWrist: [0.37, 0.54],
    lHip: [0.55, 0.55], rHip: [0.45, 0.55], lKnee: [0.56, 0.72], rKnee: [0.44, 0.72], lAnkle: [0.56, 0.9], rAnkle: [0.44, 0.9], lFoot: [0.6, 0.94], rFoot: [0.4, 0.94],
  };
}

// ---------- Mesures (en degrés) : calculées sur l'image à plat, donc indicatives (la perspective les déforme un peu) ----------
const deg = (r: number) => (r * 180) / Math.PI;
function angleAt(a: P, b: P, c: P, w: number, h: number) {
  const v1 = [(a[0] - b[0]) * w, (a[1] - b[1]) * h], v2 = [(c[0] - b[0]) * w, (c[1] - b[1]) * h];
  const n = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
  return n ? deg(Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / n)))) : 0;
}
// Inclinaison d'une ligne par rapport à l'horizontale (de -90° à 90°)
function tilt(a: P, b: P, w: number, h: number) {
  let d = deg(Math.atan2((b[1] - a[1]) * h, (b[0] - a[0]) * w));
  while (d > 90) d -= 180; while (d < -90) d += 180;
  return d;
}
export interface Measure { key: string; label: string; value: string; hint: string }
export function measures(s: Skeleton, w: number, h: number): Measure[] {
  const neck = neckOf(s), pelvis = pelvisOf(s), feet = feetOf(s);
  const trunk = Math.abs(90 - Math.abs(tilt(pelvis, neck, w, h))); // 0° = tronc bien vertical
  const sh = tilt(s.rShoulder, s.lShoulder, w, h), hp = tilt(s.rHip, s.lHip, w, h);
  const align = angleAt(s.nose, pelvis, feet, w, h);
  const f = (x: number) => `${Math.round(x)}°`;
  return [
    { key: "align", label: "Alignement tête – bassin – pieds", value: f(align), hint: "180° = tête, bassin et pieds parfaitement alignés" },
    { key: "tronc", label: "Inclinaison du tronc", value: f(trunk), hint: "0° = tronc vertical ; plus l'angle est grand, plus le joueur est penché" },
    { key: "epaules", label: "Ligne des épaules", value: f(Math.abs(sh)), hint: "0° = épaules à l'horizontale" },
    { key: "bassin", label: "Ligne du bassin", value: f(Math.abs(hp)), hint: "0° = bassin à l'horizontale" },
    { key: "ecart", label: "Écart épaules – bassin", value: f(Math.abs(sh - hp)), hint: "mesure la rotation des épaules par rapport au bassin" },
    { key: "coudeG", label: "Coude gauche", value: f(angleAt(s.lShoulder, s.lElbow, s.lWrist, w, h)), hint: "180° = bras tendu" },
    { key: "coudeD", label: "Coude droit", value: f(angleAt(s.rShoulder, s.rElbow, s.rWrist, w, h)), hint: "180° = bras tendu" },
    { key: "genouG", label: "Genou gauche", value: f(angleAt(s.lHip, s.lKnee, s.lAnkle, w, h)), hint: "180° = jambe tendue" },
    { key: "genouD", label: "Genou droit", value: f(angleAt(s.rHip, s.rKnee, s.rAnkle, w, h)), hint: "180° = jambe tendue" },
  ];
}

// ---------- Dessin ----------
// Dessine le squelette dans le rectangle (ox, oy, w, h) du canvas ; « guides » ajoute les repères d'alignement ; « labels » écrit les mesures.
export function drawSkeleton(g: CanvasRenderingContext2D, s: Skeleton, ox: number, oy: number, w: number, h: number, opts: { guides?: boolean; labels?: boolean; active?: Joint | null } = {}) {
  const X = (p: P) => ox + p[0] * w, Y = (p: P) => oy + p[1] * h;
  const lw = Math.max(3, Math.min(w, h) / 160), r = lw * 1.9;
  g.save(); g.lineCap = "round"; g.lineJoin = "round";
  if (opts.guides) {
    const neck = neckOf(s), pelvis = pelvisOf(s), feet = feetOf(s);
    g.setLineDash([lw * 3, lw * 2]); g.lineWidth = Math.max(2, lw * 0.6); g.strokeStyle = "rgba(255,255,255,0.9)";
    g.beginPath(); g.moveTo(X(feet), oy); g.lineTo(X(feet), oy + h); g.stroke();   // verticale passant par les pieds
    g.strokeStyle = "rgba(250,204,21,0.95)";
    g.beginPath(); g.moveTo(X(s.nose), Y(s.nose)); g.lineTo(X(pelvis), Y(pelvis)); g.lineTo(X(feet), Y(feet)); g.stroke(); // tête – bassin – pieds
    g.setLineDash([]); void neck;
  }
  for (const seg of SEGMENTS) {
    const a = pt(s, seg.from), b = pt(s, seg.to);
    g.lineWidth = lw + 3; g.strokeStyle = "rgba(10,20,40,0.85)"; g.beginPath(); g.moveTo(X(a), Y(a)); g.lineTo(X(b), Y(b)); g.stroke();
    g.lineWidth = lw; g.strokeStyle = seg.color; g.beginPath(); g.moveTo(X(a), Y(a)); g.lineTo(X(b), Y(b)); g.stroke();
  }
  for (const k of JOINTS) {
    g.beginPath(); g.arc(X(s[k]), Y(s[k]), k === opts.active ? r * 1.5 : r, 0, Math.PI * 2);
    g.fillStyle = k === "nose" ? "#facc15" : "#ffffff"; g.fill(); g.lineWidth = 2; g.strokeStyle = "#10203a"; g.stroke();
  }
  if (opts.labels) {
    const ms = measures(s, w, h).filter((m) => ["align", "tronc", "ecart", "coudeG", "coudeD", "genouG", "genouD"].includes(m.key));
    const size = Math.max(13, Math.min(w / 34, h / 22)); g.font = `bold ${size}px sans-serif`; g.textBaseline = "top"; g.textAlign = "left"; g.lineWidth = size / 4; g.strokeStyle = "#10203a"; g.fillStyle = "#ffffff";
    ms.forEach((m, i) => { const t = `${m.label} : ${m.value}`; g.strokeText(t, ox + 10, oy + 10 + i * size * 1.25); g.fillText(t, ox + 10, oy + 10 + i * size * 1.25); });
  }
  g.restore();
}

// Le point le plus proche du pointeur (pour le déplacer à la main), à moins de « radius » (en fraction de l'image)
export function nearestJoint(s: Skeleton, p: P, w: number, h: number, radiusPx: number): Joint | null {
  let best: Joint | null = null, bd = radiusPx;
  for (const k of JOINTS) { const d = Math.hypot((s[k][0] - p[0]) * w, (s[k][1] - p[1]) * h); if (d < bd) { bd = d; best = k; } }
  return best;
}

// ---------- Détection automatique (dans le navigateur ; les fichiers du détecteur viennent de notre site) ----------
type Landmarker = { detect: (img: HTMLCanvasElement) => unknown; detectForVideo: (v: HTMLVideoElement, ts: number) => unknown; close: () => void };
let filesetPromise: Promise<unknown> | null = null;
async function fileset() {
  if (!filesetPromise) { filesetPromise = import("@mediapipe/tasks-vision").then((m) => m.FilesetResolver.forVisionTasks("/mediapipe/wasm")); }
  return filesetPromise;
}
export async function createLandmarker(mode: "IMAGE" | "VIDEO"): Promise<Landmarker> {
  const lib = await import("@mediapipe/tasks-vision");
  const fs = (await fileset()) as Awaited<ReturnType<typeof lib.FilesetResolver.forVisionTasks>>;
  const lm = await lib.PoseLandmarker.createFromOptions(fs, {
    baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate: "CPU" },
    runningMode: mode, numPoses: 1, minPoseDetectionConfidence: 0.4, minPosePresenceConfidence: 0.4, minTrackingConfidence: 0.4,
  });
  return lm as unknown as Landmarker;
}
export function toSkeleton(result: unknown): Skeleton | null {
  const lms = (result as { landmarks?: { x: number; y: number; visibility?: number }[][] })?.landmarks?.[0];
  if (!lms || lms.length < 33) return null;
  const out = {} as Skeleton;
  for (const k of JOINTS) { const l = lms[LANDMARK[k]]; out[k] = [Math.max(0, Math.min(1, l.x)), Math.max(0, Math.min(1, l.y))]; }
  return out;
}
// Lissage léger entre deux images : le squelette tremble moins pendant la lecture
export function smooth(prev: Skeleton | null, next: Skeleton, alpha = 0.55): Skeleton {
  if (!prev) return next;
  const out = {} as Skeleton;
  for (const k of JOINTS) out[k] = [prev[k][0] + (next[k][0] - prev[k][0]) * alpha, prev[k][1] + (next[k][1] - prev[k][1]) * alpha];
  return out;
}
