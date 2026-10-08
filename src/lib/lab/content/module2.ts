import { activity, type LabModuleSeed } from "./types";

export const module2: LabModuleSeed = {
  name: "Dominando o Mouse",
  description: "Mover, clicar, dar duplo clique e arrastar: tudo o que o mouse sabe fazer.",
  lessons: [
    {
      number: 5,
      title: "Movimentando o mouse",
      context:
        "Quando você move o mouse na mesa, uma setinha move na tela. Essa setinha se chama ponteiro. Mova com calma e devagar.",
      objective: "Controlar o ponteiro com o mouse.",
      steps: [
        "Segure o mouse com a mão, sem apertar os botões.",
        "Mova o mouse para a esquerda e para a direita.",
        "Veja o ponteiro se mexer na tela.",
        "Leve o ponteiro até o lugar que você quiser.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a05-1", "gesture", "mouse", "practice", "Passe por cada bolinha", "Mova o ponteiro até cada bolinha colorida.", {
          mode: "move",
          targets: 5,
          hint: "Mova devagar, sem apertar nenhum botão.",
        }),
        activity("lab-a05-2", "choice", "mouse", "knowledge", "Como se chama a setinha?", "Escolha a resposta certa.", {
          question: "Como se chama a setinha que anda na tela?",
          display: "list",
          options: [
            { id: "a", text: "Ponteiro", emoji: "🖱️" },
            { id: "b", text: "Teclado", emoji: "⌨️" },
            { id: "c", text: "Impressora", emoji: "🖨️" },
          ],
          answer: ["a"],
          hint: "É a setinha que o mouse move.",
        }),
        activity("lab-a05-3", "gesture", "mouse", "challenge", "Todas as bolinhas", "Passe por todas as bolinhas sem pressa.", {
          mode: "move",
          targets: 8,
          hint: "Calma! Devagar você acerta mais.",
        }),
      ],
    },
    {
      number: 6,
      title: "Clique",
      context:
        "Clicar é apertar o botão esquerdo do mouse uma vez, rapidinho. Com o clique a gente escolhe botões e abre coisas.",
      objective: "Clicar com o botão esquerdo para escolher e abrir.",
      steps: [
        "Leve o ponteiro até o botão.",
        "Aperte o botão esquerdo do mouse uma vez.",
        "Solte e veja o que acontece.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a06-1", "gesture", "mouse", "practice", "Clique nas estrelas", "Clique em cada estrela que aparecer.", {
          mode: "click",
          targets: 5,
          hint: "Use o botão da ESQUERDA, um clique só.",
        }),
        activity("lab-a06-2", "choice", "mouse", "knowledge", "Qual botão clicar?", "Escolha a resposta certa.", {
          question: "Qual botão do mouse usamos para clicar?",
          display: "list",
          options: [
            { id: "a", text: "O botão da esquerda", emoji: "⬅️" },
            { id: "b", text: "O botão da direita", emoji: "➡️" },
          ],
          answer: ["a"],
          hint: "Para clicar, usamos o botão da esquerda.",
        }),
        activity("lab-a06-3", "gesture", "mouse", "challenge", "Desafio dos cliques", "Clique em todas as estrelas.", {
          mode: "click",
          targets: 8,
          hint: "Clique uma vez em cada alvo.",
        }),
      ],
    },
    {
      number: 7,
      title: "Duplo clique",
      context:
        "Duplo clique é clicar duas vezes bem rápido. Ele serve para abrir programas e pastas. Se for devagar demais, não funciona.",
      objective: "Dar duplo clique para abrir programas e pastas.",
      steps: [
        "Leve o ponteiro até a pasta.",
        "Clique duas vezes bem rápido, tipo tic-tic.",
        "Veja a pasta abrir.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a07-1", "choice", "mouse", "knowledge", "O que é duplo clique?", "Escolha a resposta certa.", {
          question: "O que é um duplo clique?",
          display: "list",
          options: [
            { id: "a", text: "Dois cliques bem rápidos", emoji: "⚡" },
            { id: "b", text: "Um clique bem devagar", emoji: "🐢" },
            { id: "c", text: "Apertar o teclado duas vezes", emoji: "⌨️" },
          ],
          answer: ["a"],
          hint: "São dois cliques, um logo depois do outro.",
        }),
        activity("lab-a07-2", "gesture", "mouse", "practice", "Abra as pastas", "Dê duplo clique em cada pasta.", {
          mode: "doubleclick",
          targets: 4,
          hint: "Clique duas vezes bem rápido.",
        }),
        activity("lab-a07-3", "gesture", "mouse", "challenge", "Desafio do duplo clique", "Abra todas as pastas com duplo clique.", {
          mode: "doubleclick",
          targets: 6,
          hint: "Não pare entre um clique e o outro.",
        }),
      ],
    },
    {
      number: 8,
      title: "Arrastar e soltar",
      context:
        "Arrastar é clicar, segurar o botão, mover o mouse e soltar. A gente usa para levar coisas de um lugar para outro.",
      objective: "Arrastar objetos e soltá-los no lugar certo.",
      steps: [
        "Clique no objeto e continue segurando o botão.",
        "Mova o mouse até o lugar desejado.",
        "Solte o botão para deixar o objeto lá.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a08-1", "order", "mouse", "knowledge", "Passos do arrastar", "Coloque os passos na ordem certa.", {
          items: ["Clicar e segurar o botão", "Mover o mouse", "Soltar o botão"],
          hint: "Primeiro clica e segura. Só solta no final.",
        }),
        activity("lab-a08-2", "drag", "mouse", "practice", "Frutas e animais", "Arraste cada figura até a sua caixa.", {
          items: [
            { id: "maca", label: "Maçã", emoji: "🍎" },
            { id: "banana", label: "Banana", emoji: "🍌" },
            { id: "cachorro", label: "Cachorro", emoji: "🐶" },
            { id: "gato", label: "Gato", emoji: "🐱" },
          ],
          zones: [
            { id: "frutas", label: "Frutas", emoji: "🧺" },
            { id: "animais", label: "Animais", emoji: "🐾" },
          ],
          answer: { maca: "frutas", banana: "frutas", cachorro: "animais", gato: "animais" },
          hint: "Segure o botão enquanto arrasta.",
        }),
        activity("lab-a08-3", "drag", "mouse", "challenge", "Organize a bagunça", "Arraste cada figura para a caixa certa.", {
          items: [
            { id: "uva", label: "Uva", emoji: "🍇" },
            { id: "peixe", label: "Peixe", emoji: "🐟" },
            { id: "bola", label: "Bola", emoji: "⚽" },
            { id: "melancia", label: "Melancia", emoji: "🍉" },
            { id: "carrinho", label: "Carrinho", emoji: "🚗" },
            { id: "passaro", label: "Pássaro", emoji: "🐦" },
          ],
          zones: [
            { id: "frutas", label: "Frutas", emoji: "🧺" },
            { id: "animais", label: "Animais", emoji: "🐾" },
            { id: "brinquedos", label: "Brinquedos", emoji: "🧸" },
          ],
          answer: {
            uva: "frutas",
            melancia: "frutas",
            peixe: "animais",
            passaro: "animais",
            bola: "brinquedos",
            carrinho: "brinquedos",
          },
          hint: "Pense: isso é de comer, é bicho ou é de brincar?",
        }),
      ],
    },
    {
      number: 9,
      title: "Desafio do mouse",
      context:
        "Agora vamos juntar tudo: mover, clicar, dar duplo clique e arrastar. Você já sabe tudo isso!",
      objective: "Mostrar que domina o mouse.",
      steps: [
        "Mova o ponteiro com calma.",
        "Clique uma vez para escolher.",
        "Dê duplo clique para abrir.",
        "Arraste e solte no lugar certo.",
      ],
      estimatedMinutes: 30,
      points: 60,
      activities: [
        activity("lab-a09-1", "gesture", "mouse", "challenge", "Missão do mouse", "Clique e dê duplo clique nos alvos que aparecerem.", {
          mode: "mixed",
          targets: 6,
          hint: "Cada alvo diz se é um clique ou um duplo clique.",
        }),
        activity("lab-a09-2", "drag", "mouse", "challenge", "Arraste até o final", "Arraste cada objeto até a caixa certa.", {
          items: [
            { id: "sol", label: "Sol", emoji: "☀️" },
            { id: "lua", label: "Lua", emoji: "🌙" },
            { id: "casa", label: "Casa", emoji: "🏠" },
            { id: "escola", label: "Escola", emoji: "🏫" },
          ],
          zones: [
            { id: "ceu", label: "No céu", emoji: "☁️" },
            { id: "cidade", label: "Na cidade", emoji: "🏙️" },
          ],
          answer: { sol: "ceu", lua: "ceu", casa: "cidade", escola: "cidade" },
          hint: "O sol e a lua ficam no céu.",
        }),
        activity("lab-a09-3", "gesture", "mouse", "challenge", "Desafio de coordenação", "Passe por todas as bolinhas sem pressa.", {
          mode: "move",
          targets: 8,
          hint: "Devagar e sempre!",
        }),
      ],
    },
  ],
};
