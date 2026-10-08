/** LIA — a guia do ILTECN LAB. Mensagens prontas (sem IA, sem custo, sem risco). */
export const LIA_MESSAGES = {
  welcome: "Oi! Eu sou a LIA. Vou te guiar em cada passo. Sem pressa, tá? 💚",
  learn: "Primeiro vamos entender o assunto. Leia com calma!",
  watch: "Agora veja como se faz, passo a passo.",
  practice: "Hora de praticar! Se errar, tudo bem: dá para tentar de novo.",
  challenge: "Chegou o desafio! Eu sei que você consegue. 🚀",
  conquer: "Você terminou as atividades! Vamos conquistar esta aula?",
  tryAgain: "Quase! Respire fundo e tente de novo. Eu confio em você.",
  hint: "Uma dica: ",
  done: "Aula concluída! Que orgulho de você! 🎉",
  locked: "Termine a aula anterior para abrir esta. Um passo de cada vez!",
} as const;

export function Lia({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3" role="status">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-2xl shadow"
        aria-hidden
      >
        🤖
      </span>
      <div className="rounded-2xl rounded-tl-sm bg-primary-light px-4 py-3 text-base text-primary-dark">
        <span className="sr-only">LIA diz: </span>
        <strong className="mr-1">LIA</strong>
        {text}
      </div>
    </div>
  );
}
