// Page « Mon profil » : enregistre les informations de l'élève (dans le navigateur, en démonstration).
(() => {
  const role = CC.role();
  if (!role) return;
  if (role === "coach") { location.replace("eleves.html"); return; } // le coach consulte les fiches dans le dossier de chaque élève
  const form = document.getElementById("form-profil");
  const status = document.getElementById("profil-status");
  const parentBlock = document.getElementById("bloc-parent");
  const saved = CC.profile();

  // Remplit le formulaire avec ce qui a déjà été enregistré
  Array.from(form.elements).forEach((el) => {
    if (!el.name || saved[el.name] === undefined) return;
    if (el.type === "radio") el.checked = el.value === saved[el.name];
    else if (el.type === "checkbox") el.checked = Array.isArray(saved[el.name]) ? saved[el.name].includes(el.value) : saved[el.name] === el.value;
    else el.value = saved[el.name];
  });

  function collect() {
    const data = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      if (el.type === "radio") { if (el.checked) data[el.name] = el.value; }
      else if (el.type === "checkbox") {
        if (el.name === "dispos") { (data.dispos = data.dispos || []); if (el.checked) data.dispos.push(el.value); }
        else data[el.name] = el.checked ? el.value : "";
      } else data[el.name] = el.value.trim();
    });
    return data;
  }

  function age(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a -= 1;
    return a;
  }

  function refresh() {
    const a = age(form.elements.naissance.value);
    parentBlock.hidden = !(a !== null && a < 18);
    const pct = CC.profileCompletion();
    document.getElementById("pct-label").textContent = "Profil complété : " + pct + " %";
    document.getElementById("pct-bar").style.setProperty("--val", pct + "%");
  }

  // La jauge se met à jour à l'enregistrement ; ici on ne gère que le bloc « parent »
  form.addEventListener("input", () => {
    const a = age(form.elements.naissance.value);
    parentBlock.hidden = !(a !== null && a < 18);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = collect();
    const a = age(data.naissance);
    status.className = "status-line is-error";
    if (data.email && !form.elements.email.validity.valid) {
      status.textContent = "L'adresse e-mail n'a pas l'air correcte.";
      form.elements.email.focus();
      return;
    }
    if (a !== null && a < 18 && !data.parent_nom) {
      status.textContent = "Pour un mineur, merci d'indiquer le nom du responsable légal.";
      form.elements.parent_nom.focus();
      return;
    }
    if (!CC.saveProfile(data)) {
      status.textContent = "Impossible d'enregistrer : le navigateur refuse le stockage.";
      return;
    }
    status.className = "status-line is-ok";
    status.textContent = "Profil enregistré ✓";
    refresh();
  });

  refresh();
})();
