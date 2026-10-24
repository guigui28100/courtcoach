// UN SEUL dessin de terrain de tennis pour tout le site, aux VRAIES proportions (vue de dessus, longueur à l'horizontale) :
// 23,77 m × 10,97 m, couloirs de 1,37 m, lignes de service à 6,40 m du filet, ligne médiane de service, filet au centre.
// À utiliser pour tout nouveau décor : <svg ...><CourtLines cx={…} y={…} h={…} /></svg> (jamais un rectangle « à l'œil »).
export const COURT_M = { length: 23.77, width: 10.97, alley: 1.37, service: 6.4 } as const;
export const COURT_RATIO = COURT_M.length / COURT_M.width; // ≈ 2,167 : un terrain est un peu plus de 2 fois plus long que large

const r = (v: number) => Math.round(v * 100) / 100;

// Toutes les lignes d'un court de hauteur `h` (largeur du terrain en pixels), centré en `cx`, haut en `y`
export function courtGeometry(cx: number, y: number, h: number) {
  const k = h / COURT_M.width, L = COURT_M.length * k, x0 = cx - L / 2, alley = COURT_M.alley * k, svc = COURT_M.service * k;
  const yTop = y + alley, yBot = y + h - alley, yMid = y + h / 2;
  return {
    rect: { x: r(x0), y: r(y), w: r(L), h: r(h) },
    lines: [
      [x0, yTop, x0 + L, yTop], [x0, yBot, x0 + L, yBot], // lignes de simple (couloirs)
      [cx - svc, yTop, cx - svc, yBot], [cx + svc, yTop, cx + svc, yBot], // lignes de service
      [cx - svc, yMid, cx + svc, yMid], // ligne médiane de service
    ].map((l) => l.map(r)),
    net: [r(cx), r(y - h * 0.03), r(cx), r(y + h + h * 0.03)],
  };
}

export function CourtLines({ cx, y, h, netWidth }: { cx: number; y: number; h: number; netWidth?: number }) {
  const g = courtGeometry(cx, y, h);
  return (
    <>
      <rect x={g.rect.x} y={g.rect.y} width={g.rect.w} height={g.rect.h} />
      {g.lines.map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />)}
      <line x1={g.net[0]} y1={g.net[1]} x2={g.net[2]} y2={g.net[3]} strokeWidth={netWidth ?? Math.max(2, h / 38)} />
    </>
  );
}
