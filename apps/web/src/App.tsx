import { Route, Routes, useParams } from "react-router-dom";
import { BackLink } from "./components/ui";
import { useAuth } from "./auth";
import { Guard } from "./components/Guard";
import { Layout } from "./components/Layout";
import { AdultsPage, Centre, CoachHome } from "./pages/Coach";
import Bulletin from "./pages/Bulletin";
import TournamentReportPrint from "./pages/TournamentReportPrint";
import TrainerPreview from "./pages/TrainerPreview";
import FinDeCours from "./pages/FinDeCours";
import ChangePassword from "./pages/ChangePassword";
import Connexion from "./pages/Connexion";
import Home from "./pages/Home";
import Installation from "./pages/Installation";
import Invitation from "./pages/Invitation";
import { AdultPreview, AdultSpace } from "./pages/Member";
import { ProfSpace } from "./pages/Prof";
import Securite from "./pages/Securite";
import VideoReview from "./pages/VideoReview";
import YouthSpace from "./pages/Youth";
import PlayerDetail from "./pages/PlayerDetail";
import { Authorization, Privacy } from "./pages/Static";

// Les parents voient l'espace sobre ; le jeune voit son univers « galaxie ».
function Apercu() { const { id = "" } = useParams(); return <YouthSpace previewId={id} />; }
function Suivi() { return <YouthSpace />; } // un seul espace : celui de l'enfant (le compte du parent l'ouvre, avec en plus ses rubriques de parent)

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/installation" element={<Installation />} />
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/mot-de-passe" element={<ChangePassword />} />
        <Route path="/invitation/:token" element={<Invitation />} />
        <Route path="/confidentialite" element={<Privacy />} />
        <Route path="/autorisation" element={<Authorization />} />
        <Route path="/coach" element={<Guard roles={["COACH"]}><CoachHome /></Guard>} />
        <Route path="/coach/adultes/apercu" element={<Guard roles={["COACH"]}><AdultPreview /></Guard>} />
        <Route path="/coach/adultes" element={<Guard roles={["COACH"]}><AdultsPage /></Guard>} />
        <Route path="/coach/securite" element={<Guard roles={["COACH", "TRAINER"]}><Securite /></Guard>} />
        <Route path="/coach/centre/apercu-entraineur" element={<Guard roles={["COACH"]}><TrainerPreview /></Guard>} />
        <Route path="/coach/centre" element={<Guard roles={["COACH", "TRAINER"]}><Centre /></Guard>} />
        <Route path="/coach/centre/fin-de-cours" element={<Guard roles={["COACH", "TRAINER"]}><FinDeCours /></Guard>} />
        <Route path="/coach/centre/:id" element={<Guard roles={["COACH", "TRAINER"]}><PlayerDetail /></Guard>} />
        <Route path="/coach/centre/:id/apercu" element={<Guard roles={["COACH", "TRAINER"]}><Apercu /></Guard>} />
        <Route path="/coach/videos/:id" element={<Guard roles={["COACH", "TRAINER"]}><VideoReview /></Guard>} />
        <Route path="/coach/centre/:id/bilan-tournoi/:rid" element={<Guard roles={["COACH"]}><TournamentReportPrint /></Guard>} />
        <Route path="/coach/centre/:id/bulletin/:season/:t" element={<Guard roles={["COACH", "TRAINER"]}><Bulletin /></Guard>} />
        <Route path="/coach/adultes/apercu-prof" element={<Guard roles={["COACH"]}><ProfSpace preview /></Guard>} />
        <Route path="/prof" element={<Guard roles={["TRAINER"]}><ProfSpace /></Guard>} />
        <Route path="/espace" element={<Guard roles={["ADULT"]}><AdultSpace /></Guard>} />
        <Route path="/suivi" element={<Guard roles={["GUARDIAN", "YOUTH"]}><Suivi /></Guard>} />
        <Route path="/suivi/:id/bulletin/:season/:t" element={<Guard roles={["GUARDIAN", "YOUTH"]}><Bulletin /></Guard>} />
        <Route path="*" element={<div className="grid justify-items-center gap-3 p-10 text-center"><p className="m-0 text-lg">Page introuvable.</p><BackLink fallback="/" className="btn-clay no-underline">← Retour</BackLink></div>} />
      </Routes>
    </Layout>
  );
}
