"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useEffect } from "react";
import { DocumentToolbar } from "./toolbar";
import { FontSize, Indent } from "./extensions";

/**
 * Um campo de texto rico do documento (o "conteúdo" de um memorando, a
 * "introdução" de um relatório, ou o corpo inteiro quando não há modelo).
 * Cada campo richtext do documento tem sua própria instância do editor.
 */
export function RichField({
  label,
  content,
  editable,
  onChange,
}: {
  label: string;
  content: Record<string, unknown> | undefined;
  editable: boolean;
  onChange: (json: Record<string, unknown>) => void;
}) {
  const editor = useEditor({
    editable,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Underline,
      TextStyle,
      FontSize,
      Indent,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content && Object.keys(content).length > 0 ? content : "<p></p>",
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as unknown as Record<string, unknown>);
    },
    editorProps: {
      attributes: {
        class: "prose-doc min-h-[10rem] max-w-none px-4 py-3 focus:outline-none",
      },
    },
  });

  // Mantém o editor em modo somente-leitura quando o trabalho já foi entregue.
  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {editable && <DocumentToolbar editor={editor} />}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
