import type { LabSkill } from "@/lib/lab/activities";

export type LabAchievementCriteria =
  | { type: "track_started" }
  | { type: "mission_completed"; lesson: number }
  /** Todas as atividades da habilidade, até a aula `uptoLesson` (inclusive). */
  | { type: "skill_completed"; skill: LabSkill; uptoLesson: number }
  | { type: "challenges_completed" }
  | { type: "track_completed" };

export interface LabAchievementSeed {
  code: string;
  name: string;
  description: string;
  icon: string;
  criteria: LabAchievementCriteria;
}

export const LAB_ACHIEVEMENTS: LabAchievementSeed[] = [
  {
    code: "lab_primeiro_acesso",
    name: "Primeiro acesso",
    description: "Você entrou no ILTECN LAB pela primeira vez!",
    icon: "👋",
    criteria: { type: "track_started" },
  },
  {
    code: "lab_mestre_mouse",
    name: "Mestre do Mouse",
    description: "Você completou todas as atividades do mouse.",
    icon: "🖱️",
    criteria: { type: "skill_completed", skill: "mouse", uptoLesson: 9 },
  },
  {
    code: "lab_pequeno_digitador",
    name: "Pequeno Digitador",
    description: "Você completou as atividades do teclado.",
    icon: "⌨️",
    criteria: { type: "skill_completed", skill: "teclado", uptoLesson: 14 },
  },
  {
    code: "lab_mestre_letras",
    name: "Mestre das Letras",
    description: "Você digitou as suas primeiras frases.",
    icon: "✍️",
    criteria: { type: "mission_completed", lesson: 14 },
  },
  {
    code: "lab_organizador_digital",
    name: "Organizador Digital",
    description: "Você criou as suas primeiras pastas.",
    icon: "🗂️",
    criteria: { type: "mission_completed", lesson: 17 },
  },
  {
    code: "lab_guardiao_arquivos",
    name: "Guardião dos Arquivos",
    description: "Você aprendeu a salvar e a organizar arquivos.",
    icon: "🛡️",
    criteria: { type: "mission_completed", lesson: 20 },
  },
  {
    code: "lab_artista_digital",
    name: "Artista Digital",
    description: "Você terminou o seu desenho.",
    icon: "🎨",
    criteria: { type: "mission_completed", lesson: 21 },
  },
  {
    code: "lab_escritor_digital",
    name: "Escritor Digital",
    description: "Você escreveu o seu primeiro texto.",
    icon: "📖",
    criteria: { type: "mission_completed", lesson: 22 },
  },
  {
    code: "lab_criador_visual",
    name: "Criador Visual",
    description: "Você aprendeu a usar imagens e a deixar o documento bonito.",
    icon: "🖼️",
    criteria: { type: "mission_completed", lesson: 24 },
  },
  {
    code: "lab_explorador_internet",
    name: "Explorador da Internet",
    description: "Você completou as atividades de pesquisa.",
    icon: "🧭",
    criteria: { type: "mission_completed", lesson: 28 },
  },
  {
    code: "lab_guardiao_digital",
    name: "Guardião Digital",
    description: "Você concluiu a aula de segurança digital.",
    icon: "🔒",
    criteria: { type: "mission_completed", lesson: 29 },
  },
  {
    code: "lab_navegador_seguro",
    name: "Navegador Seguro",
    description: "Você completou todas as atividades de segurança.",
    icon: "⛵",
    criteria: { type: "skill_completed", skill: "seguranca", uptoLesson: 29 },
  },
  {
    code: "lab_criador_digital",
    name: "Criador Digital",
    description: "Você concluiu o seu primeiro projeto digital.",
    icon: "🏗️",
    criteria: { type: "mission_completed", lesson: 26 },
  },
  {
    code: "lab_desafiante",
    name: "Desafiante",
    description: "Você completou todos os desafios do programa.",
    icon: "🥇",
    criteria: { type: "challenges_completed" },
  },
  {
    code: "lab_mestre_digital",
    name: "Mestre Digital",
    description: "Você concluiu o programa Primeiros Passos no Computador!",
    icon: "🏆",
    criteria: { type: "track_completed" },
  },
];
