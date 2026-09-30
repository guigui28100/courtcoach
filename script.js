// Formulaires « Créer mon compte » et « Se connecter » (démonstration : rien n'est envoyé sur Internet).
// Après validation, on entre dans l'application avec le rôle choisi (élève ou coach).
document.querySelectorAll(".form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = form.querySelector(".auth__status");
    const email = form.querySelector('input[type="email"]');
    const password = form.querySelector('input[type="password"]');
    const minLength = password.autocomplete === "new-password" ? 8 : 1;

    // On vérifie les champs et on signale la première erreur
    let error = "";
    let fieldInError = null;
    if (!email.value.trim() || !email.validity.valid) {
      error = "Indique une adresse e-mail valide.";
      fieldInError = email;
    } else if (password.value.length < minLength) {
      error = minLength > 1 ? "Le mot de passe doit faire au moins 8 caractères." : "Indique ton mot de passe.";
      fieldInError = password;
    }

    [email, password].forEach((field) => {
      if (field === fieldInError) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    });

    status.classList.toggle("is-error", Boolean(error));
    status.classList.toggle("is-ok", !error);
    if (error) {
      status.textContent = error;
      fieldInError.focus();
      return;
    }

    // Rôle : « enseignant » ou « coach » → coach ; sinon élève
    const choice = form.querySelector('input[name="profil"]:checked, input[name="mode"]:checked');
    CC.setRole(choice && (choice.value === "enseignant" || choice.value === "coach") ? "coach" : "eleve");
    status.textContent = "C'est parti ! Ouverture de ton espace…";
    location.href = "espace.html";
  });
});
