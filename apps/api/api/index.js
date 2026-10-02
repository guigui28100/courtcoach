// Point d'entrée Vercel : l'application Nest (compilée dans dist/) tourne comme une fonction à la demande.
require("reflect-metadata");
const { createApp } = require("../dist/app.factory");

let cached = null;

module.exports = async (req, res) => {
  if (!cached) {
    const app = await createApp();
    await app.init();
    cached = app.getHttpAdapter().getInstance();
  }
  return cached(req, res);
};
