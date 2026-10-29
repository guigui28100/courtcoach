import { describe, expect, it } from "vitest";
import { check, clashing, DURATION, endOf, hm, snap, toMin, toTime } from "../../web/src/weekPlan";

const at = (h: number, m = 0) => h * 60 + m;
describe("planning de la semaine des entraîneurs : durées et demi-heures", () => {
  it("la fin se calcule d'après le type de cours", () => {
    expect(toTime(endOf(at(9), "ADULTES"))).toBe("10:30");
    expect(toTime(endOf(at(9, 30), "ECOLE"))).toBe("11:00");
    expect(toTime(endOf(at(10), "COMPETITION"))).toBe("11:30");
    expect(DURATION.ADULTES).toBe(90);
  });
  it("le point de dépôt est arrondi à la demi-heure la plus proche (pile entre deux : la suivante)", () => {
    expect(snap(at(9, 14))).toBe(at(9)); expect(snap(at(9, 15))).toBe(at(9, 30)); expect(snap(at(9, 44))).toBe(at(9, 30)); expect(snap(at(9, 46))).toBe(at(10));
  });
  it("déplacer un cours de 1 h 30 de 9 h à 9 h 30 : sa fin devient 11 h, et lui-même ne le gêne pas", () => {
    const b = [{ id: "a", weekday: 0, start: at(9), end: at(10, 30), kind: "ADULTES" as const, label: "Cours adultes" }];
    expect(check(b, 0, at(9, 30), endOf(at(9, 30), "ADULTES"), "a")).toEqual({ ok: true });
    expect(toTime(endOf(at(9, 30), "ADULTES"))).toBe("11:00");
  });
  it("hors horaires ou chevauchement : refusé avec la raison ; bout à bout et autre jour : permis", () => {
    const b = [{ id: "a", weekday: 0, start: at(9), end: at(10, 30), kind: "ADULTES" as const, label: "Cours adultes" }];
    expect(check(b, 0, at(8, 30), at(10), undefined).ok).toBe(false);
    expect(check(b, 0, at(21), at(22, 30), undefined).ok).toBe(false);
    expect(check(b, 0, at(10), at(11, 30), undefined)).toMatchObject({ ok: false, reason: expect.stringContaining("chevauche") });
    expect(check(b, 0, at(10, 30), at(12), undefined).ok).toBe(true);
    expect(check(b, 1, at(9), at(10, 30), undefined).ok).toBe(true);
    expect(check(b, 0, at(20, 30), at(22), undefined).ok).toBe(true);
  });
  it("repère les anciens cours qui se chevauchent déjà et écrit les heures", () => {
    const l = [{ id: "a", weekday: 2, start: at(9), end: at(10), label: "" }, { id: "b", weekday: 2, start: at(9, 30), end: at(11), label: "" }, { id: "c", weekday: 2, start: at(11), end: at(12), label: "" }];
    expect([...clashing(l)].sort()).toEqual(["a", "b"]);
    expect(hm(at(9))).toBe("9 h"); expect(hm(at(10, 30))).toBe("10 h 30"); expect(toMin("10:30")).toBe(630);
  });
});
