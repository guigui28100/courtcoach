// Boutons « Imprimer » (le site n'autorise pas de script écrit dans la page).
document.querySelectorAll("[data-print]").forEach((b) => b.addEventListener("click", () => window.print()));
