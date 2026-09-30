// Boutons « Essayer la démo » : on entre directement dans l'application, sans créer de compte.
document.querySelectorAll("[data-demo]").forEach((button) => {
  button.addEventListener("click", () => {
    CC.setRole(button.dataset.demo); // "eleve" ou "coach"
    if (button.dataset.demo === "eleve") CC.ensureMe();
    location.href = "espace.html";
  });
});
