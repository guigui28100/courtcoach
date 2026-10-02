import request from "supertest";
process.env.NODE_ENV = "test";
process.env.TEST_THROTTLE = "1";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret-123456";
import { createApp } from "../src/app.factory";

describe("Limitation des tentatives", () => {
  it("bloque les essais de connexion trop rapprochés (429)", async () => {
    const app = await createApp(); await app.init();
    const codes: number[] = [];
    for (let i = 0; i < 14; i++) codes.push((await request(app.getHttpServer()).post("/api/auth/login").set({ Origin: "http://localhost:5173" }).send({ email: "x@exemple.fr", password: "mauvais-mot-de-passe" })).status);
    expect(codes).toContain(429);
    await app.close();
  });
});
