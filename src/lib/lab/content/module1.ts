import { activity, type LabModuleSeed } from "./types";

export const module1: LabModuleSeed = {
  name: "Conhecendo o Computador",
  description: "O que é um computador, suas partes, como ligar, desligar e cuidar bem dele.",
  lessons: [
    {
      number: 1,
      title: "Bem-vindo ao computador",
      context:
        "O computador é uma ferramenta. Ele ajuda a gente a escrever, desenhar, pesquisar e aprender. Está na escola, no mercado, no banco e em muitos lugares.",
      objective: "Entender o que é um computador e para que ele serve.",
      steps: [
        "Olhe para a tela: ela mostra o que o computador está fazendo.",
        "Olhe para o mouse: ele move a setinha na tela.",
        "Olhe para o teclado: ele serve para escrever letras e números.",
        "Peça ao professor para ligar o computador e observe a tela acender.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a01-1", "choice", "computador", "knowledge", "O que é um computador?", "Escolha a resposta certa.", {
          question: "O que é um computador?",
          display: "list",
          options: [
            { id: "a", text: "Uma máquina que ajuda a gente a fazer tarefas", emoji: "💻" },
            { id: "b", text: "Um brinquedo que só toca música", emoji: "🧸" },
            { id: "c", text: "Um tipo de animal", emoji: "🐶" },
          ],
          answer: ["a"],
          hint: "O computador é uma ferramenta que ajuda a gente.",
        }),
        activity("lab-a01-2", "choice", "computador", "knowledge", "Onde usamos computadores?", "Marque TODOS os lugares onde existem computadores.", {
          question: "Onde usamos computadores?",
          multiple: true,
          display: "list",
          options: [
            { id: "escola", text: "Na escola", emoji: "🏫" },
            { id: "mercado", text: "No mercado", emoji: "🛒" },
            { id: "banco", text: "No banco", emoji: "🏦" },
            { id: "arvore", text: "Dentro de uma árvore", emoji: "🌳" },
          ],
          answer: ["escola", "mercado", "banco"],
          hint: "Pense em lugares onde as pessoas trabalham e estudam.",
        }),
        activity("lab-a01-3", "match", "computador", "challenge", "Mostre cada parte", "Ligue cada função à parte do computador.", {
          pairs: [
            { left: "Mostra as imagens", right: "Monitor", emoji: "📺" },
            { left: "Move a setinha", right: "Mouse", emoji: "🖱️" },
            { left: "Escreve letras e números", right: "Teclado", emoji: "⌨️" },
            { left: "Pensa e guarda tudo", right: "Computador", emoji: "🖥️" },
          ],
          hint: "O monitor é a tela. O mouse mexe a setinha.",
        }),
      ],
    },
    {
      number: 2,
      title: "Conhecendo as partes do computador",
      context:
        "O computador tem várias partes. Umas mandam ordens (entrada). Outras mostram o que o computador fez (saída).",
      objective: "Reconhecer monitor, gabinete, teclado, mouse, caixas de som, impressora, pendrive e webcam.",
      steps: [
        "O monitor é a tela. Ele mostra tudo.",
        "O gabinete é o cérebro do computador.",
        "O teclado e o mouse mandam ordens.",
        "As caixas de som tocam sons. A impressora coloca no papel. A webcam tira fotos. O pendrive guarda arquivos.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a02-1", "choice", "computador", "knowledge", "Qual é o mouse?", "Qual dessas figuras representa o mouse?", {
          question: "Qual dessas figuras é o mouse?",
          display: "cards",
          options: [
            { id: "mouse", text: "Mouse", emoji: "🖱️" },
            { id: "teclado", text: "Teclado", emoji: "⌨️" },
            { id: "monitor", text: "Monitor", emoji: "📺" },
            { id: "som", text: "Caixa de som", emoji: "🔊" },
          ],
          answer: ["mouse"],
          hint: "O mouse tem um botão e move a setinha.",
        }),
        activity("lab-a02-2", "match", "computador", "practice", "Cada parte tem um trabalho", "Ligue cada parte ao que ela faz.", {
          pairs: [
            { left: "Monitor", right: "Mostra as imagens", emoji: "📺" },
            { left: "Teclado", right: "Escreve letras e números", emoji: "⌨️" },
            { left: "Mouse", right: "Move a setinha", emoji: "🖱️" },
            { left: "Caixas de som", right: "Tocam os sons", emoji: "🔊" },
            { left: "Impressora", right: "Coloca no papel", emoji: "🖨️" },
            { left: "Webcam", right: "Tira fotos e vídeos", emoji: "📷" },
            { left: "Pendrive", right: "Guarda arquivos", emoji: "💾" },
            { left: "Gabinete", right: "É o cérebro do computador", emoji: "🖥️" },
          ],
          hint: "Pense no que cada parte faz para você.",
        }),
        activity("lab-a02-3", "drag", "computador", "challenge", "Entrada ou saída?", "Arraste cada parte para a caixa certa.", {
          items: [
            { id: "teclado", label: "Teclado", emoji: "⌨️" },
            { id: "mouse", label: "Mouse", emoji: "🖱️" },
            { id: "webcam", label: "Webcam", emoji: "📷" },
            { id: "monitor", label: "Monitor", emoji: "📺" },
            { id: "som", label: "Caixas de som", emoji: "🔊" },
            { id: "impressora", label: "Impressora", emoji: "🖨️" },
          ],
          zones: [
            { id: "entrada", label: "Mandam ordens ao computador", emoji: "⬇️" },
            { id: "saida", label: "Mostram o que o computador fez", emoji: "⬆️" },
          ],
          answer: {
            teclado: "entrada",
            mouse: "entrada",
            webcam: "entrada",
            monitor: "saida",
            som: "saida",
            impressora: "saida",
          },
          hint: "Quem manda ordens é entrada. Quem mostra é saída.",
        }),
      ],
    },
    {
      number: 3,
      title: "Ligando e desligando",
      context:
        "Para ligar, a gente aperta o botão de ligar e espera. Para desligar, a gente usa o menu do computador. Nunca puxe o fio da tomada!",
      objective: "Ligar e desligar o computador do jeito certo.",
      steps: [
        "Aperte o botão de ligar e espere o computador acordar.",
        "Quando aparecer a área de trabalho, o computador está pronto.",
        "Para desligar: salve seu trabalho, clique em Iniciar e depois em Desligar.",
        "Espere a tela apagar. Só então o computador está desligado.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a03-1", "order", "computador", "practice", "Ligando o computador", "Coloque os passos na ordem certa para LIGAR.", {
          items: [
            "Apertar o botão de ligar",
            "Esperar o computador acordar",
            "Ver a área de trabalho na tela",
            "Começar a usar",
          ],
          hint: "Primeiro aperta o botão. Depois espera com calma.",
        }),
        activity("lab-a03-2", "order", "computador", "practice", "Desligando o computador", "Coloque os passos na ordem certa para DESLIGAR.", {
          items: [
            "Salvar o que eu fiz",
            "Clicar em Iniciar",
            "Clicar em Desligar",
            "Esperar a tela apagar",
          ],
          hint: "Antes de desligar, salve o seu trabalho.",
        }),
        activity("lab-a03-3", "choice", "computador", "knowledge", "Por que não puxar o fio?", "Escolha a resposta certa.", {
          question: "Por que não podemos desligar puxando o fio da tomada?",
          display: "list",
          options: [
            { id: "a", text: "Pode estragar o computador e perder o trabalho", emoji: "⚠️" },
            { id: "b", text: "Porque o fio é bonito", emoji: "🎀" },
            { id: "c", text: "Não tem problema nenhum", emoji: "🤷" },
          ],
          answer: ["a"],
          hint: "Desligar do jeito errado pode machucar o computador.",
        }),
        activity("lab-a03-4", "choice", "computador", "challenge", "O jeito certo de desligar", "Qual é o jeito CERTO de desligar o computador?", {
          question: "Qual é o jeito certo de desligar o computador?",
          display: "list",
          options: [
            { id: "a", text: "Clicar em Iniciar e depois em Desligar", emoji: "🖱️" },
            { id: "b", text: "Puxar o fio da tomada", emoji: "🔌" },
            { id: "c", text: "Bater no teclado", emoji: "👊" },
          ],
          answer: ["a"],
          hint: "Use o menu Iniciar.",
        }),
      ],
    },
    {
      number: 4,
      title: "Cuidados com o computador",
      context:
        "O computador precisa de cuidado para durar muito. Também precisamos cuidar do nosso corpo: sentar direito e descansar os olhos.",
      objective: "Saber como cuidar do computador e como sentar com boa postura.",
      steps: [
        "Não coma nem beba perto do teclado.",
        "Não puxe os cabos e não bata nas teclas.",
        "Não coloque objetos nas entradas do computador.",
        "Sente com as costas retas e os pés no chão.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a04-1", "choice", "computador", "knowledge", "Qual atitude está correta?", "Escolha a atitude certa.", {
          question: "Qual atitude está correta?",
          display: "list",
          options: [
            { id: "a", text: "Comer em cima do teclado", emoji: "🍔" },
            { id: "b", text: "Apertar as teclas com cuidado", emoji: "⌨️" },
            { id: "c", text: "Puxar o cabo do mouse", emoji: "🪢" },
            { id: "d", text: "Colocar um lápis na entrada do computador", emoji: "✏️" },
          ],
          answer: ["b"],
          hint: "Cuidar é tratar o computador com carinho.",
        }),
        activity("lab-a04-2", "drag", "computador", "practice", "Pode ou não pode?", "Arraste cada atitude para a caixa certa.", {
          items: [
            { id: "comer", label: "Comer sobre o teclado", emoji: "🍔" },
            { id: "suco", label: "Deixar suco perto", emoji: "🥤" },
            { id: "cabo", label: "Puxar os cabos", emoji: "🔌" },
            { id: "maos", label: "Usar com as mãos limpas", emoji: "🧼" },
            { id: "cuidado", label: "Apertar as teclas com cuidado", emoji: "⌨️" },
            { id: "sentar", label: "Sentar com as costas retas", emoji: "🪑" },
          ],
          zones: [
            { id: "pode", label: "Pode", emoji: "✅" },
            { id: "nao", label: "Não pode", emoji: "❌" },
          ],
          answer: { comer: "nao", suco: "nao", cabo: "nao", maos: "pode", cuidado: "pode", sentar: "pode" },
          hint: "Comida, líquido e puxões fazem mal ao computador.",
        }),
        activity("lab-a04-3", "choice", "computador", "knowledge", "Como sentar?", "Escolha a postura certa.", {
          question: "Como devemos sentar na frente do computador?",
          display: "list",
          options: [
            { id: "a", text: "Costas retas e pés no chão", emoji: "🧍" },
            { id: "b", text: "Deitado na cadeira", emoji: "🛌" },
            { id: "c", text: "Com o rosto colado na tela", emoji: "👀" },
          ],
          answer: ["a"],
          hint: "Sentar direito protege as suas costas.",
        }),
        activity("lab-a04-4", "choice", "computador", "challenge", "Um colega derramou água", "O que fazer nessa situação?", {
          question: "Um colega derramou água perto do computador. O que fazer?",
          display: "list",
          options: [
            { id: "a", text: "Chamar o professor na hora", emoji: "🙋" },
            { id: "b", text: "Passar a mão rápido para secar", emoji: "🖐️" },
            { id: "c", text: "Continuar digitando", emoji: "⌨️" },
          ],
          answer: ["a"],
          hint: "Em caso de acidente, peça ajuda a um adulto.",
        }),
      ],
    },
  ],
};
