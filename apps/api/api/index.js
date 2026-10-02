// Point d'entrée Vercel : l'application Nest (compilée dans dist/) tourne comme une fonction à la demande.
require("reflect-metadata");

let cached = null;

// Si le démarrage échoue, on renvoie une explication courte et sans secret (au lieu d'un « 500 » muet).
const explain = (e) => {
  const msg = String((e && e.message) || e || "").split("\n").filter(Boolean).slice(-1)[0] || "";
  const clean = msg.replace(/`[^`]*`/g, "…").replace(/[a-z]+:\/\/\S+/gi, "…").replace(/\S+@\S+/g, "…").slice(0, 200);
  return [(e && e.name) || "Erreur", (e && e.code) || "", clean].filter(Boolean).join(" · ");
};

module.exports = async (req, res) => {
  try {
    if (!cached) {
      const { createApp } = require("../dist/app.factory");
      const app = await createApp();
      await app.init();
      cached = app.getHttpAdapter().getInstance();
    }
    return cached(req, res);
  } catch (e) {
    console.error("Démarrage impossible :", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, etape: "démarrage", detail: explain(e) }));
  }
};
