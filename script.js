// Fenêtre « Connexion / Inscription » (démonstration : rien n'est envoyé ni enregistré).
(function () {
  const dialog = document.getElementById("auth");
  const tabs = Array.from(dialog.querySelectorAll('[role="tab"]'));
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));

  // Affiche l'onglet choisi (connexion ou inscription)
  function selectTab(name, moveFocus) {
    tabs.forEach((tab, i) => {
      const active = tab.id === "tab-" + name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[i].hidden = !active;
      if (active && moveFocus) tab.focus();
    });
  }

  // Boutons qui ouvrent la fenêtre
  document.querySelectorAll("[data-open-auth]").forEach((button) => {
    button.addEventListener("click", () => {
      selectTab(button.dataset.openAuth, false);
      dialog.showModal();
      const panel = panels.find((p) => !p.hidden);
      panel.querySelector('input[type="email"]').focus();
    });
  });

  // Fermeture : bouton croix ou clic en dehors de la fenêtre
  dialog.querySelector("[data-close-auth]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  // Onglets : clic et flèches du clavier
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(tab.id.replace("tab-", ""), true));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const next = tabs[(i + 1) % tabs.length];
      selectTab(next.id.replace("tab-", ""), true);
    });
  });

  // Envoi des formulaires : on vérifie les champs, puis on explique que l'espace n'est pas encore ouvert
  panels.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const status = form.querySelector(".auth__status");
      const email = form.querySelector('input[type="email"]');
      const password = form.querySelector('input[type="password"]');
      const minLength = password.autocomplete === "new-password" ? 8 : 1;

      let error = "";
      if (!email.value.trim() || !email.validity.valid) {
        error = "Indique une adresse e-mail valide.";
        email.setAttribute("aria-invalid", "true");
      } else {
        email.removeAttribute("aria-invalid");
      }
      if (!error && password.value.length < minLength) {
        error = minLength > 1 ? "Le mot de passe doit faire au moins 8 caractères." : "Indique ton mot de passe.";
        password.setAttribute("aria-invalid", "true");
      } else {
        password.removeAttribute("aria-invalid");
      }

      status.classList.toggle("is-error", Boolean(error));
      status.classList.toggle("is-ok", !error);
      if (error) {
        status.textContent = error;
        (email.hasAttribute("aria-invalid") ? email : password).focus();
        return;
      }

      form.reset();
      status.textContent = "Merci ! L'espace membre ouvrira bientôt. Aucune information n'a été enregistrée.";
    });
  });
})();
