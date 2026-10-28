import type { CSSProperties, ReactNode } from "react";
import { SERIF } from "./posterFonts";
import { Pack, perkOf, PERKS, Sponsor } from "../sponsors";

// Convention de partenariat (parrainage / « sponsoring ») : 3 pages A4 dessinées dans le navigateur, à imprimer ou enregistrer en PDF.
// Ce qui est connu (partenaire, formule, contreparties, montant, dates) est écrit ; le reste est une ligne pointillée à remplir à la main.
export const CONTRACT_W = 794, CONTRACT_H = 1123;
const FONT = "Archivo, 'Arial Narrow', system-ui, sans-serif";
const NAVY = "#17140f", CLAY = "#7b5d2a", LINE = "#ddd3c0", MUTED = "#5e574a";
const LOGO = "url(/logo-tch.png) center / contain no-repeat";

export interface ContractData { sponsor: Sponsor | null; pack: Pack | null }

const fmt = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };

// Un champ : la valeur en gras si on la connaît, sinon une ligne pointillée à remplir au stylo
// Tout est modifiable au clavier : on clique dans la ligne pointillée (ou n'importe où dans le texte) et on tape ; la ligne s'allonge toute seule
const F = ({ v, w = 220 }: { v?: string; w?: number }) => (
  <span contentEditable suppressContentEditableWarning spellCheck={false} className="contract-field"
    style={{ display: "inline-block", minWidth: v ? undefined : w, borderBottom: v ? undefined : `1.5px dotted ${MUTED}`, fontWeight: v ? 700 : undefined, minHeight: "1em", verticalAlign: "baseline" }}>{v}</span>
);

