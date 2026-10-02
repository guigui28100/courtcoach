import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { Role } from "../types";

export const homeFor = (role: Role) => (role === "COACH" ? "/coach" : role === "ADULT" ? "/espace" : "/suivi");

// Réserve une page à certains rôles ; sinon on renvoie vers la connexion ou vers l'espace de la personne.
export function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <p className="p-8 text-center text-muted">Chargement…</p>;
  if (!me) return <Navigate to="/connexion" state={{ from: loc.pathname }} replace />;
  if (me.mustChangePassword) return <Navigate to="/mot-de-passe" replace />;
  if (!roles.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;
  return <>{children}</>;
}
