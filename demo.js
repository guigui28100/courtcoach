// Boutons « Essayer la démo » : on entre directement dans l'application, sans créer de compte.
// Deux vidéos d'exemple sont prêtes pour tester (un coup droit d'élève et un coup droit « modèle »).
document.querySelectorAll("[data-demo]").forEach((button) => {
  button.addEventListener("click", async () => {
    const role = button.dataset.demo; // "eleve" ou "coach"
    button.disabled = true;
    button.textContent = "Chargement…";
    CC.setRole(role);
    try {
      const student = role === "eleve" ? CC.ensureMe() : CC.exampleAccount().id;
      await CC.addExamples(student, { fillProfile: true });
    } catch (e) {
      // Les vidéos d'exemple ne sont pas indispensables : on entre quand même dans l'application
    }
    location.href = "espace.html";
  });
});
