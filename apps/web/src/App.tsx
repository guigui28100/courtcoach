import { Route, Routes } from "react-router-dom";
import { Guard } from "./components/Guard";
import { Layout } from "./components/Layout";
import { Centre, CoachHome } from "./pages/Coach";
import ChangePassword from "./pages/ChangePassword";
import Connexion from "./pages/Connexion";
import Home from "./pages/Home";
import Installation from "./pages/Installation";
import Invitation from "./pages/Invitation";
import { AdultSpace, FamilySpace } from "./pages/Member";
import PlayerDetail from "./pages/PlayerDetail";
import { Authorization, Privacy } from "./pages/Static";

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
        <Route path="/coach/centre" element={<Guard roles={["COACH"]}><Centre /></Guard>} />
        <Route path="/coach/centre/:id" element={<Guard roles={["COACH"]}><PlayerDetail /></Guard>} />
        <Route path="/espace" element={<Guard roles={["ADULT"]}><AdultSpace /></Guard>} />
        <Route path="/suivi" element={<Guard roles={["GUARDIAN", "YOUTH"]}><FamilySpace /></Guard>} />
        <Route path="*" element={<p className="p-10 text-center">Page introuvable.</p>} />
      </Routes>
    </Layout>
  );
}
