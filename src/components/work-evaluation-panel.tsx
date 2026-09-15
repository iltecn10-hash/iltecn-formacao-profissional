"use client";

import { useEffect, useState } from "react";
import type { WorkEvaluation } from "@/types";

const TYPE_LABEL: Record<WorkEvaluation["evaluation_type"], string> = {
  AUTO: "Avaliação automática",
  MANUAL: "Avaliação do professor",
};

/**
 * Renderização pura da lista de avaliações (Fase 9.5: automática; Fase 9.6:
 * manuais do professor na mesma lista). Extraído de `WorkEvaluationPanel`
 * para ser reaproveitado pela página de staff (`/dashboard/trabalhos-alunos`),
 * que já busca os dados no servidor e não precisa de um fetch próprio.
 */
export function EvaluationList({ evaluations }: { evaluations: WorkEvaluation[] }) {
  if (evaluations.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 print:hidden">
      {evaluations.map((ev) => (
        <div
          key={ev.id}
          className="rounded-md border border-border bg-surface px-3.5 py-3 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-foreground">{TYPE_LABEL[ev.evaluation_type]}</span>
            <div className="flex items-center gap-2">
              {ev.score !== null && (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                  {ev.score}/100
                </span>
              )}
              {ev.passed !== null && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    ev.passed
                      ? "bg-primary-light text-primary-dark"
                      : "bg-danger/10 text-danger"
                  }`}
                >
                  {ev.passed ? "Aprovado" : "A revisar"}
                </span>
              )}
            </div>
          </div>
          {ev.feedback && <p className="mt-1.5 text-muted">{ev.feedback}</p>}
        </div>
      ))}
    </div>
  );
}

/**
 * Mostra as avaliações de um trabalho já entregue (Fase 9.5: a automática,
 * calculada na hora da entrega; Fase 9.6 acrescenta as manuais do professor
 * na mesma lista, sem mudar este componente). Só faz sentido depois que o
 * trabalho está travado — antes disso não existe avaliação nenhuma ainda.
 *
 * `refreshKey` (Fase 9.7): valor opcional que, ao mudar, refaz a busca sem
 * desmontar o componente — o chamador passa algo que muda exatamente quando
 * uma avaliação nova pode ter sido criada (ex.: o status do trabalho). Isto
 * substitui uma tentativa anterior de usar `key={status}` no componente pai
 * para forçar remontagem: remontar chegou a causar uma duplicação visual
 * transitória (o componente antigo e o novo coexistindo por um instante),
 * enquanto reagir a uma mudança de prop dentro do mesmo componente não tem
 * esse risco.
 */
export function WorkEvaluationPanel({
  workId,
  refreshKey,
}: {
  workId: string;
  refreshKey?: string | number;
}) {
  const [evaluations, setEvaluations] = useState<WorkEvaluation[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/student-works/${workId}/evaluations`)
      .then((res) => (res.ok ? res.json() : { evaluations: [] }))
      .then((data) => {
        if (!cancelled) setEvaluations(data.evaluations ?? []);
      })
      .catch(() => {
        if (!cancelled) setEvaluations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workId, refreshKey]);

  if (!evaluations) return null;

  return <EvaluationList evaluations={evaluations} />;
}
