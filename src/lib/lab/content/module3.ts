import { activity, type LabModuleSeed } from "./types";

const FRASE = {
  mustStartUpper: true,
  mustEndPunct: true,
  minWords: 3,
} as const;

export const module3: LabModuleSeed = {
  name: "Dominando o Teclado",
  description: "Letras, números e teclas especiais para escrever as suas primeiras frases.",
  lessons: [
    {
      number: 10,
      title: "Conhecendo as teclas",
      context:
        "O teclado tem letras, números e teclas especiais. Cada tecla especial faz um trabalho diferente. Vamos conhecer as principais.",
      objective: "Reconhecer as teclas Enter, Espaço, Backspace, Shift, Caps Lock, Tab, Esc e as setas.",
      steps: [
        "As letras ficam no meio do teclado. Os números ficam na fileira de cima.",
        "Enter muda de linha. Espaço separa as palavras.",
        "Backspace apaga a letra que veio antes.",
        "Shift e Caps Lock fazem letra maiúscula. As setas movem o cursor.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a10-1", "choice", "teclado", "knowledge", "Qual tecla apaga?", "Qual tecla apaga a letra que acabei de escrever?", {
          question: "Qual tecla apaga a letra que acabei de escrever?",
          display: "keys",
          options: [
            { id: "enter", text: "Enter" },
            { id: "espaco", text: "Espaço" },
            { id: "backspace", text: "Backspace" },
            { id: "shift", text: "Shift" },
          ],
          answer: ["backspace"],
          hint: "Ela fica no canto de cima, à direita, e tem uma setinha para a esquerda.",
        }),
        activity("lab-a10-2", "match", "teclado", "practice", "Cada tecla tem um trabalho", "Ligue cada tecla ao que ela faz.", {
          pairs: [
            { left: "Enter", right: "Vai para a linha de baixo", emoji: "↩️" },
            { left: "Espaço", right: "Separa as palavras", emoji: "▫️" },
            { left: "Backspace", right: "Apaga a letra anterior", emoji: "⌫" },
            { left: "Shift", right: "Faz letra maiúscula", emoji: "⬆️" },
            { left: "Caps Lock", right: "Deixa todas as letras maiúsculas", emoji: "🔒" },
            { left: "Esc", right: "Sai ou cancela", emoji: "🚪" },
            { left: "Setas", right: "Movem o cursor", emoji: "➡️" },
          ],
          hint: "Pense no que acontece quando você aperta cada tecla.",
        }),
        activity("lab-a10-3", "choice", "teclado", "challenge", "Tecla do espaço", "Qual tecla coloca espaço entre as palavras?", {
          question: "Qual tecla coloca espaço entre as palavras?",
          display: "keys",
          options: [
            { id: "espaco", text: "Espaço" },
            { id: "tab", text: "Tab" },
            { id: "esc", text: "Esc" },
            { id: "caps", text: "Caps Lock" },
          ],
          answer: ["espaco"],
          hint: "É a tecla comprida, bem grande, de baixo.",
        }),
      ],
    },
    {
      number: 11,
      title: "Letras e números",
      context:
        "Para escrever, a gente aperta as teclas de letras e de números. Escreva devagar, olhando para a tela.",
      objective: "Digitar nome, idade, cidade e números simples.",
      steps: [
        "Clique no campo de escrever.",
        "Aperte as teclas das letras com calma.",
        "Os números ficam na fileira de cima do teclado.",
        "Confira o que escreveu olhando para a tela.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a11-1", "type", "teclado", "practice", "Escreva sobre você", "Digite o seu nome, a sua idade e a sua cidade.", {
          fields: [
            { id: "nome", label: "Seu nome", mode: "free", minChars: 2 },
            { id: "idade", label: "Sua idade (só números)", mode: "free", digitsOnly: true, minChars: 1 },
            { id: "cidade", label: "Sua cidade", mode: "free", minChars: 2 },
          ],
          hint: "Clique no campo e aperte as teclas devagar.",
        }),
        activity("lab-a11-2", "type", "teclado", "practice", "Copie os números", "Digite os números do jeito que estão escritos.", {
          fields: [{ id: "numeros", label: "Digite os números", mode: "copy", target: "1 2 3 4 5 6 7 8 9 10" }],
          hint: "Os números ficam na fileira de cima do teclado.",
        }),
        activity("lab-a11-3", "choice", "teclado", "knowledge", "Onde ficam os números?", "Escolha a resposta certa.", {
          question: "Onde ficam os números no teclado?",
          display: "list",
          options: [
            { id: "a", text: "Na fileira de cima", emoji: "🔢" },
            { id: "b", text: "Na fileira de baixo", emoji: "⬇️" },
            { id: "c", text: "Só no mouse", emoji: "🖱️" },
          ],
          answer: ["a"],
          hint: "Olhe a fileira do 1 ao 0.",
        }),
      ],
    },
    {
      number: 12,
      title: "Espaço, Enter e Backspace",
      context:
        "O Espaço separa as palavras. O Enter vai para a linha de baixo. O Backspace apaga o que escrevemos errado. Todo mundo erra e corrige!",
      objective: "Usar Espaço, Enter e Backspace para escrever e corrigir.",
      steps: [
        "Aperte Espaço entre uma palavra e outra.",
        "Aperte Enter para ir para a linha de baixo.",
        "Errou uma letra? Aperte Backspace e escreva de novo.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a12-1", "type", "teclado", "practice", "Espaço entre as palavras", "Copie a frase com os espaços certos.", {
          fields: [{ id: "frase", label: "Copie a frase", mode: "copy", target: "Eu gosto de aprender" }],
          hint: "Aperte a tecla Espaço entre cada palavra.",
        }),
        activity("lab-a12-2", "type", "teclado", "practice", "Corrija a palavra", "A palavra tem uma letra a mais: CASSA. Apague o erro e escreva a palavra certa.", {
          fields: [{ id: "palavra", label: "Escreva a palavra certa: CASA", mode: "copy", target: "casa" }],
          hint: "Use o Backspace para apagar a letra que sobrou.",
        }),
        activity("lab-a12-3", "choice", "teclado", "challenge", "Linha de baixo", "Qual tecla leva o texto para a linha de baixo?", {
          question: "Qual tecla leva o texto para a linha de baixo?",
          display: "keys",
          options: [
            { id: "enter", text: "Enter" },
            { id: "backspace", text: "Backspace" },
            { id: "esc", text: "Esc" },
            { id: "tab", text: "Tab" },
          ],
          answer: ["enter"],
          hint: "É uma tecla grande, perto das letras, do lado direito.",
        }),
      ],
    },
    {
      number: 13,
      title: "Maiúsculas e caracteres",
      context:
        "Nomes e começos de frases começam com letra maiúscula. Para isso usamos o Shift ou o Caps Lock. No final da frase, colocamos um ponto.",
      objective: "Usar maiúsculas e pontuação básica.",
      steps: [
        "Segure o Shift e aperte uma letra: ela fica maiúscula.",
        "O Caps Lock deixa todas as letras maiúsculas até você apertar de novo.",
        "No fim da frase, coloque o ponto final.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a13-1", "choice", "teclado", "knowledge", "Maiúscula com a tecla certa", "Qual tecla ajuda a fazer UMA letra maiúscula?", {
          question: "Qual tecla ajuda a fazer UMA letra maiúscula?",
          display: "keys",
          options: [
            { id: "shift", text: "Shift" },
            { id: "enter", text: "Enter" },
            { id: "esc", text: "Esc" },
            { id: "espaco", text: "Espaço" },
          ],
          answer: ["shift"],
          hint: "Segure essa tecla e aperte a letra.",
        }),
        activity("lab-a13-2", "type", "teclado", "practice", "Copie com maiúsculas", "Copie a frase com maiúsculas e ponto final.", {
          fields: [{ id: "frase", label: "Copie a frase", mode: "copy", target: "Maria e Pedro moram na Amazônia." }],
          hint: "Use o Shift para o M, o P e o A.",
        }),
        activity("lab-a13-3", "type", "teclado", "challenge", "Sua frase certinha", "Escreva uma frase que comece com letra maiúscula e termine com ponto.", {
          fields: [
            {
              id: "frase",
              label: "Escreva uma frase",
              mode: "free",
              ...FRASE,
              minChars: 8,
              placeholder: "Comece com letra maiúscula e termine com ponto.",
            },
          ],
          hint: "Exemplo: Eu gosto de brincar.",
        }),
      ],
    },
    {
      number: 14,
      title: "Minhas primeiras frases",
      context:
        "Agora é hora de escrever frases inteiras! Use letra maiúscula no começo, espaço entre as palavras e ponto no final.",
      objective: "Escrever frases simples com espaços, maiúsculas e correção.",
      steps: [
        "Comece a frase com letra maiúscula.",
        "Coloque espaço entre as palavras.",
        "Errou? Use o Backspace para corrigir.",
        "Termine a frase com ponto.",
      ],
      estimatedMinutes: 30,
      points: 60,
      activities: [
        activity("lab-a14-1", "choice", "teclado", "knowledge", "Qual frase está certinha?", "Escolha a frase escrita do jeito certo.", {
          question: "Qual frase está escrita do jeito certo?",
          display: "list",
          options: [
            { id: "a", text: "meu nome é ana", emoji: "❌" },
            { id: "b", text: "Meu nome é Ana.", emoji: "✅" },
            { id: "c", text: "MEU NOME É ANA", emoji: "❌" },
          ],
          answer: ["b"],
          hint: "A frase certa começa com maiúscula e termina com ponto.",
        }),
        activity("lab-a14-2", "type", "teclado", "practice", "Minhas primeiras frases", "Escreva as frases abaixo.", {
          fields: [
            {
              id: "nome",
              label: "Escreva uma frase com o seu nome",
              mode: "free",
              ...FRASE,
              placeholder: "Meu nome é…",
            },
            { id: "f2", label: "Copie a frase", mode: "copy", target: "Eu estou aprendendo computador." },
            { id: "f3", label: "Copie a frase", mode: "copy", target: "Eu gosto de tecnologia." },
          ],
          hint: "Cuidado com a letra maiúscula e com o ponto final.",
        }),
        activity("lab-a14-3", "type", "teclado", "challenge", "Desafio das frases", "Escreva uma frase sobre o que você gosta.", {
          fields: [
            {
              id: "gosto",
              label: "O que você gosta de fazer?",
              mode: "free",
              ...FRASE,
              minChars: 10,
            },
          ],
          hint: "Exemplo: Eu gosto de jogar bola com meus amigos.",
        }),
      ],
    },
  ],
};
