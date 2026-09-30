// Boutons « Essayer la démo » : on entre directement dans l'application, sans créer de compte.
document.querySelectorAll("[data-demo]").forEach((button) => {
  button.addEventListener("click", () => {
    CC.setRole(button.dataset.demo); // "eleve" ou "coach"
    location.href = "espace.html";
  });
});
