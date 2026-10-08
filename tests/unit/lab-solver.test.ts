import { describe, it, expect } from "vitest";
import { LAB_LESSONS } from "@/lib/lab/content";
import { gradeActivity } from "@/lib/lab/activities";
import { solve } from "../setup/labSolver";

describe("gabarito do conteúdo", () => {
  it("toda atividade do programa é resolvível com a resposta correta", () => {
    const failures: string[] = [];
    for (const l of LAB_LESSONS)
      for (const a of l.activities) {
        const r = gradeActivity(a.kind, a.config, solve(a.kind, a.config), "seed");
        if (!r.correct) failures.push(`${a.code} (${a.kind})`);
      }
    expect(failures).toEqual([]);
  });

  it("uma resposta vazia/errada nunca é aceita", () => {
    for (const l of LAB_LESSONS)
      for (const a of l.activities) {
        if (a.kind === "gesture") continue;
        const r = gradeActivity(a.kind, a.config, { nada: true }, "seed");
        expect(r.correct).toBe(false);
      }
  });
});
