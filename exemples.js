// Bouton « Ajouter des vidéos d'exemple » (pages espace et vidéos), côté élève comme côté coach.
(() => {
  const role = CC.role();
  if (!role) return;
  document.querySelectorAll("[data-examples]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = document.getElementById(button.dataset.examples);
      button.disabled = true;
      status.className = "status-line";
      status.textContent = "Chargement des vidéos d'exemple…";
      try {
        // Élève : les vidéos vont dans son propre dossier. Coach : dans le dossier de l'élève fictif « Alex Exemple ».
        const student = role === "coach" ? CC.exampleAccount().id : CC.ensureMe();
        const added = await CC.addExamples(student, { fillProfile: role === "coach" });
        if (!added) {
          status.textContent = "Les vidéos d'exemple sont déjà là.";
          button.disabled = false;
          return;
        }
        status.className = "status-line is-ok";
        status.textContent = added + " vidéo(s) ajoutée(s) ✓";
        setTimeout(() => location.reload(), 600);
      } catch (e) {
        status.className = "status-line is-error";
        status.textContent = "Impossible de charger les vidéos d'exemple. Réessaie dans un instant.";
        button.disabled = false;
      }
    });
  });
})();
