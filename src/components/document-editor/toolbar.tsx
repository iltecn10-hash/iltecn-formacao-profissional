"use client";

import type { Editor } from "@tiptap/react";

const FONT_SIZES = [
  { label: "Pequeno", value: "12px" },
  { label: "Normal", value: "14px" },
  { label: "Médio", value: "16px" },
  { label: "Grande", value: "20px" },
  { label: "Título", value: "28px" },
];

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-primary bg-primary-light text-primary-dark"
          : "border-border text-foreground hover:bg-background"
      }`}
    >
      {children}
    </button>
  );
}

/** Barra de ferramentas do editor de documentos (seção 4 da Fase 9). */
export function DocumentToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-t-lg border border-b-0 border-border bg-surface p-2">
      <ToolbarButton label="Desfazer" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        ↶
      </ToolbarButton>
      <ToolbarButton label="Refazer" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        ↷
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <select
        aria-label="Tamanho da fonte"
        className="h-8 rounded-md border border-border bg-surface px-1.5 text-sm"
        onChange={(e) => {
          if (e.target.value === "default") editor.chain().focus().unsetFontSize().run();
          else editor.chain().focus().setFontSize(e.target.value).run();
        }}
        defaultValue="default"
      >
        <option value="default">Tamanho</option>
        {FONT_SIZES.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Estilo de título"
        className="h-8 rounded-md border border-border bg-surface px-1.5 text-sm"
        value={
          editor.isActive("heading", { level: 1 })
            ? "h1"
            : editor.isActive("heading", { level: 2 })
              ? "h2"
              : "p"
        }
        onChange={(e) => {
          const value = e.target.value;
          if (value === "p") editor.chain().focus().setParagraph().run();
          if (value === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run();
          if (value === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
        }}
      >
        <option value="p">Texto normal</option>
        <option value="h1">Título</option>
        <option value="h2">Subtítulo</option>
      </select>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton label="Negrito" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <strong>N</strong>
      </ToolbarButton>
      <ToolbarButton label="Itálico" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton label="Sublinhado" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">S</span>
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton
        label="Alinhar à esquerda"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        ⯇
      </ToolbarButton>
      <ToolbarButton
        label="Centralizar"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        ▬
      </ToolbarButton>
      <ToolbarButton
        label="Alinhar à direita"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        ⯈
      </ToolbarButton>
      <ToolbarButton
        label="Justificar"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      >
        ☰
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton
        label="Lista com marcadores"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •—
      </ToolbarButton>
      <ToolbarButton
        label="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>
      <ToolbarButton label="Diminuir recuo" onClick={() => editor.chain().focus().outdent().run()}>
        ⇤
      </ToolbarButton>
      <ToolbarButton label="Aumentar recuo" onClick={() => editor.chain().focus().indent().run()}>
        ⇥
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton
        label="Inserir tabela"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        ▦
      </ToolbarButton>
      <ToolbarButton
        label="Adicionar linha"
        disabled={!editor.can().addRowAfter()}
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        +L
      </ToolbarButton>
      <ToolbarButton
        label="Remover linha"
        disabled={!editor.can().deleteRow()}
        onClick={() => editor.chain().focus().deleteRow().run()}
      >
        −L
      </ToolbarButton>
      <ToolbarButton
        label="Adicionar coluna"
        disabled={!editor.can().addColumnAfter()}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        +C
      </ToolbarButton>
      <ToolbarButton
        label="Remover coluna"
        disabled={!editor.can().deleteColumn()}
        onClick={() => editor.chain().focus().deleteColumn().run()}
      >
        −C
      </ToolbarButton>
    </div>
  );
}
