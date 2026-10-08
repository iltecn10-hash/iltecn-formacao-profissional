import type { LabLessonSeed, LabModuleSeed } from "./types";
import { module1 } from "./module1";
import { module2 } from "./module2";
import { module3 } from "./module3";
import { module4 } from "./module4";
import { module5 } from "./module5";
import { module6 } from "./module6";

export * from "./types";

export const LAB_TRACK = {
  slug: "primeiros-passos-no-computador",
  name: "ILTECN LAB — Primeiros Passos no Computador",
  subtitle: "Aprendendo a usar o computador de um jeito fácil, divertido e seguro.",
  description:
    "Um programa prático criado para ensinar crianças e iniciantes a utilizar o computador desde os primeiros movimentos do mouse até a criação do seu primeiro projeto digital.",
  category: "Alfabetização Digital",
  audienceLabel: "Ensino Fundamental / Iniciante",
  workloadHours: 30,
  lessonCount: 30,
} as const;

export const LAB_MODULES: LabModuleSeed[] = [module1, module2, module3, module4, module5, module6];

export const LAB_LESSONS: LabLessonSeed[] = LAB_MODULES.flatMap((m) => m.lessons);

/** Número da aula final (usada para emitir o certificado). */
export const FINAL_LESSON_NUMBER = 30;
