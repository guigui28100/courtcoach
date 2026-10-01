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

    // Vie privée : politique lue + accord d'un parent pour les moins de 15 ans (création de compte seulement)
    const signup = form.querySelector('input[name="politique"]');
    let consent = null;
    if (signup) {
      const role0 = form.querySelector('input[name="profil"]:checked').value;
      const young = role0 === "eleve" && form.querySelector('input[name="age"]:checked').value === "moins15";
      let privacyError = "";
      if (young && !form.elements.parent.checked) privacyError = "Si tu as moins de 15 ans, l'accord d'un parent ou responsable légal est nécessaire : demande-lui de t'aider et coche la case.";
      else if (!signup.checked) privacyError = "Coche la case pour confirmer que tu as lu la politique de confidentialité.";
      if (privacyError) {
        status.classList.add("is-error"); status.classList.remove("is-ok");
        status.textContent = privacyError;
        (young && !form.elements.parent.checked ? form.elements.parent : signup).focus();
        return;
      }
      consent = { politique: true, moins15: young, accordParent: young ? true : role0 === "parent" };
    }

    // Rôle : « enseignant » ou « coach » → coach ; sinon élève
    const choice = form.querySelector('input[name="profil"]:checked, input[name="mode"]:checked');
    const isCoach = choice && (choice.value === "enseignant" || choice.value === "coach");
    CC.setRole(isCoach ? "coach" : "eleve");
    if (!isCoach) CC.signUpStudent(email.value, consent); // un dossier est créé pour cet élève (ou retrouvé grâce à l'e-mail)
    status.textContent = "C'est parti ! Ouverture de ton espace…";
    location.href = "espace.html";
  });
});

// Création de compte : les cases « âge » et « parent » ne s'affichent que pour un élève
(() => {
  const form = document.querySelector("form.form");
  const age = form && form.querySelector("#bloc-age");
  if (!age) return;
  const parentBox = form.querySelector("#bloc-parent");
  const refresh = () => {
    const isStudent = form.querySelector('input[name="profil"]:checked').value === "eleve";
    age.hidden = !isStudent;
    parentBox.hidden = !(isStudent && form.querySelector('input[name="age"]:checked').value === "moins15");
  };
  form.addEventListener("change", refresh);
  refresh();
})();
