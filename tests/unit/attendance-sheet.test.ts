import { describe, it, expect } from "vitest";
import { sheetMonth, parseAttendanceSheet, normalizeName, matchNames } from "@/lib/attendance-sheet";

describe("sheetMonth", () => {
  it("reads Russian, English, Mongolian and numeric sheet names", () => {
    expect(["октябрь", " Ноябрь ", "ДЕКАБРЬ", "окт", "сент.", "May"].map(sheetMonth)).toEqual([10, 11, 12, 10, 9, 5]);
    expect(["10-р сар", "9 сар", "1-р сар", "3", "2026-11", "12р сар"].map(sheetMonth)).toEqual([10, 9, 1, 3, 11, 12]);
    expect(["Sheet1", "13", "0", "", "ок"].map(sheetMonth)).toEqual([null, null, null, null, null]);
  });
});

describe("parseAttendanceSheet", () => {
  const data = [
    ["№", "ФИО ребёнка", 1, 2, 5, "6.0", "дней"],
    [1, "Дулам  Сувд ", null, "н", "Н", "", 2],
    [2, "Дорж Тод", "б", " h ", "x", null, 1],
    [null, null, null, null, null, null, null],
    ["Итого", 513, 23, 24, 25, 22, null],
  ];
  it("finds the day columns, reads blank as present, «н» as absent, «б» as sick, and skips totals", () => {
    const p = parseAttendanceSheet("октябрь", data);
    expect(p.month).toBe(10);
    expect(p.days).toEqual([1, 2, 5, 6]);
    expect(p.rows).toEqual([
      { name: "Дулам Сувд", marks: { 1: "PRESENT", 2: "ABSENT", 5: "ABSENT", 6: "PRESENT" }, unknownMarks: 0 },
      { name: "Дорж Тод", marks: { 1: "SICK", 2: "ABSENT", 6: "PRESENT" }, unknownMarks: 1 },
    ]);
  });
  it("copes with a title row above the header and a totals row labelled in the name column", () => {
    const p = parseAttendanceSheet("11-р сар", [["1Д анги"], [], ["№", "Нэр", 9, 10, 12], [1, "Сарнай", null, "н", null], [null, "Нийт", 1, 0, 1]]);
    expect([p.month, p.days, p.rows.map((r) => r.name)]).toEqual([11, [9, 10, 12], ["Сарнай"]]);
  });
  it("returns no days for a sheet without a header of day numbers", () => {
    expect(parseAttendanceSheet("notes", [["a", "b"], ["c", 1]])).toEqual({ sheet: "notes", month: null, days: [], rows: [] });
  });
});

describe("matchNames", () => {
  const students = [
    { id: "a", name: "Ганболд Номин" },
    { id: "b", name: "Мөнхбат Өлзий" },
    { id: "c", name: "Дорж Тод" },
    { id: "d", name: "Дорж Тэмүүлэн" },
  ];
  it("ignores case, spacing and ө/ү typed as о/у", () => {
    expect(normalizeName("  МУНХБАТ   Улзий ")).toBe(normalizeName("Мөнхбат Өлзий"));
    const { matched, unmatched } = matchNames(["мунхбат улзий", "Дорж Тод"], students);
    expect([matched.get("мунхбат улзий"), matched.get("Дорж Тод")]).toEqual([{ ...students[1], approximate: false }, { ...students[2], approximate: false }]);
    expect(unmatched).toEqual([]);
    expect(matchNames(["Ганболд Нумин"], students).matched.get("Ганболд Нумин")).toEqual({ ...students[0], approximate: false }); // о/у are one letter
  });
  it("accepts a one- or two-letter typo when it points at exactly one remaining student, and reports the rest", () => {
    const { matched, unmatched } = matchNames(["Ганболд Номн", "Огт Өөр Нэртэй Хүүхэд", "Дорж Тоо"], students);
    expect(matched.get("Ганболд Номн")).toEqual({ ...students[0], approximate: true });
    expect(matched.get("Дорж Тоо")).toEqual({ ...students[2], approximate: true });
    expect(unmatched).toEqual(["Огт Өөр Нэртэй Хүүхэд"]);
  });
  it("never guesses between two equally close students, or for very short names", () => {
    const twins = [{ id: "x", name: "Дорж Тод" }, { id: "y", name: "Дорж Тоо" }];
    expect(matchNames(["Дорж Тоб"], twins).unmatched).toEqual(["Дорж Тоб"]);
    expect(matchNames(["Болд"], [{ id: "z", name: "Бол" }]).unmatched).toEqual(["Болд"]);
  });
});
