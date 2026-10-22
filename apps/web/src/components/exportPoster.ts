// Enregistre une affiche (un bloc HTML sans image extérieure) en image PNG, entièrement dans le navigateur : rien n'est envoyé sur Internet.
const toDataUrl = async (url: string, mime: string) => {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
};

export async function posterToPng(node: HTMLElement, w: number, h: number, scale = 3): Promise<Blob> {
  const [logo, font] = await Promise.all([toDataUrl("/logo-tch.png", "image/png"), toDataUrl("/fonts/archivo-latin-400-900.woff2", "font/woff2")]);
  let xhtml = new XMLSerializer().serializeToString(node).split("/logo-tch.png").join(logo);
  const style = `<style>@font-face{font-family:'ArchivoPoster';font-weight:100 900;src:url(${font}) format('woff2');}</style>`;
  xhtml = xhtml.replace(/^(<div[^>]*>)/, `$1${style}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}"><foreignObject width="${w}" height="${h}">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error("image")); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; });
  const c = document.createElement("canvas"); c.width = w * scale; c.height = h * scale;
  const ctx = c.getContext("2d")!; ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, 0, 0, w * scale, h * scale);
  return await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("png"))), "image/png"));
}
