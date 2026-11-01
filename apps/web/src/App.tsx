import { lazy, Suspense } from "react";
import { Route, Routes, useParams } from "react-router-dom";
import { BackLink, Notice, Skeleton } from "./components/ui";
import { useAuth } from "./auth";
import { Guard } from "./components/Guard";
import { Layout } from "./components/Layout";
import ChangePassword from "./pages/ChangePassword";
import Connexion from "./pages/Connexion";
import Home from "./pages/Home";
import Installation from "./pages/Installation";
import Invitation from "./pages/Invitation";

// Chaque grande page n'est téléchargée que quand on l'ouvre : le premier affichage est plus rapide
const named = <T extends Record<string, any>>(load: () => Promise<T>, key: keyof T) => lazy(() => load().then((m) => ({ default: m[key] })));
const CoachHome = named(() => import("./pages/Coach"), "CoachHome");
const AdultsPage = named(() => import("./pages/Coach"), "AdultsPage");
const Centre = named(() => import("./pages/Coach"), "Centre");
const AdultSpace = named(() => import("./pages/Member"), "AdultSpace");
const AdultPreview = named(() => import("./pages/Member"), "AdultPreview");
const PresidentAdultPreview = named(() => import("./pages/Member"), "PresidentAdultPreview");
const ClubPlan = named(() => import("./pages/ClubPlan"), "ClubPlan");
const ProfSpace = named(() => import("./pages/Prof"), "ProfSpace");
const Privacy = named(() => import("./pages/Static"), "Privacy");
const Authorization = named(() => import("./pages/Static"), "Authorization");
const Bulletin = lazy(() => import("./pages/Bulletin"));
const PlanningProfsPage = lazy(() => import("./pages/PlanningProfs"));
const TournamentReportPrint = lazy(() => import("./pages/TournamentReportPrint"));
const TrainerPreview = lazy(() => import("./pages/TrainerPreview"));
const FinDeCours = lazy(() => import("./pages/FinDeCours"));
const Securite = lazy(() => import("./pages/Securite"));
const VideoReview = lazy(() => import("./pages/VideoReview"));
const YouthSpace = lazy(() => import("./pages/Youth"));
const PlayerDetail = lazy(() => import("./pages/PlayerDetail"));
const PresidentPage = lazy(() => import("./pages/President"));
const SponsorsPage = lazy(() => import("./pages/Sponsors"));
const V2Page = lazy(() => import("./pages/V2"));

// Les parents voient l'espace sobre ; le jeune voit son univers « galaxie ».
function Apercu() { const { id = "" } = useParams(); return <YouthSpace previewId={id} />; }
function Suivi() { return <YouthSpace />; } // un seul espace : celui de l'enfant (le compte du parent l'ouvre, avec en plus ses rubriques de parent)

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<Skeleton />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/installation" element={<Installation />} />
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/mot-de-passe" element={<ChangePassword />} />
        <Route path="/invitation/:token" element={<Invitation />} />
        <Route path="/confidentialite" element={<Privacy />} />
        <Route path="/autorisation" element={<Authorization />} />
        <Route path="/v2" element={<Guard roles={["COACH"]}><V2Page /></Guard>} />
        <Route path="/coach" element={<Guard roles={["COACH"]}><CoachHome /></Guard>} />
        <Route path="/coach/adultes/apercu" element={<Guard roles={["COACH"]}><AdultPreview /></Guard>} />
        <Route path="/coach/adultes" element={<Guard roles={["COACH"]}><AdultsPage /></Guard>} />
        <Route path="/coach/securite" element={<Guard roles={["COACH", "TRAINER", "PRESIDENT", "BUREAU"]}><Securite /></Guard>} />
        <Route path="/coach/centre/apercu-entraineur" element={<Guard roles={["COACH"]}><TrainerPreview /></Guard>} />
        <Route path="/coach/centre" element={<Guard roles={["COACH", "TRAINER"]}><Centre /></Guard>} />
        <Route path="/coach/centre/fin-de-cours" element={<Guard roles={["COACH", "TRAINER"]}><FinDeCours /></Guard>} />
        <Route path="/coach/centre/:id" element={<Guard roles={["COACH", "TRAINER"]}><PlayerDetail /></Guard>} />
        <Route path="/coach/centre/:id/apercu" element={<Guard roles={["COACH", "TRAINER"]}><Apercu /></Guard>} />
        <Route path="/coach/videos/:id" element={<Guard roles={["COACH", "TRAINER"]}><VideoReview /></Guard>} />
        <Route path="/coach/centre/:id/bilan-tournoi/:rid" element={<Guard roles={["COACH"]}><TournamentReportPrint /></Guard>} />
        <Route path="/coach/centre/:id/bulletin/:season/:t" element={<Guard roles={["COACH", "TRAINER"]}><Bulletin /></Guard>} />
        <Route path="/coach/adultes/apercu-prof" element={<Guard roles={["COACH"]}><ProfSpace preview /></Guard>} />
        <Route path="/coach/planning-profs" element={<Guard roles={["COACH"]}><PlanningProfsPage /></Guard>} />
        <Route path="/prof" element={<Guard roles={["TRAINER"]}><ProfSpace /></Guard>} />
        <Route path="/coach/club" element={<Guard roles={["COACH", "PRESIDENT", "BUREAU"]}><ClubPlan /></Guard>} />
        <Route path="/coach/club/partenaires" element={<Guard roles={["COACH", "PRESIDENT", "BUREAU"]}><SponsorsPage /></Guard>} />
        <Route path="/president" element={<Guard roles={["PRESIDENT"]}><PresidentPage /></Guard>} />
        <Route path="/president/apercu" element={<Guard roles={["PRESIDENT"]}><PresidentAdultPreview /></Guard>} />
        <Route path="/president/apercu-prof" element={<Guard roles={["PRESIDENT"]}><ProfSpace preview /></Guard>} />
        <Route path="/coach/prof" element={<Guard roles={["COACH"]}><ProfSpace /></Guard>} />
        <Route path="/espace" element={<Guard roles={["ADULT"]}><AdultSpace /></Guard>} />
        <Route path="/suivi" element={<Guard roles={["GUARDIAN", "YOUTH"]}><Suivi /></Guard>} />
        <Route path="/suivi/:id/bulletin/:season/:t" element={<Guard roles={["GUARDIAN", "YOUTH"]}><Bulletin /></Guard>} />
        <Route path="*" element={<Notice eyebrow="Erreur 404" title="Page introuvable" action={<BackLink fallback="/" className="btn-clay no-underline">← Retour</BackLink>}>Cette adresse n'existe pas ou a changé.</Notice>} />
      </Routes>
      </Suspense>
    </Layout>
  );
}
