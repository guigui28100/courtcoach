// Enregistre une affiche (un bloc HTML sans image extérieure) en image PNG, entièrement dans le navigateur : rien n'est envoyé sur Internet.
const toDataUrl = async (url: string, mime: string) => {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
};

async function posterToCanvas(node: HTMLElement, w: number, h: number, scale: number): Promise<HTMLCanvasElement> {
  const [logo, font] = await Promise.all([toDataUrl("/logo-tch.png", "image/png"), toDataUrl("/fonts/archivo-latin-400-900.woff2", "font/woff2")]);
  let xhtml = new XMLSerializer().serializeToString(node).split("/logo-tch.png").join(logo);
  if (xhtml.includes("/fond-bulle.jpg")) xhtml = xhtml.split("/fond-bulle.jpg").join(await toDataUrl("/fond-bulle.jpg", "image/jpeg"));
  const style = `<style>@font-face{font-family:'ArchivoPoster';font-weight:100 900;src:url(${font}) format('woff2');}</style>`;
  xhtml = xhtml.replace(/^(<div[^>]*>)/, `$1${style}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}"><foreignObject width="${w}" height="${h}">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error("image")); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; });
  const c = document.createElement("canvas"); c.width = w * scale; c.height = h * scale;
  const ctx = c.getContext("2d")!; ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, 0, 0, w * scale, h * scale);
  return c;
}

export async function posterToPng(node: HTMLElement, w: number, h: number, scale = 3): Promise<Blob> {
  const c = await posterToCanvas(node, w, h, scale);
  return await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("png"))), "image/png"));
}

// Vrai fichier PDF d'une seule page (taille exacte de l'affiche, 300 points par pouce environ), fabriqué à la main : aucune bibliothèque, rien n'est envoyé
export async function posterToPdf(node: HTMLElement, w: number, h: number, scale = 3): Promise<Blob> {
  const c = await posterToCanvas(node, w, h, scale);
  const jpg = new Uint8Array(await (await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("jpg"))), "image/jpeg", 0.95))).arrayBuffer());
  const enc = new TextEncoder(); const parts: Uint8Array[] = []; const offsets: number[] = []; let len = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === "string" ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const obj = (n: number, body: string, stream?: Uint8Array) => { offsets[n] = len; push(`${n} 0 obj\n${body}`); if (stream) { push("\nstream\n"); push(stream); push("\nendstream"); } push("\nendobj\n"); };
  const pw = +(w * 0.75).toFixed(2), ph = +(h * 0.75).toFixed(2); const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, `<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`, jpg);
  obj(5, `<< /Length ${content.length} >>`, enc.encode(content));
  const xref = len; push("xref\n0 6\n0000000000 65535 f \n"); for (let i = 1; i <= 5; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}
