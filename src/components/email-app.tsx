"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { InternalMessage } from "@/types";

type Recipient = { id: string; name: string; email: string; role: string };
type Box = "inbox" | "sent";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmailApp({ currentUserId }: { currentUserId: string }) {
  const [box, setBox] = useState<Box>("inbox");
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [selected, setSelected] = useState<InternalMessage | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [mode, setMode] = useState<"view" | "compose">("view");

  // Campos do formulário de composição
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [parentMessageId, setParentMessageId] = useState<string | undefined>();
  const [isForward, setIsForward] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function loadMessages(targetBox: Box) {
    const res = await fetch(`/api/messages?box=${targetBox}`);
    const data = await res.json();
    setMessages(data.messages ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/messages?box=${box}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMessages(data.messages ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [box]);

  useEffect(() => {
    fetch("/api/messages/recipients")
      .then((r) => r.json())
      .then((d) => setRecipients(d.recipients ?? []));
  }, []);

  async function openMessage(id: string) {
    const res = await fetch(`/api/messages/${id}`);
    const data = await res.json();
    if (res.ok) {
      setSelected(data.message);
      setMode("view");
      if (box === "inbox") loadMessages("inbox"); // atualiza contagem de não lidas
    }
  }

  function startCompose() {
    setSelected(null);
    setMode("compose");
    setRecipientId("");
    setSubject("");
    setBody("");
    setAttachmentUrl("");
    setParentMessageId(undefined);
    setIsForward(false);
    setError(null);
  }

  function startReply(message: InternalMessage) {
    setMode("compose");
    setRecipientId(message.sender_id);
    setSubject(
      message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`
    );
    setBody(`\n\n--- Mensagem original ---\n${message.body}`);
    setAttachmentUrl("");
    setParentMessageId(message.id);
    setIsForward(false);
    setError(null);
  }

  function startForward(message: InternalMessage) {
    setMode("compose");
    setRecipientId("");
    setSubject(
      message.subject.startsWith("Fwd:") ? message.subject : `Fwd: ${message.subject}`
    );
    setBody(`\n\n--- Mensagem encaminhada ---\nDe: ${message.sender_name}\n${message.body}`);
    setAttachmentUrl(message.attachment_url ?? "");
    setParentMessageId(message.id);
    setIsForward(true);
    setError(null);
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!recipientId) {
      setError("Selecione um destinatário.");
      return;
    }

    setSending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId,
        subject,
        body,
        attachmentUrl,
        parentMessageId,
        isForward,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Não foi possível enviar a mensagem.");
      setSending(false);
      return;
    }

    setSending(false);
    setMode("view");
    setBox("sent");
    loadMessages("sent");
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <div>
        <button
          onClick={startCompose}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          Nova mensagem
        </button>

        <div className="mt-4 flex gap-1 rounded-md border border-border bg-surface p-1">
          <button
            onClick={() => {
              setBox("inbox");
              setSelected(null);
              setMode("view");
            }}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition ${
              box === "inbox" ? "bg-primary-light text-primary-dark" : "text-muted"
            }`}
          >
            Caixa de entrada
          </button>
          <button
            onClick={() => {
              setBox("sent");
              setSelected(null);
              setMode("view");
            }}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition ${
              box === "sent" ? "bg-primary-light text-primary-dark" : "text-muted"
            }`}
          >
            Enviados
          </button>
        </div>

        <ul className="mt-4 flex flex-col gap-1">
          {messages.length === 0 && (
            <li className="rounded-md px-3 py-4 text-sm text-muted">
              Nenhuma mensagem aqui.
            </li>
          )}
          {messages.map((m) => {
            const unread = box === "inbox" && !m.read_at;
            return (
              <li key={m.id}>
                <button
                  onClick={() => openMessage(m.id)}
                  className={`w-full rounded-md px-3 py-2.5 text-left text-sm transition hover:bg-background ${
                    selected?.id === m.id ? "bg-background" : ""
                  }`}
                >
                  <p className={`truncate ${unread ? "font-semibold text-foreground" : "text-foreground"}`}>
                    {box === "inbox" ? m.sender_name : m.recipient_name}
                  </p>
                  <p className={`truncate text-xs ${unread ? "font-medium text-foreground" : "text-muted"}`}>
                    {m.subject}
                  </p>
                  <p className="text-xs text-muted">{formatDate(m.created_at)}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        {mode === "compose" && (
          <form onSubmit={handleSend} className="flex flex-col gap-4">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {parentMessageId ? "Responder / encaminhar" : "Nova mensagem"}
            </h2>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Para
              </label>
              <select
                required
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione um destinatário</option>
                {recipients
                  .filter((r) => r.id !== currentUserId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.email})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Assunto
              </label>
              <input
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Mensagem
              </label>
              <textarea
                required
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Anexar link (opcional)
              </label>
              <input
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className={inputClass}
              />
            </div>

            {error && (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={sending}
                className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
              >
                {sending ? "Enviando…" : "Enviar"}
              </button>
              <button
                type="button"
                onClick={() => setMode("view")}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-background"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {mode === "view" && selected && (
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {selected.subject}
            </h2>
            <p className="mt-1 text-sm text-muted">
              De {selected.sender_name} ({selected.sender_email}) para{" "}
              {selected.recipient_name} · {formatDate(selected.created_at)}
            </p>

            <p className="mt-4 whitespace-pre-wrap text-sm text-foreground">
              {selected.body}
            </p>

            {selected.attachment_url && (
              <a
                href={selected.attachment_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-2"
              >
                Baixar anexo
              </a>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => startReply(selected)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
              >
                Responder
              </button>
              <button
                onClick={() => startForward(selected)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-background"
              >
                Encaminhar
              </button>
            </div>
          </div>
        )}

        {mode === "view" && !selected && (
          <p className="text-sm text-muted">Selecione uma mensagem para ler.</p>
        )}
      </div>
    </div>
  );
}
