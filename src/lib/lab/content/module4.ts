import { activity, type LabModuleSeed } from "./types";

export const module4: LabModuleSeed = {
  name: "Sistema, Janelas e Arquivos",
  description: "Área de trabalho, janelas, pastas e arquivos: como organizar tudo no computador.",
  lessons: [
    {
      number: 15,
      title: "Conhecendo a área de trabalho",
      context:
        "A área de trabalho é a tela principal do computador. Nela ficam os ícones. Embaixo fica a barra de tarefas, com o botão Iniciar.",
      objective: "Reconhecer área de trabalho, ícones, barra de tarefas, menu Iniciar e atalhos.",
      steps: [
        "Olhe a tela inicial: essa é a área de trabalho.",
        "Os desenhinhos são os ícones. Cada um abre um programa ou uma pasta.",
        "A barra embaixo é a barra de tarefas.",
        "O botão Iniciar abre o menu com os programas.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a15-1", "match", "computador", "practice", "Nomes da tela", "Ligue cada nome ao que ele é.", {
          pairs: [
            { left: "Área de trabalho", right: "A tela principal", emoji: "🖥️" },
            { left: "Ícone", right: "Um desenhinho que abre algo", emoji: "📄" },
            { left: "Barra de tarefas", right: "A faixa embaixo da tela", emoji: "➖" },
            { left: "Menu Iniciar", right: "A lista com os programas", emoji: "🪟" },
            { left: "Atalho", right: "Um caminho rápido para abrir algo", emoji: "⚡" },
          ],
          hint: "Pense onde cada coisa fica na tela.",
        }),
        activity("lab-a15-2", "choice", "computador", "knowledge", "Onde fica o Iniciar?", "Escolha a resposta certa.", {
          question: "Onde fica o botão Iniciar?",
          display: "list",
          options: [
            { id: "a", text: "Na barra de tarefas, embaixo da tela", emoji: "⬇️" },
            { id: "b", text: "Dentro do mouse", emoji: "🖱️" },
            { id: "c", text: "Atrás do monitor", emoji: "📺" },
          ],
          answer: ["a"],
          hint: "Olhe a faixa de baixo da tela.",
        }),
        activity("lab-a15-3", "desktop", "computador", "practice", "Abra o menu Iniciar", "No mini computador, abra o menu Iniciar e abra um programa.", {
          required: ["startmenu", "open"],
          hint: "Clique no botão Iniciar, depois em um programa.",
        }),
      ],
    },
    {
      number: 16,
      title: "Janelas e programas",
      context:
        "Cada programa abre numa janela. A janela pode ficar pequena (minimizar), grande (maximizar) ou fechar. Dá para abrir várias e trocar entre elas.",
      objective: "Abrir, minimizar, maximizar, fechar e alternar janelas.",
      steps: [
        "O botão com um traço minimiza: a janela some para a barra de tarefas.",
        "O botão com um quadrado maximiza: a janela fica grande.",
        "O botão com um X fecha a janela.",
        "Clique na barra de tarefas para trocar de janela.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a16-1", "match", "computador", "knowledge", "Botões da janela", "Ligue cada botão ao que ele faz.", {
          pairs: [
            { left: "Botão com um traço", right: "Minimiza a janela", emoji: "➖" },
            { left: "Botão com um quadrado", right: "Deixa a janela grande", emoji: "⬜" },
            { left: "Botão com um X", right: "Fecha a janela", emoji: "❌" },
          ],
          hint: "O X fecha, o quadrado aumenta.",
        }),
        activity("lab-a16-2", "desktop", "computador", "practice", "Mexa na janela", "No mini computador, abra um programa, minimize e maximize a janela.", {
          required: ["open", "minimize", "maximize"],
          hint: "Use os três botões no canto da janela.",
        }),
        activity("lab-a16-3", "desktop", "computador", "challenge", "Troque de janela", "Abra os programas, troque entre eles e feche uma janela.", {
          required: ["open", "switch", "close"],
          hint: "Clique na barra de tarefas para trocar de janela.",
        }),
      ],
    },
    {
      number: 17,
      title: "Criando pastas",
      context:
        "Uma pasta é como uma gaveta onde guardamos nossos arquivos. Com pastas, tudo fica no seu lugar e fácil de achar.",
      objective: "Criar pastas com nomes bem escolhidos.",
      steps: [
        "Escolha onde a pasta vai ficar.",
        "Clique em Nova pasta.",
        "Escreva o nome da pasta e aperte Enter.",
        "Dentro de uma pasta, dá para criar outras pastas.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a17-1", "choice", "arquivos", "knowledge", "O que é uma pasta?", "Escolha a resposta certa.", {
          question: "Uma pasta é como…",
          display: "list",
          options: [
            { id: "a", text: "Uma gaveta onde guardamos arquivos", emoji: "🗄️" },
            { id: "b", text: "Um tipo de teclado", emoji: "⌨️" },
            { id: "c", text: "Uma caixa de som", emoji: "🔊" },
          ],
          answer: ["a"],
          hint: "Pense numa gaveta cheia de papéis.",
        }),
        activity("lab-a17-2", "files", "arquivos", "practice", "Crie as suas pastas", "Crie a pasta Meu Computador e, dentro dela, as pastas Textos, Imagens e Projetos.", {
          initialFolders: [],
          initialFiles: [],
          instructions: [
            "Crie uma pasta chamada Meu Computador.",
            "Entre nela e crie a pasta Textos.",
            "Dentro de Meu Computador, crie também Imagens e Projetos.",
          ],
          goals: [
            { type: "folder_exists", path: "Meu Computador" },
            { type: "folder_exists", path: "Meu Computador/Textos" },
            { type: "folder_exists", path: "Meu Computador/Imagens" },
            { type: "folder_exists", path: "Meu Computador/Projetos" },
          ],
          hint: "Clique na pasta Meu Computador antes de criar as outras.",
        }),
        activity("lab-a17-3", "files", "arquivos", "challenge", "Pastas da escola", "Crie a pasta Minha Escola com as pastas Fotos e Trabalhos dentro.", {
          initialFolders: [],
          initialFiles: [],
          instructions: [
            "Crie uma pasta chamada Minha Escola.",
            "Dentro dela, crie as pastas Fotos e Trabalhos.",
          ],
          goals: [
            { type: "folder_exists", path: "Minha Escola" },
            { type: "folder_exists", path: "Minha Escola/Fotos" },
            { type: "folder_exists", path: "Minha Escola/Trabalhos" },
          ],
          hint: "Para criar dentro de uma pasta, clique nela primeiro.",
        }),
      ],
    },
    {
      number: 18,
      title: "Criando e salvando arquivos",
      context:
        "Salvar é guardar o que você fez, para não perder. Ao salvar, a gente escolhe a pasta e o nome do arquivo.",
      objective: "Entender para que serve salvar e onde o arquivo fica guardado.",
      steps: [
        "Termine o que você estava fazendo.",
        "Clique em Salvar.",
        "Escolha a pasta onde o arquivo vai ficar.",
        "Escreva um nome fácil de lembrar.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a18-1", "choice", "arquivos", "knowledge", "Para que serve salvar?", "Escolha a resposta certa.", {
          question: "Para que serve salvar?",
          display: "list",
          options: [
            { id: "a", text: "Para não perder o que eu fiz", emoji: "💾" },
            { id: "b", text: "Para o computador ficar mais rápido", emoji: "🚀" },
            { id: "c", text: "Para apagar tudo", emoji: "🗑️" },
          ],
          answer: ["a"],
          hint: "Salvar guarda o seu trabalho.",
        }),
        activity("lab-a18-2", "files", "arquivos", "practice", "Guarde na pasta certa", "Leve o arquivo Meu texto.txt para a pasta Textos.", {
          initialFolders: ["Textos", "Imagens"],
          initialFiles: [{ name: "Meu texto.txt", folder: "", emoji: "📝" }],
          instructions: ["Coloque o arquivo Meu texto.txt dentro da pasta Textos."],
          goals: [{ type: "file_in", orig: "Meu texto.txt", folder: "Textos" }],
          hint: "Clique no arquivo e depois em Mover para a pasta Textos.",
        }),
        activity("lab-a18-3", "files", "arquivos", "challenge", "Salve a redação", "Crie a pasta Escola e guarde a Redação nela.", {
          initialFolders: [],
          initialFiles: [{ name: "Redação.txt", folder: "", emoji: "📝" }],
          instructions: ["Crie uma pasta chamada Escola.", "Guarde o arquivo Redação.txt dentro dela."],
          goals: [
            { type: "folder_exists", path: "Escola" },
            { type: "file_in", orig: "Redação.txt", folder: "Escola" },
          ],
          hint: "Primeiro crie a pasta. Depois mova o arquivo.",
        }),
      ],
    },
    {
      number: 19,
      title: "Copiar, colar, renomear e excluir",
      context:
        "Copiar faz uma cópia do arquivo. Mover leva o arquivo para outro lugar. Renomear troca o nome. Excluir manda o arquivo para a lixeira.",
      objective: "Copiar, mover, renomear e excluir arquivos.",
      steps: [
        "Copiar: o arquivo continua no lugar e aparece uma cópia em outro.",
        "Mover: o arquivo sai de um lugar e vai para outro.",
        "Renomear: troque o nome do arquivo.",
        "Excluir: o arquivo vai para a lixeira, de onde dá para recuperar.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a19-1", "choice", "arquivos", "knowledge", "Para onde vai o que excluímos?", "Escolha a resposta certa.", {
          question: "Quando excluímos um arquivo, para onde ele vai?",
          display: "list",
          options: [
            { id: "a", text: "Para a lixeira", emoji: "🗑️" },
            { id: "b", text: "Para o teclado", emoji: "⌨️" },
            { id: "c", text: "Ele vira papel", emoji: "📄" },
          ],
          answer: ["a"],
          hint: "Ele fica na lixeira até alguém esvaziá-la.",
        }),
        activity("lab-a19-2", "files", "arquivos", "practice", "Copiar, renomear e excluir", "Faça as três tarefas com os arquivos.", {
          initialFolders: ["Imagens"],
          initialFiles: [
            { name: "foto.png", folder: "", emoji: "🖼️" },
            { name: "rascunho.txt", folder: "", emoji: "📝" },
            { name: "lixo.txt", folder: "", emoji: "🧻" },
          ],
          instructions: [
            "Copie foto.png para a pasta Imagens.",
            "Troque o nome de rascunho.txt para Meu texto.txt.",
            "Exclua o arquivo lixo.txt.",
          ],
          goals: [
            { type: "file_copied", orig: "foto.png", folder: "Imagens" },
            { type: "file_renamed", orig: "rascunho.txt", to: "Meu texto.txt" },
            { type: "file_deleted", orig: "lixo.txt" },
          ],
          hint: "Clique no arquivo e escolha o botão da tarefa.",
        }),
        activity("lab-a19-3", "files", "arquivos", "challenge", "Arrume a bagunça", "Mova, renomeie, copie e exclua para arrumar tudo.", {
          initialFolders: ["Fotos", "Escola"],
          initialFiles: [
            { name: "foto-escola.png", folder: "", emoji: "🖼️" },
            { name: "tarefa.txt", folder: "", emoji: "📝" },
            { name: "teste.txt", folder: "", emoji: "🧻" },
          ],
          instructions: [
            "Mova foto-escola.png para a pasta Fotos.",
            "Copie foto-escola.png para a pasta Escola.",
            "Troque o nome de tarefa.txt para Tarefa de casa.txt.",
            "Exclua o arquivo teste.txt.",
          ],
          goals: [
            { type: "file_in", orig: "foto-escola.png", folder: "Fotos" },
            { type: "file_copied", orig: "foto-escola.png", folder: "Escola" },
            { type: "file_renamed", orig: "tarefa.txt", to: "Tarefa de casa.txt" },
            { type: "file_deleted", orig: "teste.txt" },
          ],
          hint: "Faça uma tarefa de cada vez.",
        }),
      ],
    },
    {
      number: 20,
      title: "Desafio de organização",
      context:
        "Agora é hora de arrumar tudo! Crie as pastas e coloque cada arquivo no lugar certo. Quem organiza acha as coisas rápido.",
      objective: "Organizar arquivos em pastas.",
      steps: [
        "Crie a pasta Projeto Escola.",
        "Dentro dela, crie Textos, Imagens e Trabalhos.",
        "Mova cada arquivo para a pasta certa.",
      ],
      estimatedMinutes: 30,
      points: 60,
      activities: [
        activity("lab-a20-1", "files", "arquivos", "practice", "Comece a organizar", "Crie as pastas do Projeto Escola e guarde os dois textos.", {
          initialFolders: [],
          initialFiles: [
            { name: "redacao.txt", folder: "", emoji: "📝" },
            { name: "poema.txt", folder: "", emoji: "📝" },
          ],
          instructions: [
            "Crie a pasta Projeto Escola.",
            "Dentro dela, crie as pastas Textos, Imagens e Trabalhos.",
            "Guarde redacao.txt e poema.txt na pasta Textos.",
          ],
          goals: [
            { type: "folder_exists", path: "Projeto Escola" },
            { type: "folder_exists", path: "Projeto Escola/Textos" },
            { type: "folder_exists", path: "Projeto Escola/Imagens" },
            { type: "folder_exists", path: "Projeto Escola/Trabalhos" },
            { type: "file_in", orig: "redacao.txt", folder: "Projeto Escola/Textos" },
            { type: "file_in", orig: "poema.txt", folder: "Projeto Escola/Textos" },
          ],
          hint: "Crie as pastas primeiro e só depois mova os arquivos.",
        }),
        activity("lab-a20-2", "files", "arquivos", "challenge", "Desafio de organização", "Organize todos os arquivos nas pastas certas.", {
          initialFolders: [],
          initialFiles: [
            { name: "redacao.txt", folder: "", emoji: "📝" },
            { name: "poema.txt", folder: "", emoji: "📝" },
            { name: "foto-escola.png", folder: "", emoji: "🖼️" },
            { name: "desenho.png", folder: "", emoji: "🎨" },
            { name: "trabalho-matematica.txt", folder: "", emoji: "➗" },
            { name: "trabalho-ciencias.txt", folder: "", emoji: "🔬" },
          ],
          instructions: [
            "Crie a pasta Projeto Escola com as pastas Textos, Imagens e Trabalhos.",
            "Textos: redacao.txt e poema.txt.",
            "Imagens: foto-escola.png e desenho.png.",
            "Trabalhos: trabalho-matematica.txt e trabalho-ciencias.txt.",
          ],
          goals: [
            { type: "folder_exists", path: "Projeto Escola/Textos" },
            { type: "folder_exists", path: "Projeto Escola/Imagens" },
            { type: "folder_exists", path: "Projeto Escola/Trabalhos" },
            { type: "file_in", orig: "redacao.txt", folder: "Projeto Escola/Textos" },
            { type: "file_in", orig: "poema.txt", folder: "Projeto Escola/Textos" },
            { type: "file_in", orig: "foto-escola.png", folder: "Projeto Escola/Imagens" },
            { type: "file_in", orig: "desenho.png", folder: "Projeto Escola/Imagens" },
            { type: "file_in", orig: "trabalho-matematica.txt", folder: "Projeto Escola/Trabalhos" },
            { type: "file_in", orig: "trabalho-ciencias.txt", folder: "Projeto Escola/Trabalhos" },
          ],
          hint: "Pelo nome e pelo desenhinho você descobre onde cada um vai.",
        }),
        activity("lab-a20-3", "choice", "arquivos", "knowledge", "Por que organizar?", "Escolha a resposta certa.", {
          question: "Por que é bom guardar os arquivos em pastas?",
          display: "list",
          options: [
            { id: "a", text: "Para achar tudo rápido e fácil", emoji: "🔎" },
            { id: "b", text: "Para o computador ficar quente", emoji: "🔥" },
            { id: "c", text: "Para esconder do professor", emoji: "🙈" },
          ],
          answer: ["a"],
          hint: "Pense numa gaveta bem arrumada.",
        }),
      ],
    },
  ],
};
