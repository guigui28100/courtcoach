import { INestApplication, RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { ModulesContainer, Reflector } from "@nestjs/core";
import { hash } from "@node-rs/argon2";
import request from "supertest";
import { Role } from "@prisma/client";
import { createApp } from "../src/app.factory";
import { PrismaService } from "../src/prisma/prisma.service";

process.env.NODE_ENV = "test";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret-123456";
const ORIGIN = { Origin: "http://localhost:5173" };
const PASSWORD = "un-mot-de-passe-solide-1";
const VERB: Record<number, string> = { [RequestMethod.GET]: "get", [RequestMethod.POST]: "post", [RequestMethod.PUT]: "put", [RequestMethod.PATCH]: "patch", [RequestMethod.DELETE]: "delete" };

// Filet de sécurité : TOUTES les routes du serveur sont listées automatiquement.
// Si quelqu'un en ajoute une sans protection (ou sans réserver au coach ce qui doit l'être), ce test échoue.
describe("Matrice des droits de toutes les routes", () => {
  let app: INestApplication; let prisma: PrismaService;
  const routes: { method: string; url: string; pub: boolean; roles?: Role[] }[] = [];

  beforeAll(async () => {
    app = await createApp(); await app.init(); prisma = app.get(PrismaService);
    const reflector = new Reflector();
    for (const mod of app.get(ModulesContainer).values()) {
      for (const w of mod.controllers.values()) {
        const ctrl = w.metatype as any; if (!ctrl?.prototype || Reflect.getMetadata(PATH_METADATA, ctrl) === undefined) continue;
        const base = String(Reflect.getMetadata(PATH_METADATA, ctrl) || "").replace(/^\/|\/$/g, "");
        for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
          const fn = ctrl.prototype[name]; const m = Reflect.getMetadata(METHOD_METADATA, fn); if (m === undefined || !VERB[m]) continue;
          const sub = String(Reflect.getMetadata(PATH_METADATA, fn) || "").replace(/^\/|\/$/g, "");
          routes.push({ method: VERB[m], url: "/api/" + [base, sub].filter(Boolean).join("/").replace(/:[A-Za-z]+/g, "x"), pub: !!reflector.getAllAndOverride("isPublic", [fn, ctrl]), roles: reflector.getAllAndOverride<Role[]>("roles", [fn, ctrl]) });
        }
      }
    }
    await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.user.deleteMany();
    for (const [email, role] of [["adulte@exemple.fr", Role.ADULT], ["parent@exemple.fr", Role.GUARDIAN], ["jeune@exemple.fr", Role.YOUTH]] as [string, Role][]) await prisma.user.create({ data: { email, role, passwordHash: await hash(PASSWORD) } });
  });
  afterAll(async () => { await prisma.auditLog.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.user.deleteMany(); await app.close(); });

  it("liste exactement les routes publiques attendues (rien d'autre n'est ouvert sans connexion)", () => {
    const pub = routes.filter((r) => r.pub).map((r) => `${r.method} ${r.url}`).sort();
    expect(pub).toEqual([
      "get /api/auth/invitations/x", "get /api/cron/purge", "get /api/health", "get /api/setup/status",
      "post /api/auth/invitations/accept", "post /api/auth/login", "post /api/auth/logout", "post /api/auth/refresh", "post /api/auth/signup", "post /api/setup/coach",
    ].sort());
    expect(routes.length).toBeGreaterThan(50);
  });

  it("toute autre route refuse une personne non connectée (401)", async () => {
    for (const r of routes.filter((x) => !x.pub)) {
      const res = await (request(app.getHttpServer()) as any)[r.method](r.url).set(ORIGIN).send({});
      expect([r.method, r.url, res.status]).toEqual([r.method, r.url, 401]);
    }
  });

  it("les routes réservées au coach refusent adulte, parent et jeune (403)", async () => {
    const who: [string, Role][] = [["adulte@exemple.fr", Role.ADULT], ["parent@exemple.fr", Role.GUARDIAN], ["jeune@exemple.fr", Role.YOUTH]];
    const coachOnly = routes.filter((r) => !r.pub && r.roles && r.roles.length === 1 && r.roles[0] === Role.COACH);
    expect(coachOnly.length).toBeGreaterThanOrEqual(4);
    for (const [email, role] of who) {
      const a = request.agent(app.getHttpServer()); await a.post("/api/auth/login").set(ORIGIN).send({ email, password: PASSWORD }).expect(200);
      for (const r of coachOnly) {
        const res = await (a as any)[r.method](r.url).set(ORIGIN).send({});
        expect([role, r.method, r.url, res.status]).toEqual([role, r.method, r.url, 403]);
      }
    }
  });

  it("l'espace Centre (joueurs) est fermé aux adultes sur toutes ses routes", async () => {
    const a = request.agent(app.getHttpServer()); await a.post("/api/auth/login").set(ORIGIN).send({ email: "adulte@exemple.fr", password: PASSWORD }).expect(200);
    const centre = routes.filter((r) => /^\/api\/(players|goals|matches)/.test(r.url));
    expect(centre.length).toBeGreaterThan(15);
    for (const r of centre) {
      const res = await (a as any)[r.method](r.url).set(ORIGIN).send({});
      expect([r.method, r.url, res.status]).toEqual([r.method, r.url, 403]);
    }
  });
});
