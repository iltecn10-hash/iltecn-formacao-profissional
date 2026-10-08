import { activity, type LabModuleSeed } from "./types";

export const module5: LabModuleSeed = {
  name: "Criando e Produzindo",
  description: "Desenhar, escrever, formatar e montar o seu primeiro projeto digital.",
  lessons: [
    {
      number: 21,
      title: "Meu primeiro desenho",
      context:
        "No computador a gente também desenha! Dá para escolher cores, pintar, apagar e salvar o desenho para não perder.",
      objective: "Criar um desenho digital usando pincel, cores e borracha.",
      steps: [
        "Escolha uma cor.",
        "Clique e arraste no quadro para desenhar.",
        "Use a borracha para apagar o que não gostou.",
        "Quando terminar, salve o desenho.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a21-1", "match", "producao", "knowledge", "Ferramentas de desenho", "Ligue cada ferramenta ao que ela faz.", {
          pairs: [
            { left: "Pincel", right: "Desenha com cores", emoji: "🖌️" },
            { left: "Borracha", right: "Apaga o que errei", emoji: "🧽" },
            { left: "Cores", right: "Deixam o desenho colorido", emoji: "🎨" },
          ],
          hint: "O pincel desenha e a borracha apaga.",
        }),
        activity("lab-a21-2", "draw", "producao", "practice", "Desenhe à vontade", "Faça um desenho usando pelo menos 2 cores.", {
          minStrokes: 5,
          minColors: 2,
          hint: "Escolha uma cor, desenhe, depois escolha outra cor.",
        }),
        activity("lab-a21-3", "draw", "producao", "challenge", "Meu desenho colorido", "Faça um desenho bem caprichado, com 3 cores ou mais.", {
          minStrokes: 12,
          minColors: 3,
          hint: "Use bastante cor e capriche!",
        }),
        activity("lab-a21-4", "choice", "producao", "knowledge", "Depois do desenho", "Escolha a resposta certa.", {
          question: "Terminei o desenho. O que faço para não perder?",
          display: "list",
          options: [
            { id: "a", text: "Salvar o desenho", emoji: "💾" },
            { id: "b", text: "Desligar o computador puxando o fio", emoji: "🔌" },
            { id: "c", text: "Fechar sem fazer nada", emoji: "🙈" },
          ],
          answer: ["a"],
          hint: "Salvar guarda o que você fez.",
        }),
      ],
    },
    {
      number: 22,
      title: "Meu primeiro texto",
      context:
        "Um texto é feito de frases que contam alguma coisa. Hoje você vai escrever um pequeno texto sobre a sua escola.",
      objective: "Escrever um pequeno texto no editor de documentos.",
      steps: [
        "Pense no que você quer contar sobre a sua escola.",
        "Abra o documento da aula e escreva o título: Minha Escola.",
        "Escreva: Minha escola se chama… Eu gosto… Na escola eu aprendo…",
        "Quando terminar, clique em Entregar documento.",
      ],
      estimatedMinutes: 40,
      points: 60,
      document: true,
      activities: [
        activity("lab-a22-1", "type", "producao", "practice", "Aquecimento", "Escreva três frases curtas sobre a sua escola.", {
          fields: [
            { id: "f1", label: "Minha escola se chama…", mode: "free", minChars: 3, placeholder: "Minha escola se chama…" },
            { id: "f2", label: "Eu gosto de…", mode: "free", minChars: 3, placeholder: "Eu gosto de…" },
            { id: "f3", label: "Na escola eu aprendo…", mode: "free", minChars: 3, placeholder: "Na escola eu aprendo…" },
          ],
          hint: "Escreva do seu jeito, com calma.",
        }),
        activity("lab-a22-2", "choice", "producao", "knowledge", "Partes de um texto", "Escolha a resposta certa.", {
          question: "O que fica no começo de um texto, bem grande?",
          display: "list",
          options: [
            { id: "a", text: "O título", emoji: "🔠" },
            { id: "b", text: "O ponto final", emoji: "⚫" },
            { id: "c", text: "O mouse", emoji: "🖱️" },
          ],
          answer: ["a"],
          hint: "É o nome do texto.",
        }),
      ],
    },
    {
      number: 23,
      title: "Formatação",
      context:
        "Formatar é deixar o texto bonito e fácil de ler. Dá para deixar a letra mais forte (negrito), inclinada (itálico), maior ou menor, e alinhar o texto.",
      objective: "Entender que o texto pode ser organizado visualmente.",
      steps: [
        "Selecione o texto que quer mudar.",
        "Clique em N para negrito e em I para itálico.",
        "Escolha o tamanho da letra e o alinhamento.",
        "Use o estilo Título para o nome do texto.",
      ],
      estimatedMinutes: 40,
      points: 60,
      document: true,
      activities: [
        activity("lab-a23-1", "match", "producao", "knowledge", "Botões de formatação", "Ligue cada botão ao que ele faz.", {
          pairs: [
            { left: "Negrito (N)", right: "Deixa a letra mais forte", emoji: "🅽" },
            { left: "Itálico (I)", right: "Deixa a letra inclinada", emoji: "🅸" },
            { left: "Centralizar", right: "Põe o texto no meio", emoji: "↔️" },
            { left: "Tamanho da fonte", right: "Deixa a letra maior ou menor", emoji: "🔤" },
          ],
          hint: "O N é de Negrito e o I é de Itálico.",
        }),
        activity("lab-a23-2", "choice", "producao", "practice", "Título bonito", "Como deixar um título em destaque?", {
          question: "Como podemos deixar o título em destaque?",
          multiple: true,
          display: "list",
          options: [
            { id: "negrito", text: "Usar negrito", emoji: "🅽" },
            { id: "grande", text: "Deixar a letra maior", emoji: "🔠" },
            { id: "sumir", text: "Apagar o título", emoji: "🗑️" },
          ],
          answer: ["negrito", "grande"],
          hint: "Duas respostas deixam o título mais bonito.",
        }),
      ],
    },
    {
      number: 24,
      title: "Inserindo imagens",
      context:
        "Um texto fica mais bonito com imagens. Ao inserir uma imagem, a gente escolhe onde ela fica e o seu tamanho.",
      objective: "Entender como organizar texto e imagem na página.",
      steps: [
        "Clique no lugar da página onde a imagem vai ficar.",
        "Escolha a imagem.",
        "Arraste o canto da imagem para deixá-la maior ou menor.",
        "Veja se o texto e a imagem estão bem organizados.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a24-1", "choice", "producao", "knowledge", "Inserir imagem", "Escolha a resposta certa.", {
          question: "O que significa inserir uma imagem?",
          display: "list",
          options: [
            { id: "a", text: "Colocar uma figura dentro do documento", emoji: "🖼️" },
            { id: "b", text: "Apagar o documento", emoji: "🗑️" },
            { id: "c", text: "Desligar o monitor", emoji: "📺" },
          ],
          answer: ["a"],
          hint: "É colocar uma figura no texto.",
        }),
        activity("lab-a24-2", "choice", "producao", "practice", "Mudar o tamanho", "Escolha a resposta certa.", {
          question: "Como deixo a imagem menor?",
          display: "list",
          options: [
            { id: "a", text: "Arrasto o canto da imagem para dentro", emoji: "↘️" },
            { id: "b", text: "Aperto a tecla Esc", emoji: "⌨️" },
            { id: "c", text: "Bato no monitor", emoji: "👊" },
          ],
          answer: ["a"],
          hint: "Segure o canto e arraste.",
        }),
        activity("lab-a24-3", "drag", "producao", "challenge", "Monte a página", "Arraste cada parte para o lugar certo da página.", {
          items: [
            { id: "titulo", label: "Título do trabalho", emoji: "🔠" },
            { id: "imagem", label: "Imagem ao lado do texto", emoji: "🖼️" },
            { id: "nome", label: "Nome do aluno", emoji: "✍️" },
          ],
          zones: [
            { id: "topo", label: "Topo da página", emoji: "⬆️" },
            { id: "meio", label: "Meio da página", emoji: "⏺️" },
            { id: "fim", label: "Fim da página", emoji: "⬇️" },
          ],
          answer: { titulo: "topo", imagem: "meio", nome: "fim" },
          hint: "O título vai no começo e o nome vai no final.",
        }),
      ],
    },
    {
      number: 25,
      title: "Minha primeira apresentação",
      context:
        "Uma apresentação é feita de slides, que são como páginas. Cada slide conta uma parte da sua história.",
      objective: "Planejar uma apresentação simples com quatro slides.",
      steps: [
        "Slide 1: Meu nome.",
        "Slide 2: Minha escola.",
        "Slide 3: Coisas que eu gosto.",
        "Slide 4: Meu objetivo.",
      ],
      estimatedMinutes: 40,
      points: 50,
      activities: [
        activity("lab-a25-1", "order", "producao", "practice", "Ordem dos slides", "Coloque os slides na ordem certa.", {
          items: ["Meu nome", "Minha escola", "Coisas que eu gosto", "Meu objetivo"],
          hint: "Começa com o seu nome e termina com o seu objetivo.",
        }),
        activity("lab-a25-2", "type", "producao", "challenge", "Escreva os seus slides", "Escreva o título de cada slide.", {
          fields: [
            { id: "s1", label: "Slide 1 — escreva o seu nome", mode: "free", minChars: 2 },
            { id: "s2", label: "Slide 2 — escreva o nome da sua escola", mode: "free", minChars: 3 },
            { id: "s3", label: "Slide 3 — escreva uma coisa que você gosta", mode: "free", minChars: 3 },
            { id: "s4", label: "Slide 4 — escreva o seu objetivo", mode: "free", minChars: 3 },
          ],
          hint: "Escreva frases curtinhas.",
        }),
        activity("lab-a25-3", "choice", "producao", "knowledge", "Para que serve?", "Escolha a resposta certa.", {
          question: "Para que serve uma apresentação?",
          display: "list",
          options: [
            { id: "a", text: "Para mostrar as nossas ideias aos outros", emoji: "🎤" },
            { id: "b", text: "Para limpar o teclado", emoji: "🧽" },
            { id: "c", text: "Para ligar o computador", emoji: "🔌" },
          ],
          answer: ["a"],
          hint: "A gente apresenta para as pessoas verem.",
        }),
      ],
    },
    {
      number: 26,
      title: "Meu primeiro projeto digital",
      context:
        "Hora de juntar tudo! Você vai criar uma pasta, escrever um texto, deixá-lo bonito, salvar e organizar os seus arquivos.",
      objective: "Realizar um pequeno projeto digital do começo ao fim.",
      steps: [
        "Crie uma pasta para o projeto.",
        "Crie um documento e escreva o seu texto.",
        "Formate o texto e coloque uma imagem.",
        "Salve, crie a apresentação e organize os arquivos.",
      ],
      estimatedMinutes: 60,
      points: 100,
      document: true,
      activities: [
        activity("lab-a26-1", "order", "producao", "challenge", "Passos do projeto", "Coloque os passos do projeto na ordem certa.", {
          items: [
            "Criar uma pasta",
            "Criar um documento",
            "Escrever o texto",
            "Formatar o texto",
            "Inserir uma imagem",
            "Salvar o documento",
            "Criar a apresentação",
            "Organizar os arquivos",
          ],
          hint: "Primeiro a pasta, por último a organização.",
        }),
        activity("lab-a26-2", "files", "arquivos", "challenge", "Organize o projeto", "Crie a pasta e guarde cada arquivo no lugar certo.", {
          initialFolders: [],
          initialFiles: [
            { name: "meu-texto.txt", folder: "", emoji: "📝" },
            { name: "minha-imagem.png", folder: "", emoji: "🖼️" },
            { name: "minha-apresentacao.txt", folder: "", emoji: "📊" },
          ],
          instructions: [
            "Crie a pasta Meu Projeto.",
            "Dentro dela, crie as pastas Textos e Imagens.",
            "Guarde meu-texto.txt em Textos e minha-imagem.png em Imagens.",
            "Guarde minha-apresentacao.txt dentro de Meu Projeto.",
          ],
          goals: [
            { type: "folder_exists", path: "Meu Projeto/Textos" },
            { type: "folder_exists", path: "Meu Projeto/Imagens" },
            { type: "file_in", orig: "meu-texto.txt", folder: "Meu Projeto/Textos" },
            { type: "file_in", orig: "minha-imagem.png", folder: "Meu Projeto/Imagens" },
            { type: "file_in", orig: "minha-apresentacao.txt", folder: "Meu Projeto" },
          ],
          hint: "Crie as pastas antes de mover os arquivos.",
        }),
      ],
    },
  ],
};
