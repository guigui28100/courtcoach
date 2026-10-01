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

    // Vie privée : politique lue ; pour un jeune : prénom + accord du parent ou responsable légal (création de compte seulement)
    const signup = form.querySelector('input[name="politique"]');
    let consent = null;
    let extra = {};
    if (signup) {
      const kind = form.querySelector('input[name="profil"]:checked').value;
      const young = kind === "jeune";
      let privacyError = "", focusEl = signup;
      if (young && !form.elements.prenom.value.trim()) { privacyError = "Indique le prénom du jeune."; focusEl = form.elements.prenom; }
      else if (young && !form.elements.parent.checked) { privacyError = "Pour un jeune, l'accord d'un parent ou responsable légal est nécessaire : coche la case. "; focusEl = form.elements.parent; }
      else if (!signup.checked) privacyError = "Coche la case pour confirmer que tu as lu la politique de confidentialité.";
      if (privacyError) {
        status.classList.add("is-error"); status.classList.remove("is-ok");
        status.textContent = privacyError.trim();
        focusEl.focus();
        return;
      }
      consent = { politique: true, moins15: young, accordParent: young };
      extra = { kind: young ? "jeune" : "adulte", prenom: young ? form.elements.prenom.value.trim() : "" };
    }

    // Rôle : « enseignant » ou « coach » → coach ; sinon élève (adulte ou jeune)
    const choice = form.querySelector('input[name="profil"]:checked, input[name="mode"]:checked');
    const isCoach = choice && (choice.value === "enseignant" || choice.value === "coach");
    CC.setRole(isCoach ? "coach" : "eleve");
    if (!isCoach) CC.signUpStudent(email.value, consent, extra); // un dossier est créé pour cette personne (ou retrouvé grâce à l'e-mail)
    status.textContent = "C'est parti ! Ouverture de ton espace…";
    location.href = "espace.html";
  });
});

// Création de compte : les champs « jeune » ne s'affichent que pour un jeune du Centre de compétition jeunes
(() => {
  const form = document.querySelector("form.form");
  const jeune = form && form.querySelector("#bloc-jeune");
  if (!jeune) return;
  const parentBox = form.querySelector("#bloc-parent");
  const help = form.querySelector("#aide-profil");
  const HELP = {
    adulte: "Pour t'entraîner, envoyer tes vidéos et demander des conseils ou un cours à ton coach.",
    jeune: "Parent : crée le compte avec ton enfant. Le coach validera l'inscription puis ouvrira son suivi (objectifs, évaluations, bulletins).",
    enseignant: "Réservé aux coachs et enseignants du club.",
  };
  const refresh = () => {
    const kind = form.querySelector('input[name="profil"]:checked').value;
    jeune.hidden = kind !== "jeune";
    parentBox.hidden = kind !== "jeune";
    help.textContent = HELP[kind] || "";
    form.querySelector("#lbl-email").textContent = kind === "jeune" ? "Adresse e-mail (celle d'un parent de préférence)" : "Adresse e-mail";
  };
  form.addEventListener("change", refresh);
  refresh();
})();
