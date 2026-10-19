import { addDays, buildPlanning, hourlyStarts, overlaps, weekdayOf } from "../src/profs/planning";

describe("Planning d'un professeur : créneaux d'une heure", () => {
  it("découpe une disponibilité en heures pleines et ignore le reste", () => {
    expect(hourlyStarts("18:00", "20:00")).toEqual(["18:00", "19:00"]);
    expect(hourlyStarts("09:30", "12:00")).toEqual(["09:30", "10:30"]); // 11:30-12:00 est trop court
    expect(hourlyStarts("18:00", "18:30")).toEqual([]);
  });
  it("deux cours d'une heure se chevauchent s'ils commencent à moins d'une heure d'écart", () => {
    expect(overlaps("18:00", "18:30")).toBe(true); expect(overlaps("18:00", "19:00")).toBe(false); expect(overlaps("19:00", "18:00")).toBe(false);
  });
  it("jour de la semaine et dates : lundi = 0", () => {
    expect(weekdayOf("2026-10-19")).toBe(0); expect(weekdayOf("2026-10-25")).toBe(6); expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
  it("planning : jours de la semaine + dates précises, créneaux pris marqués, délai de 12 h, 28 jours maximum", () => {
    const now = { date: "2026-10-19", minutes: 17 * 60 }; // lundi 17 h
    const avail = [{ weekday: 0, date: null, start: "18:00", end: "20:00" }, { weekday: 2, date: null, start: "09:00", end: "11:00" }, { weekday: null, date: "2026-10-22", start: "14:00", end: "15:00" }];
    const days = buildPlanning(avail, [{ date: "2026-10-21", time: "09:00" }], now, false);
    expect(days.find((d) => d.date === "2026-10-19")).toBeUndefined(); // lundi 18 h : dans moins de 12 h
    expect(days.find((d) => d.date === "2026-10-21")!.slots).toEqual([{ time: "09:00", end: "10:00", free: false }, { time: "10:00", end: "11:00", free: true }]);
    expect(days.find((d) => d.date === "2026-10-22")!.slots).toEqual([{ time: "14:00", end: "15:00", free: true }]);
    expect(days.find((d) => d.date === "2026-10-26")!.slots.map((s) => s.time)).toEqual(["18:00", "19:00"]); // lundi suivant
    expect(days[days.length - 1].date <= "2026-11-16").toBe(true); // pas au-delà de 28 jours
    // un cours à 18:30 (proposé par le professeur) bloque aussi 18:00 et 19:00
    const clash = buildPlanning([{ weekday: 0, date: null, start: "18:00", end: "20:00" }], [{ date: "2026-10-26", time: "18:30" }], now, false);
    expect(clash.find((d) => d.date === "2026-10-26")!.slots.map((s) => s.free)).toEqual([false, false]);
  });
  it("vacances scolaires et jours fériés : pas de créneau « chaque semaine » si le professeur ne travaille pas ces jours-là, sauf une date précise qu'il a ajoutée", () => {
    const now = { date: "2026-10-19", minutes: 8 * 60 };
    const avail = [{ weekday: 2, date: null, start: "18:00", end: "20:00" }, { weekday: null, date: "2026-10-28", start: "10:00", end: "11:00" }];
    const off = buildPlanning(avail, [], now, true); // Toussaint : du 17 octobre au 1er novembre (zone C)
    expect(off.find((d) => d.date === "2026-10-28")!.slots.map((x) => x.time)).toEqual(["10:00"]); // seulement la date précise
    expect(off.find((d) => d.date === "2026-11-04")!.slots.map((x) => x.time)).toEqual(["18:00", "19:00"]); // la semaine d'après
    const on = buildPlanning(avail, [], now, false);
    expect(on.find((d) => d.date === "2026-10-28")!.slots.map((x) => x.time)).toEqual(["10:00", "18:00", "19:00"]);
  });
});
