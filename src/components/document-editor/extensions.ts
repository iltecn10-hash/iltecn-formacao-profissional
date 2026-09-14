import { Extension } from "@tiptap/core";

/**
 * Tamanho de fonte — não vem no @tiptap/starter-kit nem como pacote oficial
 * separado; é uma extensão pequena que anexa o atributo `fontSize` à marca
 * `textStyle` (já trazida por @tiptap/extension-text-style). Evita adicionar
 * mais uma dependência externa só para isso (seção 31 da Fase 9).
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).run(),
    };
  },
});

/**
 * Indentação básica de parágrafo/título (seção 4 — "indentação básica").
 * Guarda o nível (0–8) como `margin-left` no próprio nó, sem precisar de
 * pacote externo.
 */
const INDENT_STEP_PX = 24;
const MAX_INDENT_LEVEL = 8;

export const Indent = Extension.create({
  name: "indent",
  addOptions() {
    return { types: ["paragraph", "heading"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const margin = element.style.marginLeft;
              if (!margin) return 0;
              const px = parseInt(margin, 10);
              return Number.isFinite(px) ? Math.max(0, Math.round(px / INDENT_STEP_PX)) : 0;
            },
            renderHTML: (attributes: { indent?: number }) => {
              const level = attributes.indent ?? 0;
              if (!level) return {};
              return { style: `margin-left: ${level * INDENT_STEP_PX}px` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      indent:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          const node = $from.parent;
          if (!this.options.types.includes(node.type.name)) return false;
          const current = (node.attrs.indent as number) ?? 0;
          if (current >= MAX_INDENT_LEVEL) return false;
          if (dispatch) {
            tr.setNodeMarkup($from.before(), undefined, { ...node.attrs, indent: current + 1 });
            dispatch(tr);
          }
          return true;
        },
      outdent:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          const node = $from.parent;
          if (!this.options.types.includes(node.type.name)) return false;
          const current = (node.attrs.indent as number) ?? 0;
          if (current <= 0) return false;
          if (dispatch) {
            tr.setNodeMarkup($from.before(), undefined, {
              ...node.attrs,
              indent: Math.max(0, current - 1),
            });
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