const Page = ({ n, children }: { n: number; children: ReactNode }) => (
  <div className="dossier-page" style={{ width: CONTRACT_W, height: CONTRACT_H, background: "#fff", position: "relative", overflow: "hidden", fontFamily: FONT, color: NAVY, breakAfter: "page", display: "flex", flexDirection: "column", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
    <div style={{ height: 6, background: `linear-gradient(90deg, ${CLAY}, #c9ad77)`, flex: "0 0 auto" }} />
    <div style={{ flex: 1, padding: "26px 50px 0", fontSize: 12.5, lineHeight: 1.42, minHeight: 0, display: "flex", flexDirection: "column", gap: 9, outline: "none" }} data-body contentEditable suppressContentEditableWarning spellCheck={false} className="contract-body">{children}</div>
    <div style={{ height: 44, flex: "0 0 auto", borderTop: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 50px", fontSize: 11, color: MUTED }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}><span aria-hidden style={{ display: "inline-block", width: 22, height: 22, background: NAVY, WebkitMask: LOGO, mask: LOGO }} />Tennis Club Houdan · Convention de partenariat</span>
      <span>Page {n}/3 · Paraphes : Club ……… Partenaire ………</span>
    </div>
  </div>
);

const H = ({ children }: { children: ReactNode }) => <h3 style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 900, color: CLAY, textTransform: "uppercase", letterSpacing: "0.04em" }}>{children}</h3>;
const P = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <p style={{ margin: 0, textAlign: "justify", ...style }}>{children}</p>;
const Box = ({ title, children }: { title: string; children: ReactNode }) => (
  <div style={{ border: `1.5px solid ${LINE}`, borderLeft: `6px solid ${NAVY}`, borderRadius: 8, padding: "9px 14px", display: "grid", gap: 5 }}>
    <div style={{ fontSize: 11.5, fontWeight: 900, letterSpacing: "0.12em", color: NAVY }}>{title}</div>{children}
  </div>
);

export function buildContract({ sponsor: s, pack }: ContractData): ReactNode[] {
  const perkKeys = s ? s.perks : pack?.perks ?? [];
  const chosen = new Set(perkKeys);
  const customs = perkKeys.filter((k) => k.startsWith("X:"));
  const grade = s?.pack || pack?.name || "";
  const amount = s?.amount || pack?.price || "";
  const start = s ? fmt(s.startDate) : "", end = s ? fmt(s.endDate) : "";
  const contactBits = s ? [s.contactName, s.phone, s.email].filter(Boolean) : [];

  return [
    <Page key="1" n={1}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11.5, fontWeight: 900, letterSpacing: "0.3em", color: CLAY }}>TENNIS CLUB HOUDAN</div>
        <h1 style={{ fontFamily: SERIF, margin: "4px 0 0", fontSize: 26, lineHeight: 1.1, fontWeight: 900, color: NAVY }}>Convention de partenariat</h1>
        <div style={{ fontSize: 14, fontWeight: 700, color: MUTED }}>(parrainage / sponsoring)</div>
      </div>
      <P style={{ textAlign: "left" }}><b>Entre les soussignés :</b></P>
      <Box title="LE CLUB (« le Club »)">
        <div>L'association <b>Tennis Club Houdan</b>, association déclarée régie par la loi du 1<sup>er</sup> juillet 1901, dont le siège est situé : <F w={330} />.</div>
        <div>N° RNA / SIRET : <F w={250} /> — représentée par <F w={190} />, agissant en qualité de <b>Président(e)</b>, dûment habilité(e).</div>
        <div>Contact : <b>tennisclubhoudan@gmail.com</b></div>
      </Box>
      <P style={{ textAlign: "center" }}><b>et</b></P>
      <Box title="LE PARTENAIRE (« le Partenaire »)">
        <div>Société / entreprise : <F v={s?.name} w={300} />, forme juridique : <F w={140} />.</div>
        <div>Siège social : <F w={400} />.</div>
        <div>N° SIRET : <F w={200} /> — N° de TVA intracommunautaire : <F w={190} />.</div>
        <div>Représentée par <F w={190} />, en qualité de <F w={170} />, dûment habilité(e).</div>
        <div>Contact : {contactBits.length ? <b>{contactBits.join(" · ")}</b> : <F w={380} />}</div>
      </Box>
      <P style={{ textAlign: "left" }}>Ci-après désignés ensemble « les Parties ».</P>

      <H>Préambule</H>
      <P>Le Club est une association sportive à but non lucratif qui propose la pratique du tennis (école de tennis, stages, animations, tournois et compétitions par équipes). Le Partenaire souhaite soutenir le Club et bénéficier, en échange de ce soutien, d'une visibilité auprès de ses licenciés, de leurs familles et du public. La présente convention est un contrat de <b>parrainage (sponsoring)</b> : le soutien du Partenaire est donné <b>en contrepartie</b> des actions de communication décrites ci-dessous, dans un but de promotion de son image ou de ses produits. Il ne s'agit pas d'un don : <b>aucun reçu fiscal</b> ne sera délivré au titre du mécénat.</P>

      <H>Article 1 — Objet</H>
      <P>La présente convention fixe les conditions dans lesquelles le Partenaire soutient financièrement le Club et dans lesquelles le Club met en œuvre, en retour, les actions de visibilité listées à l'article 3.</P>

      <H>Article 2 — Durée</H>
      <P>La convention prend effet le <F v={start} w={110} /> et s'achève le <F v={end} w={110} />, soit pour la saison sportive <F w={90} />. {grade ? <>Formule choisie : <b>{grade}</b>. </> : <>Formule choisie : <F w={180} />. </>}Elle ne se renouvelle <b>pas</b> tacitement : toute reconduction fait l'objet d'un nouvel écrit signé des deux Parties.</P>
    </Page>,

    <Page key="2" n={2}>
      <H>Article 3 — Contreparties apportées par le Club</H>
      <P style={{ textAlign: "left" }}>Le Club s'engage à mettre en œuvre, pendant la durée de la convention, les actions cochées ci-dessous (☒ = incluse, ☐ = non incluse) :</P>
      <div style={{ display: "grid", gap: 4 }}>
        {PERKS.map((p) => (
          <div key={p.key} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1.5px solid ${chosen.has(p.key) ? NAVY : LINE}`, borderRadius: 8, padding: "4px 10px", background: chosen.has(p.key) ? "#f6f1e6" : "#fff" }}>
            <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>{chosen.has(p.key) ? "☒" : "☐"}</span>
            <div><b>{p.label}</b> <span style={{ fontSize: 11, color: MUTED }}>— {p.hint}</span></div>
          </div>))}
        {customs.map((k) => (
          <div key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1.5px solid ${NAVY}`, borderRadius: 8, padding: "6px 10px", background: "#f6f1e6" }}>
            <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>☒</span><div><b>{perkOf(k)?.label}</b></div>
          </div>))}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1.5px solid ${LINE}`, borderRadius: 8, padding: "6px 10px" }}>
          <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>☐</span><div><b>Autre contrepartie convenue :</b> <F w={290} /></div>
        </div>
      </div>
      <P>Les modalités pratiques (emplacement, dimensions, dates précises) sont arrêtées d'un commun accord. Le Club garde la maîtrise de ses affiches, de son site et de ses événements : le Partenaire n'intervient pas dans leur contenu. Si une action prévue ne peut avoir lieu (événement annulé, panneau retiré…), le Club propose une action équivalente ou, à défaut, une réduction proportionnelle du montant restant dû.</P>

      <H>Article 4 — Soutien financier du Partenaire et paiement</H>
      <P>En contrepartie des actions de l'article 3, le Partenaire verse au Club la somme de <F v={amount} w={150} /> <b>hors taxes</b> pour la durée de la convention, soit, sur la base du taux de TVA en vigueur ou du régime applicable au Club : <F w={110} /> TTC.</P>
      <P>Le Club émet une <b>facture</b> à l'ordre du Partenaire (la TVA applicable étant celle prévue par la réglementation en vigueur à la date de facturation). Le paiement intervient par virement ou chèque, <b>dans un délai de 30 jours</b> à compter de la réception de la facture : IBAN du Club : <F w={290} />. En cas de retard, des pénalités peuvent être appliquées conformément à la loi, ainsi que l'indemnité forfaitaire de 40 € pour frais de recouvrement due entre professionnels.</P>
      <P>Le Partenaire peut aussi apporter une aide <b>en nature</b> (matériel, lots, prestation) : elle est alors décrite et valorisée ici : <F w={380} />.</P>

      <H>Article 5 — Logo, marque et propriété intellectuelle</H>
      <P>Le Partenaire autorise le Club à reproduire et diffuser son nom, son logo et sa marque, <b>uniquement</b> pour les actions de l'article 3 et pour la durée de la convention (affiches, site internet, panneaux, réseaux sociaux du Club). Il remet au Club un fichier de son logo en bonne qualité et reste propriétaire de ses signes distinctifs. De son côté, le Partenaire n'utilise le nom et le logo du Club qu'après accord écrit du Club (qui peut être donné par e-mail). À la fin de la convention, chacune des Parties cesse toute nouvelle utilisation des signes de l'autre ; les supports déjà imprimés ou publiés peuvent rester en circulation jusqu'à leur épuisement normal.</P>

      <H>Article 6 — Contenus et réputation</H>
      <P>Le Partenaire garantit que ses messages et visuels respectent la loi, notamment la réglementation sur la publicité (dont la loi Evin pour l'alcool et le tabac) et qu'ils sont adaptés à un public comprenant des enfants et des adolescents. Le Club peut refuser ou retirer un visuel contraire à ces règles ou à ses valeurs. Chaque Partie s'abstient de tout acte de nature à nuire à l'image de l'autre.</P>
    </Page>,

    <Page key="3" n={3}>
      <H>Article 7 — Absence de mécénat, absence de lien avec les élèves</H>
      <P>Le soutien du Partenaire étant la contrepartie d'actions de communication, il <b>n'ouvre pas droit</b> à la réduction d'impôt prévue pour le mécénat. Le Partenaire n'a accès à aucune donnée sur les licenciés ou leurs familles : il n'est destinataire d'aucune liste d'élèves, de coordonnées ni de photographies d'enfants, et ne peut pas démarcher directement les familles à partir des informations du Club.</P>

      <H>Article 8 — Responsabilité et assurances</H>
      <P>Chaque Partie est responsable des dommages qu'elle cause du fait de ses activités. Le Partenaire installe ses supports (panneaux, bâches) dans le respect des consignes du Club et des règles de sécurité ; le Club veille à leur entretien normal pendant la durée de la convention. Chaque Partie déclare être assurée en responsabilité civile.</P>

      <H>Article 9 — Force majeure</H>
      <P>Aucune des Parties n'est responsable d'un manquement dû à un événement de force majeure (fermeture imposée des installations, décision des autorités, intempéries exceptionnelles, etc.). Les actions de l'article 3 sont alors reportées ou adaptées de bonne foi.</P>

      <H>Article 10 — Résiliation</H>
      <P>En cas de manquement grave d'une Partie à ses obligations, non réparé <b>15 jours</b> après une mise en demeure envoyée par lettre recommandée ou par e-mail avec accusé de réception, l'autre Partie peut résilier la convention de plein droit. Le Club peut aussi y mettre fin immédiatement si le Partenaire porte atteinte à l'image du Club ou aux valeurs sportives qu'il défend. En cas de résiliation, les sommes déjà perçues sont conservées pour la période écoulée ; le trop-perçu éventuel est remboursé au prorata de la durée non exécutée, sauf faute du Partenaire.</P>

      <H>Article 11 — Données personnelles</H>
      <P>Les coordonnées professionnelles échangées (nom du contact, téléphone, adresse e-mail) ne servent qu'à la gestion de la présente convention. Elles sont conservées pendant la durée de la convention puis le temps nécessaire aux obligations comptables et légales. Chaque personne concernée peut exercer ses droits d'accès, de rectification et d'effacement en écrivant au Club (tennisclubhoudan@gmail.com).</P>

      <H>Article 12 — Dispositions générales</H>
      <P>La convention exprime l'intégralité de l'accord des Parties. Toute modification fait l'objet d'un avenant écrit et signé. Elle ne peut être cédée à un tiers sans l'accord écrit de l'autre Partie. Si une clause était déclarée nulle, les autres resteraient applicables.</P>

      <H>Article 13 — Droit applicable et litiges</H>
      <P>La convention est soumise au droit français. En cas de difficulté, les Parties cherchent d'abord une solution amiable. À défaut, le litige est porté devant le tribunal compétent du lieu du siège du Club.</P>

      <div style={{ marginTop: "auto", paddingBottom: 14 }}>
        <P style={{ textAlign: "left", marginBottom: 8 }}>Fait en deux exemplaires originaux, à <F w={150} />, le <F w={110} />.</P>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {[["Pour le Club", "Le (la) Président(e)"], ["Pour le Partenaire", s?.name || "Nom et qualité"]].map(([a, b]) => (
            <div key={a} style={{ border: `1.5px solid ${LINE}`, borderRadius: 10, padding: "10px 14px", height: 150 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>{a}</div>
              <div style={{ fontSize: 11.5, color: MUTED }}>{b}</div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>Nom : <F w={150} /></div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>Signature précédée de la mention « Lu et approuvé » et cachet :</div>
            </div>))}
        </div>
      </div>
    </Page>,
  ];
}
