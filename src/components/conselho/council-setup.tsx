"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Assignment, Criterion, Period, Subject } from "@/modules/council/queries";

const input =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const btn = "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60";
const ghost = "rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-background disabled:opacity-60";

interface Props {
  manager: boolean; schoolId: string; year: number;
  subjects: Subject[]; periods: Period[]; criteria: Criterion[]; assignments: Assignment[];
  classes: { id: string; name: string }[]; teachers: { id: string; name: string }[];
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-8 card p-6">
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function CouncilSetup(p: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: string, body: unknown, ok: string) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: data.error ?? "Não foi possível concluir." }); return false; }
      setMsg({ ok: true, text: ok }); router.refresh(); return true;
    } catch { setMsg({ ok: false, text: "Sem conexão. Tente de novo." }); return false; }
    finally { setBusy(false); }
  }

  const [subjectName, setSubjectName] = useState("");
  const [criterionLabel, setCriterionLabel] = useState("");
  const [criterionKind, setCriterionKind] = useState<"yesno" | "text">("yesno");
  const [cls, setCls] = useState(""); const [sub, setSub] = useState(""); const [tch, setTch] = useState(p.manager ? "" : p.teachers[0]?.id ?? "");

  const addSubject = async (e: FormEvent) => {
    e.preventDefault();
    if (await call("/api/conselho/disciplinas", "POST", { schoolId: p.schoolId, name: subjectName }, "Disciplina cadastrada.")) setSubjectName("");
  };
  const addCriterion = async (e: FormEvent) => {
    e.preventDefault();
    if (await call("/api/conselho/criterios", "POST", { schoolId: p.schoolId, label: criterionLabel, kind: criterionKind }, "Critério criado.")) setCriterionLabel("");
  };
  const addAssignment = async (e: FormEvent) => {
    e.preventDefault();
    await call("/api/conselho/vinculos", "POST", { classId: cls, subjectId: sub, teacherId: tch }, "Vínculo salvo.");
  };

  return (
    <div>
      {msg && <p role="status" className={`mt-4 rounded-md px-4 py-3 text-sm ${msg.ok ? "bg-success-light text-success" : "bg-danger-light text-danger"}`}>{msg.text}</p>}

      <Section title="Disciplinas" hint="Professores, coordenadores e administradores podem cadastrar novas. Nomes repetidos são reaproveitados.">
        <form onSubmit={addSubject} className="flex flex-wrap gap-2">
          <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Nova disciplina" maxLength={120} required minLength={2} className={`${input} min-w-64 flex-1`} />
          <button className={btn} disabled={busy}>Cadastrar</button>
        </form>
        <ul className="mt-4 flex flex-wrap gap-2">
          {p.subjects.map((s) => (
            <li key={s.id} className={`flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm ${s.active ? "" : "text-muted line-through"}`}>
              {s.name}
              {p.manager && (
                <button type="button" disabled={busy} className="text-xs text-primary-dark hover:underline"
                  onClick={() => call(`/api/conselho/disciplinas/${s.id}`, "PATCH", { active: !s.active }, s.active ? "Disciplina desativada." : "Disciplina reativada.")}>
                  {s.active ? "desativar" : "reativar"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Vínculos: turma × disciplina × professor"
        hint={p.manager ? "Defina quem leciona cada disciplina em cada turma. Só o professor vinculado avalia." : "Você só pode se vincular às turmas pelas quais é responsável."}>
        <form onSubmit={addAssignment} className="flex flex-wrap items-end gap-2">
          <select required value={cls} onChange={(e) => setCls(e.target.value)} className={input} aria-label="Turma">
            <option value="">Turma…</option>{p.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select required value={sub} onChange={(e) => setSub(e.target.value)} className={input} aria-label="Disciplina">
            <option value="">Disciplina…</option>{p.subjects.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select required value={tch} onChange={(e) => setTch(e.target.value)} className={input} aria-label="Professor">
            <option value="">Professor…</option>{p.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <button className={btn} disabled={busy}>Vincular</button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-1">Turma</th><th>Disciplina</th><th>Professor(a)</th><th /></tr></thead>
            <tbody>
              {p.assignments.length === 0 && <tr><td colSpan={4} className="py-3 text-muted">Nenhum vínculo neste ano.</td></tr>}
              {p.assignments.map((a) => (
                <tr key={a.id} className={`border-t border-border ${a.active ? "" : "text-muted line-through"}`}>
                  <td className="py-2">{a.class_name}</td><td>{a.subject_name}</td><td>{a.teacher_name}</td>
                  <td className="text-right">{p.manager && (
                    <button type="button" disabled={busy} className={ghost}
                      onClick={() => call(`/api/conselho/vinculos/${a.id}`, "PATCH", { active: !a.active }, a.active ? "Vínculo desativado." : "Vínculo reativado.")}>
                      {a.active ? "Desativar" : "Reativar"}</button>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {p.manager && (
        <>
          <Section title={`Bimestres de ${p.year}`} hint="Bimestre encerrado não aceita novas avaliações nem reaberturas.">
            <ul className="flex flex-col gap-3">
              {p.periods.map((per) => <PeriodRow key={per.id} period={per} busy={busy} call={call} />)}
            </ul>
          </Section>

          <Section title="Critérios do formulário" hint="Valem para toda a escola. Desativar não apaga respostas já registradas: o histórico mantém o texto da época.">
            <form onSubmit={addCriterion} className="flex flex-wrap gap-2">
              <input value={criterionLabel} onChange={(e) => setCriterionLabel(e.target.value)} placeholder="Novo critério" minLength={3} maxLength={200} required className={`${input} min-w-64 flex-1`} />
              <select value={criterionKind} onChange={(e) => setCriterionKind(e.target.value as "yesno" | "text")} className={input} aria-label="Tipo">
                <option value="yesno">Sim / Não</option><option value="text">Texto livre</option></select>
              <button className={btn} disabled={busy}>Adicionar</button>
            </form>
            <ul className="mt-4 flex flex-col gap-2">
              {p.criteria.map((c) => <CriterionRow key={c.id} c={c} busy={busy} call={call} />)}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}

type Call = (url: string, method: string, body: unknown, ok: string) => Promise<boolean>;

function PeriodRow({ period, busy, call }: { period: Period; busy: boolean; call: Call }) {
  const [start, setStart] = useState(period.starts_on ?? ""); const [end, setEnd] = useState(period.ends_on ?? "");
  return (
    <li className="flex flex-wrap items-end gap-3">
      <span className="w-28 text-sm font-medium">{period.name}</span>
      <label className="text-xs text-muted">Início<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`${input} mt-1 block`} /></label>
      <label className="text-xs text-muted">Fim<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={`${input} mt-1 block`} /></label>
      <button type="button" disabled={busy} className={ghost}
        onClick={() => call(`/api/conselho/periodos/${period.id}`, "PATCH", { startsOn: start || null, endsOn: end || null }, "Datas salvas.")}>Salvar datas</button>
      <button type="button" disabled={busy} className={ghost}
        onClick={() => call(`/api/conselho/periodos/${period.id}`, "PATCH", { status: period.status === "open" ? "closed" : "open" }, period.status === "open" ? "Bimestre encerrado." : "Bimestre reaberto.")}>
        {period.status === "open" ? "Encerrar bimestre" : "Reabrir bimestre"}</button>
      <span className={`text-xs font-semibold ${period.status === "open" ? "text-primary-dark" : "text-muted"}`}>{period.status === "open" ? "Aberto" : "Encerrado"}</span>
    </li>
  );
}

function CriterionRow({ c, busy, call }: { c: Criterion; busy: boolean; call: Call }) {
  const [label, setLabel] = useState(c.label);
  return (
    <li className={`flex flex-wrap items-center gap-2 ${c.active ? "" : "opacity-60"}`}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} aria-label="Texto do critério" className={`${input} min-w-64 flex-1`} />
      <span className="text-xs text-muted">{c.kind === "level" ? "Escolha" : c.kind === "yesno" ? "Sim/Não" : "Texto"}</span>
      <button type="button" className={ghost} disabled={busy || label.trim() === c.label || label.trim().length < 3}
        onClick={() => call(`/api/conselho/criterios/${c.id}`, "PATCH", { label }, "Texto atualizado.")}>Salvar texto</button>
      <button type="button" className={ghost} disabled={busy}
        onClick={() => call(`/api/conselho/criterios/${c.id}`, "PATCH", { active: !c.active }, c.active ? "Critério desativado." : "Critério reativado.")}>
        {c.active ? "Desativar" : "Reativar"}</button>
    </li>
  );
}
