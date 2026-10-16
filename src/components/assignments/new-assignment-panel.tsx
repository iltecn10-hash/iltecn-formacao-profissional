"use client";

import { useState } from "react";
import { AssignmentForm } from "./assignment-form";

/** Botão "+ Nova atividade" que abre/fecha o formulário (abre sozinho quando ainda não há atividades). */
export function NewAssignmentPanel({
  classes,
  startOpen,
}: {
  classes: { id: string; name: string }[];
  startOpen: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="mt-6">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn btn-primary">
        {open ? "Fechar" : "+ Nova atividade"}
      </button>
      {open && (
        <div className="mt-4 card p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">Nova atividade</h2>
          <div className="mt-4">
            <AssignmentForm classes={classes} onCreated={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
