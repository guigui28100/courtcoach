import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

// Double authentification (TOTP, norme RFC 6238) : code à 6 chiffres qui change toutes les 30 secondes.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32(buf: Buffer) {
  let bits = 0, value = 0, out = "";
  for (const b of buf) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(s: string) {
  let bits = 0, value = 0; const out: number[] = [];
  for (const c of s.replace(/=+$/, "").toUpperCase()) { const i = ALPHABET.indexOf(c); if (i < 0) continue; value = (value << 5) | i; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}

export const newSecret = () => base32(randomBytes(20));
const codeAt = (secret: string, step: number) => {
  const msg = Buffer.alloc(8); msg.writeUInt32BE(Math.floor(step / 2 ** 32), 0); msg.writeUInt32BE(step >>> 0, 4);
  const h = createHmac("sha1", unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, "0");
};
export const stepNow = (now = Date.now()) => Math.floor(now / 30_000);

// Retourne le numéro de période du code s'il est bon (tolérance : 30 s avant / après), sinon null.
export function verifyCode(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  for (const d of [0, -1, 1]) {
    const step = stepNow(now) + d, expected = codeAt(secret, step);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return step;
  }
  return null;
}
export const otpauthUrl = (secret: string, account: string) => `otpauth://totp/CourtCoach:${encodeURIComponent(account)}?secret=${secret}&issuer=CourtCoach&algorithm=SHA1&digits=6&period=30`;

// La clé du coach est chiffrée dans la base (AES-256-GCM) : une copie de la base seule ne donne pas les codes.
const key = () => createHash("sha256").update("totp|" + (process.env.TOTP_KEY || process.env.JWT_SECRET || "")).digest();
export function seal(plain: string) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
export function unseal(sealed: string) {
  const [iv, tag, enc] = sealed.split(".").map((x) => Buffer.from(x, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
export const newRecoveryCodes = () => Array.from({ length: 8 }, () => { const r = base32(randomBytes(7)).slice(0, 10).toLowerCase(); return `${r.slice(0, 5)}-${r.slice(5)}`; });
