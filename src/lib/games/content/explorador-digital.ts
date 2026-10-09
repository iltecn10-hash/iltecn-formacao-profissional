import type { GameConfig } from "@/lib/games/engine";

/**
 * Jogo-piloto da Central de Jogos: "Desafio do Explorador Digital".
 * Seis fases, interações variadas (arrastar, ligar, escolher, ordenar, digitar,
 * arquivos e janelas). Serve para o público infantil e o profissional (`audience: all`).
 * Os gabaritos ficam SÓ no servidor — o navegador recebe `toPublicPhases`.
 */

export interface GameSeed {
  code: string;
  title: string;
  description: string;
  instructions: string;
  audience: "professional" | "kids" | "all";
  difficulty: "facil" | "medio" | "dificil";
  gameType: "quiz" | "practice" | "simulation" | "mixed";
  passPercent: number;
  maxAttempts: number | null;
  timeLimitSeconds: number | null;
  xpReward: number;
  sortOrder: number;
  config: GameConfig;
  achievements: { suffix: "kids" | "professional"; name: string; description: string; icon: string }[];
}

const opt = (id: string, text: string, emoji?: string) => ({ id, text, emoji });

export const exploradorDigital: GameSeed = {
  code: "desafio-explorador-digital",
  title: "Desafio do Explorador Digital",
  description:
    "Uma aventura em 6 fases para mostrar o que você já sabe: componentes do computador, teclas, arquivos, salvar documentos e internet segura.",
  instructions:
    "Cada fase tem alguns desafios. Errou? Sem problema: você pode tentar de novo (a nota só cai um pouco). Para abrir a próxima fase, termine a atual com o mínimo pedido. No final você ganha estrelas e XP!",
  audience: "all",
  difficulty: "facil",
  gameType: "mixed",
  passPercent: 70,
  maxAttempts: null,
  timeLimitSeconds: null,
  xpReward: 100,
  sortOrder: 1,
  achievements: [
    { suffix: "kids", name: "Explorador Digital", description: "Concluiu o Desafio do Explorador Digital.", icon: "🧭" },
    { suffix: "professional", name: "Explorador Digital", description: "Concluiu o Desafio do Explorador Digital.", icon: "🧭" },
  ],
  config: {
    phases: [
      {
        id: "componentes",
        title: "Conheça o computador",
        description: "Quem faz o quê dentro e fora do gabinete.",
        emoji: "💻",
        minPercent: 0,
        challenges: [
          {
            id: "entrada-saida",
            kind: "drag",
            skill: "computador",
            title: "Entra ou sai?",
            prompt: "Arraste cada peça para o lugar certo: quem manda informação para o computador e quem mostra o resultado.",
            points: 12,
            maxTries: 3,
            explain: "Teclado, mouse e microfone ENVIAM informação (entrada). Monitor, caixa de som e impressora MOSTRAM o resultado (saída).",
            config: {
              items: [
                { id: "teclado", label: "Teclado", emoji: "⌨️" },
                { id: "mouse", label: "Mouse", emoji: "🖱️" },
                { id: "microfone", label: "Microfone", emoji: "🎤" },
                { id: "monitor", label: "Monitor", emoji: "🖥️" },
                { id: "caixa", label: "Caixa de som", emoji: "🔊" },
                { id: "impressora", label: "Impressora", emoji: "🖨️" },
              ],
              zones: [
                { id: "entrada", label: "Entrada (envia)", emoji: "➡️" },
                { id: "saida", label: "Saída (mostra)", emoji: "⬅️" },
              ],
              answer: { teclado: "entrada", mouse: "entrada", microfone: "entrada", monitor: "saida", caixa: "saida", impressora: "saida" },
              hint: "Pergunte: essa peça ENVIA algo ao computador ou MOSTRA algo para mim?",
            },
          },
          {
            id: "cerebro",
            kind: "choice",
            skill: "computador",
            title: "O cérebro do computador",
            prompt: "Qual peça faz as contas e executa as ordens do computador?",
            points: 8,
            maxTries: 3,
            explain: "O processador (CPU) é o cérebro: ele executa as ordens dos programas.",
            config: {
              question: "Qual peça executa as ordens dos programas?",
              options: [opt("cpu", "Processador (CPU)", "🧠"), opt("monitor", "Monitor", "🖥️"), opt("mouse", "Mouse", "🖱️"), opt("caixa", "Caixa de som", "🔊")],
              answer: ["cpu"],
              display: "cards",
              hint: "Ele fica dentro do gabinete.",
            },
          },
          {
            id: "funcoes",
            kind: "match",
            skill: "computador",
            title: "Ligue a peça à função",
            prompt: "Ligue cada componente ao que ele faz.",
            points: 10,
            maxTries: 3,
            config: {
              pairs: [
                { left: "Monitor", right: "Mostra imagens e textos", emoji: "🖥️" },
                { left: "Mouse", right: "Aponta e clica na tela", emoji: "🖱️" },
                { left: "Teclado", right: "Escreve letras e números", emoji: "⌨️" },
                { left: "Pen drive", right: "Guarda e leva arquivos", emoji: "💾" },
              ],
              hint: "Comece pelas peças que você usa todo dia.",
            },
          },
        ],
      },
      {
        id: "teclas",
        title: "As teclas certas",
        description: "Teclas importantes e uma frase bem escrita.",
        emoji: "⌨️",
        minPercent: 50,
        challenges: [
          {
            id: "teclas-funcoes",
            kind: "match",
            skill: "teclado",
            title: "Ligue a tecla à função",
            prompt: "Cada tecla tem um trabalho. Ligue as duas colunas.",
            points: 10,
            maxTries: 3,
            config: {
              pairs: [
                { left: "Enter", right: "Pula para a linha de baixo" },
                { left: "Backspace", right: "Apaga a letra de trás" },
                { left: "Shift", right: "Escreve letra maiúscula" },
                { left: "Barra de espaço", right: "Separa as palavras" },
              ],
              hint: "Shift segura a letra para ficar GRANDE.",
            },
          },
          {
            id: "apagar",
            kind: "choice",
            skill: "teclado",
            title: "Corrigindo um erro",
            prompt: "Você digitou uma letra errada logo agora, antes do cursor. Qual tecla corrige?",
            points: 8,
            maxTries: 3,
            explain: "Backspace apaga a letra que está ANTES do cursor. Delete apaga a que está DEPOIS.",
            config: {
              question: "Qual tecla apaga a letra que está antes do cursor?",
              options: [opt("backspace", "Backspace ⌫"), opt("enter", "Enter ↵"), opt("tab", "Tab"), opt("esc", "Esc")],
              answer: ["backspace"],
              display: "keys",
              hint: "Ela tem uma seta apontando para a esquerda.",
            },
          },
          {
            id: "frase",
            kind: "type",
            skill: "teclado",
            title: "Escreva uma frase",
            prompt: "Escreva uma frase completa: comece com letra maiúscula e termine com ponto.",
            points: 12,
            maxTries: 3,
            config: {
              fields: [
                { id: "f1", label: "Sua frase (3 palavras ou mais)", mode: "free", mustStartUpper: true, mustEndPunct: true, minWords: 3 },
              ],
              hint: "Use Shift para a primeira letra. Exemplo: Hoje eu aprendi muito.",
            },
          },
        ],
      },
      {
        id: "arquivos",
        title: "Organize os arquivos",
        description: "Pastas e nomes que ajudam a encontrar tudo.",
        emoji: "📁",
        minPercent: 50,
        challenges: [
          {
            id: "pastas",
            kind: "files",
            skill: "arquivos",
            title: "Arrume a bagunça",
            prompt: "Crie a pasta e guarde cada arquivo no lugar certo.",
            points: 15,
            maxTries: 3,
            explain: "Pastas organizadas deixam tudo fácil de achar: cada arquivo mora na pasta do seu assunto.",
            config: {
              initialFolders: [],
              initialFiles: [
                { name: "carta.docx", folder: "", emoji: "📝" },
                { name: "foto-festa.png", folder: "", emoji: "🖼️" },
              ],
              instructions: [
                "Crie a pasta Meus Arquivos.",
                "Dentro dela, crie as pastas Textos e Fotos.",
                "Guarde carta.docx em Textos e foto-festa.png em Fotos.",
              ],
              goals: [
                { type: "folder_exists", path: "Meus Arquivos/Textos" },
                { type: "folder_exists", path: "Meus Arquivos/Fotos" },
                { type: "file_in", orig: "carta.docx", folder: "Meus Arquivos/Textos" },
                { type: "file_in", orig: "foto-festa.png", folder: "Meus Arquivos/Fotos" },
              ],
              hint: "Crie as pastas antes de mover os arquivos.",
            },
          },
          {
            id: "bom-nome",
            kind: "choice",
            skill: "arquivos",
            title: "O melhor nome",
            prompt: "Qual nome ajuda mais a encontrar o arquivo depois?",
            points: 8,
            maxTries: 3,
            explain: "Um bom nome diz o assunto e a data. 'relatorio-vendas-outubro' você encontra em segundos; 'novo' e 'asdf' não dizem nada.",
            config: {
              question: "Qual é o melhor nome para o relatório de vendas de outubro?",
              options: [opt("a", "novo.docx"), opt("b", "relatorio-vendas-outubro.docx"), opt("c", "asdf.docx"), opt("d", "documento1 (1).docx")],
              answer: ["b"],
              hint: "O nome deve contar o assunto.",
            },
          },
        ],
      },
      {
        id: "salvar",
        title: "Salve o seu documento",
        description: "Nunca perca o que você escreveu.",
        emoji: "💾",
        minPercent: 50,
        challenges: [
          {
            id: "passos-salvar",
            kind: "order",
            skill: "producao",
            title: "Passos para salvar",
            prompt: "Coloque os passos para salvar um documento novo na ordem certa.",
            points: 12,
            maxTries: 3,
            config: {
              items: [
                "Clicar em Arquivo",
                "Escolher Salvar como",
                "Escolher a pasta onde guardar",
                "Digitar um nome para o arquivo",
                "Clicar no botão Salvar",
              ],
              hint: "Primeiro o menu, por último o botão.",
            },
          },
          {
            id: "fechar-sem-salvar",
            kind: "choice",
            skill: "producao",
            title: "E se eu fechar sem salvar?",
            prompt: "Você escreveu por uma hora e clicou no X sem salvar. O que costuma acontecer?",
            points: 8,
            maxTries: 3,
            explain: "Sem salvar, o texto pode ser perdido. Salve logo no começo e de tempos em tempos.",
            config: {
              question: "O que pode acontecer se você fechar o documento sem salvar?",
              options: [opt("perde", "Você pode perder o que escreveu"), opt("auto", "O computador sempre salva sozinho"), opt("imprime", "O documento é impresso"), opt("nada", "Nada, o texto fica guardado para sempre")],
              answer: ["perde"],
              hint: "Pense no que o botão Salvar faz.",
            },
          },
          {
            id: "digitar-nome",
            kind: "type",
            skill: "producao",
            title: "Digite o nome do arquivo",
            prompt: "Digite exatamente o nome que combinamos para o arquivo.",
            points: 6,
            maxTries: 3,
            config: {
              fields: [{ id: "nome", label: "Nome do arquivo", mode: "copy", target: "carta-para-a-escola" }],
              hint: "Copie letra por letra, com os hífens.",
            },
          },
        ],
      },
      {
        id: "internet",
        title: "Internet com segurança",
        description: "Decida bem antes de clicar.",
        emoji: "🌐",
        minPercent: 60,
        challenges: [
          {
            id: "seguro-ou-nao",
            kind: "drag",
            skill: "seguranca",
            title: "Seguro ou perigoso?",
            prompt: "Arraste cada situação para a caixa certa.",
            points: 14,
            maxTries: 3,
            explain: "Dados pessoais, senhas e links desconhecidos são perigosos. Sites conhecidos com cadeado e atualizações oficiais são seguros.",
            config: {
              items: [
                { id: "senha-msg", label: "Mandar minha senha por mensagem", emoji: "🔑" },
                { id: "cadeado", label: "Site conhecido com cadeado", emoji: "🔒" },
                { id: "premio", label: "Clicar em 'Você ganhou um prêmio!'", emoji: "🎁" },
                { id: "atualizar", label: "Atualizar o programa pela loja oficial", emoji: "🛒" },
                { id: "anexo", label: "Abrir anexo de quem não conheço", emoji: "📎" },
                { id: "adulto", label: "Pedir ajuda a um adulto ou ao professor", emoji: "🙋" },
              ],
              zones: [
                { id: "seguro", label: "Seguro", emoji: "✅" },
                { id: "perigoso", label: "Perigoso", emoji: "⚠️" },
              ],
              answer: { "senha-msg": "perigoso", cadeado: "seguro", premio: "perigoso", atualizar: "seguro", anexo: "perigoso", adulto: "seguro" },
              hint: "Se pede dados secretos ou promete prêmio fácil, desconfie.",
            },
          },
          {
            id: "mensagem-premio",
            kind: "choice",
            skill: "seguranca",
            title: "Mensagem suspeita",
            prompt: "Chegou uma mensagem: 'Clique já e ganhe um celular grátis!'. O que fazer?",
            points: 10,
            maxTries: 3,
            explain: "Prêmios fáceis são golpes. Não clique, não responda: avise um adulto e apague a mensagem.",
            config: {
              question: "Qual é a melhor decisão?",
              options: [opt("clicar", "Clicar para ver"), opt("avisar", "Não clicar, avisar um adulto e apagar"), opt("enviar", "Mandar para todos os amigos"), opt("senha", "Digitar minha senha para receber")],
              answer: ["avisar"],
              hint: "Quem dá prêmio de graça, sem motivo, quer algo seu.",
            },
          },
          {
            id: "site-seguro",
            kind: "choice",
            skill: "internet",
            title: "Sinais de um site confiável",
            prompt: "Marque TODOS os sinais de que um site é mais confiável.",
            points: 10,
            maxTries: 3,
            config: {
              question: "Quais são bons sinais?",
              options: [
                opt("cadeado", "Cadeado e https:// no endereço"),
                opt("conhecido", "É um endereço que eu e meu professor conhecemos"),
                opt("urgente", "Pede tudo com urgência: 'clique agora ou perde!'"),
                opt("erros", "Tem muitos erros de escrita no endereço"),
              ],
              answer: ["cadeado", "conhecido"],
              multiple: true,
              hint: "São duas respostas.",
            },
          },
        ],
      },
      {
        id: "final",
        title: "Desafio final",
        description: "Junte tudo o que aprendeu.",
        emoji: "🏆",
        minPercent: 60,
        challenges: [
          {
            id: "janelas",
            kind: "desktop",
            skill: "computador",
            title: "Domine as janelas",
            prompt: "No mini computador, abra programas, troque de janela e minimize uma.",
            points: 12,
            maxTries: 3,
            config: { required: ["open", "switch", "minimize"], hint: "A barra de baixo mostra as janelas abertas." },
          },
          {
            id: "projeto-final",
            kind: "files",
            skill: "arquivos",
            title: "Guarde a pesquisa",
            prompt: "Crie a pasta da pesquisa e guarde o resultado nela.",
            points: 12,
            maxTries: 3,
            config: {
              initialFolders: [],
              initialFiles: [{ name: "resultado.txt", folder: "", emoji: "📝" }],
              instructions: ["Crie a pasta Pesquisa.", "Guarde resultado.txt dentro de Pesquisa."],
              goals: [
                { type: "folder_exists", path: "Pesquisa" },
                { type: "file_in", orig: "resultado.txt", folder: "Pesquisa" },
              ],
              hint: "Crie a pasta primeiro.",
            },
          },
          {
            id: "pesquisa-segura",
            kind: "order",
            skill: "internet",
            title: "Pesquisa segura, do começo ao fim",
            prompt: "Coloque na ordem: fazer uma pesquisa segura e guardar o resultado.",
            points: 12,
            maxTries: 3,
            explain: "Pesquisar com cuidado, conferir a fonte e salvar com um bom nome é a rotina de um explorador digital.",
            config: {
              items: [
                "Abrir o navegador e digitar o assunto",
                "Escolher um site conhecido e confiável",
                "Ler e copiar o que for útil",
                "Salvar o texto com um bom nome",
                "Fechar as janelas que não precisa",
              ],
              hint: "Pesquise, confira, use, guarde, arrume.",
            },
          },
          {
            id: "decisao-final",
            kind: "choice",
            skill: "seguranca",
            title: "Decisão final",
            prompt: "Um site que você nunca viu pede seu nome completo, endereço e senha para 'liberar a pesquisa'. O que faz?",
            points: 10,
            maxTries: 3,
            explain: "Nenhuma pesquisa precisa da sua senha ou endereço. Saia do site e conte a um adulto.",
            config: {
              question: "Qual é a atitude certa?",
              options: [opt("preencher", "Preencher tudo rápido"), opt("sair", "Sair do site e contar a um adulto"), opt("amigos", "Passar o link para os amigos"), opt("senha", "Usar a mesma senha do e-mail")],
              answer: ["sair"],
              hint: "Dados pessoais e senhas ficam só com você.",
            },
          },
        ],
      },
    ],
  },
};

export const GAME_SEEDS: GameSeed[] = [exploradorDigital];
