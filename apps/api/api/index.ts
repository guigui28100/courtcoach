// Point d'entrée Vercel : l'application Nest tourne comme une fonction à la demande.
import "reflect-metadata";
import { createApp } from "../src/app.factory";

let cached: any = null;

export default async function handler(req: any, res: any) {
  if (!cached) {
    const app = await createApp();
    await app.init();
    cached = app.getHttpAdapter().getInstance();
  }
  return cached(req, res);
}
