import { activity, YES_NO, type LabModuleSeed } from "./types";

export const module6: LabModuleSeed = {
  name: "Internet e Segurança",
  description: "Conhecer a internet, pesquisar com cuidado e se proteger.",
  lessons: [
    {
      number: 27,
      title: "Conhecendo a internet",
      context:
        "A internet é uma rede que liga computadores do mundo todo. Para usá-la a gente abre um navegador e visita sites. A internet não é o computador: o computador só se conecta a ela.",
      objective: "Entender o que são internet, navegador, site, endereço e pesquisa.",
      steps: [
        "O navegador é o programa que abre a internet.",
        "Um site é como uma página da internet.",
        "O endereço do site fica na barra de cima do navegador.",
        "Para procurar algo, a gente usa a pesquisa.",
      ],
      estimatedMinutes: 30,
      points: 40,
      activities: [
        activity("lab-a27-1", "choice", "internet", "knowledge", "O que é a internet?", "Escolha a resposta certa.", {
          question: "O que é a internet?",
          display: "list",
          options: [
            { id: "a", text: "Uma rede que liga computadores do mundo todo", emoji: "🌐" },
            { id: "b", text: "A tela do computador", emoji: "📺" },
            { id: "c", text: "Um tipo de teclado", emoji: "⌨️" },
          ],
          answer: ["a"],
          hint: "Ela liga computadores de vários lugares.",
        }),
        activity("lab-a27-2", "match", "internet", "practice", "Palavras da internet", "Ligue cada palavra ao que ela é.", {
          pairs: [
            { left: "Navegador", right: "O programa que abre a internet", emoji: "🧭" },
            { left: "Site", right: "Uma página da internet", emoji: "📄" },
            { left: "Endereço", right: "O nome que leva até o site", emoji: "🏷️" },
            { left: "Pesquisa", right: "Procurar algo na internet", emoji: "🔎" },
          ],
          hint: "O navegador é o programa que usamos para entrar na internet.",
        }),
        activity("lab-a27-3", "choice", "internet", "challenge", "Internet e computador", "Escolha a resposta certa.", {
          question: "A internet e o computador são a mesma coisa?",
          display: "list",
          options: [
            { id: "a", text: "Não. O computador se conecta à internet", emoji: "🔗" },
            { id: "b", text: "Sim, são iguais", emoji: "🟰" },
          ],
          answer: ["a"],
          hint: "O computador é uma máquina. A internet é a rede.",
        }),
      ],
    },
    {
      number: 28,
      title: "Pesquisando na internet",
      context:
        "Para pesquisar, abrimos o navegador, escrevemos o que queremos saber e apertamos Enter. Depois olhamos os resultados com calma. Nunca clique em tudo!",
      objective: "Fazer uma pesquisa com cuidado.",
      steps: [
        "Abra o navegador.",
        "Escreva o que você quer saber na barra de pesquisa.",
        "Aperte Enter e olhe os resultados com calma.",
        "Escolha um resultado de confiança, com ajuda do professor.",
      ],
      estimatedMinutes: 40,
      points: 60,
      activities: [
        activity("lab-a28-1", "order", "internet", "practice", "Passos da pesquisa", "Coloque os passos da pesquisa na ordem certa.", {
          items: [
            "Abrir o navegador",
            "Escrever o que quero saber",
            "Apertar Enter",
            "Olhar os resultados com calma",
          ],
          hint: "Primeiro abre o navegador. Depois escreve.",
        }),
        activity("lab-a28-2", "choice", "internet", "knowledge", "Posso clicar em tudo?", "Escolha a resposta certa.", {
          question: "Eu posso clicar em qualquer link que aparecer?",
          display: "list",
          options: [
            { id: "a", text: "Não. Eu olho com calma e peço ajuda se tiver dúvida", emoji: "🙋" },
            { id: "b", text: "Sim, em todos", emoji: "🖱️" },
          ],
          answer: ["a"],
          hint: "Alguns links podem ser perigosos.",
        }),
        activity("lab-a28-3", "type", "internet", "challenge", "Pesquise três animais da Amazônia", "Pesquise na internet e escreva o nome de três animais da Amazônia.", {
          fields: [
            { id: "a1", label: "Animal 1", mode: "free", minChars: 3 },
            { id: "a2", label: "Animal 2", mode: "free", minChars: 3 },
            { id: "a3", label: "Animal 3", mode: "free", minChars: 3 },
          ],
          hint: "Escreva na pesquisa: animais da Amazônia.",
        }),
      ],
    },
    {
      number: 29,
      title: "Segurança digital",
      context:
        "Na internet também precisamos nos proteger. Nunca fale com desconhecidos e nunca conte senha, endereço ou telefone. Se algo parecer estranho, avise um adulto.",
      objective: "Reconhecer o que é seguro e o que não é na internet.",
      steps: [
        "Não converse com desconhecidos.",
        "Não conte a sua senha, o seu endereço nem o seu telefone.",
        "Não mande fotos suas para quem você não conhece.",
        "Tem dúvida ou medo? Fale logo com um adulto de confiança.",
      ],
      estimatedMinutes: 40,
      points: 60,
      activities: [
        activity("lab-a29-1", "drag", "seguranca", "practice", "Isso é seguro ou não?", "Arraste cada situação para a caixa certa.", {
          items: [
            { id: "senha", label: "Contar a minha senha a um colega", emoji: "🔑" },
            { id: "endereco", label: "Dizer onde moro a um desconhecido", emoji: "🏠" },
            { id: "adulto", label: "Pedir ajuda a um adulto", emoji: "🧑‍🏫" },
            { id: "foto", label: "Mandar foto minha a quem não conheço", emoji: "📷" },
            { id: "pesquisar", label: "Pesquisar com o professor", emoji: "🔎" },
            { id: "telefone", label: "Passar o meu telefone a um desconhecido", emoji: "📞" },
          ],
          zones: [
            { id: "seguro", label: "Seguro", emoji: "✅" },
            { id: "perigo", label: "Não é seguro", emoji: "❌" },
          ],
          answer: {
            senha: "perigo",
            endereco: "perigo",
            adulto: "seguro",
            foto: "perigo",
            pesquisar: "seguro",
            telefone: "perigo",
          },
          hint: "Dados pessoais não se contam a desconhecidos.",
        }),
        activity("lab-a29-2", "choice", "seguranca", "knowledge", "Senha segura", "Escolha a senha mais segura.", {
          question: "Qual senha é a mais segura?",
          display: "list",
          options: [
            { id: "a", text: "123456", emoji: "🔢" },
            { id: "b", text: "meunome", emoji: "🧒" },
            { id: "c", text: "Sol!Casa7Rio", emoji: "🔐" },
          ],
          answer: ["c"],
          hint: "A melhor mistura letras maiúsculas, números e símbolos.",
        }),
        activity("lab-a29-3", "choice", "seguranca", "knowledge", "Um desconhecido me chama", "O que fazer?", {
          question: "Um desconhecido manda mensagem para você. O que fazer?",
          display: "list",
          options: [
            { id: "a", text: "Não responder e avisar um adulto", emoji: "🙋" },
            { id: "b", text: "Responder e contar tudo", emoji: "💬" },
            { id: "c", text: "Mandar uma foto", emoji: "📷" },
          ],
          answer: ["a"],
          hint: "Desconhecido na internet pode não ser quem diz ser.",
        }),
        activity("lab-a29-4", "drag", "seguranca", "challenge", "Links e downloads", "Arraste cada situação para a caixa certa.", {
          items: [
            { id: "premio", label: "Link que diz: “Você ganhou um prêmio! Clique aqui!”", emoji: "🎁" },
            { id: "professor", label: "Site que o professor indicou", emoji: "🧑‍🏫" },
            { id: "download", label: "Baixar um jogo de um site estranho", emoji: "⬇️" },
            { id: "oficial", label: "Pesquisar no site da escola", emoji: "🏫" },
          ],
          zones: [
            { id: "seguro", label: "Seguro", emoji: "✅" },
            { id: "perigo", label: "Não é seguro", emoji: "❌" },
          ],
          answer: { premio: "perigo", professor: "seguro", download: "perigo", oficial: "seguro" },
          hint: "Prêmios fáceis e downloads estranhos são perigosos.",
        }),
      ],
    },
    {
      number: 30,
      title: "Desafio final: Meu primeiro projeto digital",
      context:
        "Chegou a hora de mostrar tudo o que você aprendeu! Cada desafio usa uma habilidade: computador, mouse, teclado, arquivos, produção, internet e segurança.",
      objective: "Demonstrar as principais habilidades aprendidas no programa.",
      steps: [
        "Respire fundo e vá no seu ritmo.",
        "Faça cada desafio com calma.",
        "Se errar, tente de novo. Todo mundo aprende errando!",
      ],
      estimatedMinutes: 60,
      points: 300,
      activities: [
        activity("lab-a30-1", "order", "computador", "challenge", "Computador: ligar e desligar", "Coloque na ordem: ligar, usar e desligar corretamente.", {
          items: [
            "Apertar o botão de ligar",
            "Esperar a área de trabalho",
            "Usar o computador",
            "Salvar o trabalho",
            "Clicar em Iniciar e Desligar",
          ],
          hint: "Ligue, use, salve e só depois desligue.",
        }, 30),
        activity("lab-a30-2", "gesture", "mouse", "challenge", "Mouse: clicar e dar duplo clique", "Clique e dê duplo clique nos alvos.", {
          mode: "mixed",
          targets: 8,
          hint: "Cada alvo mostra se é um clique ou um duplo clique.",
        }, 30),
        activity("lab-a30-3", "type", "teclado", "challenge", "Teclado: escreva sobre você", "Escreva duas frases corretas.", {
          fields: [
            { id: "f1", label: "Escreva uma frase com o seu nome", mode: "free", mustStartUpper: true, mustEndPunct: true, minWords: 3 },
            { id: "f2", label: "Escreva uma frase sobre o que você aprendeu", mode: "free", mustStartUpper: true, mustEndPunct: true, minWords: 4 },
          ],
          hint: "Maiúscula no começo, ponto no final, espaço entre as palavras.",
        }, 30),
        activity("lab-a30-4", "files", "arquivos", "challenge", "Arquivos: organize o projeto", "Crie as pastas e guarde cada arquivo.", {
          initialFolders: [],
          initialFiles: [
            { name: "texto-final.txt", folder: "", emoji: "📝" },
            { name: "imagem-final.png", folder: "", emoji: "🖼️" },
          ],
          instructions: [
            "Crie a pasta Meu Primeiro Projeto.",
            "Dentro dela, crie as pastas Textos e Imagens.",
            "Guarde texto-final.txt em Textos e imagem-final.png em Imagens.",
          ],
          goals: [
            { type: "folder_exists", path: "Meu Primeiro Projeto/Textos" },
            { type: "folder_exists", path: "Meu Primeiro Projeto/Imagens" },
            { type: "file_in", orig: "texto-final.txt", folder: "Meu Primeiro Projeto/Textos" },
            { type: "file_in", orig: "imagem-final.png", folder: "Meu Primeiro Projeto/Imagens" },
          ],
          hint: "Crie as pastas antes de mover os arquivos.",
        }, 30),
        activity("lab-a30-5", "draw", "producao", "challenge", "Produção: faça um desenho", "Faça um desenho com 2 cores ou mais.", {
          minStrokes: 8,
          minColors: 2,
          hint: "Use bastante criatividade!",
        }, 30),
        activity("lab-a30-6", "order", "internet", "challenge", "Internet: pesquise com cuidado", "Coloque os passos da pesquisa na ordem certa.", {
          items: [
            "Abrir o navegador",
            "Escrever o que quero saber",
            "Apertar Enter",
            "Olhar os resultados com calma",
          ],
          hint: "Pesquisar com calma é pesquisar com segurança.",
        }, 30),
        activity("lab-a30-7", "drag", "seguranca", "challenge", "Segurança: seguro ou não?", "Arraste cada situação para a caixa certa.", {
          items: [
            { id: "senha", label: "Contar a minha senha a um colega", emoji: "🔑" },
            { id: "adulto", label: "Pedir ajuda a um adulto", emoji: "🧑‍🏫" },
            { id: "link", label: "Clicar em um link de prêmio", emoji: "🎁" },
            { id: "professor", label: "Usar um site que o professor indicou", emoji: "🏫" },
          ],
          zones: YES_NO.map((o) => ({ id: o.id === "sim" ? "seguro" : "perigo", label: o.text, emoji: o.emoji })),
          answer: { senha: "perigo", adulto: "seguro", link: "perigo", professor: "seguro" },
          hint: "Senha e links estranhos não são seguros.",
        }, 30),
      ],
    },
  ],
};
