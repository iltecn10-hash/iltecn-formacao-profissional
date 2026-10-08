/* eslint-disable @typescript-eslint/no-explicit-any -- gabaritos JSON de teste */
import type { ActivityKind } from "@/lib/lab/activities";

/** Monta a resposta CORRETA de uma atividade a partir do gabarito (só para testes). */
export function solve(kind: ActivityKind, config: any): unknown {
  switch (kind) {
    case "choice":
      return { selected: config.answer };
    case "match":
      return { pairs: Object.fromEntries(config.pairs.map((p: any) => [p.left, p.right])) };
    case "order":
      return { order: config.items };
    case "drag":
      return { placements: config.answer };
    case "type": {
      const values: Record<string, string> = {};
      for (const f of config.fields) {
        if (f.mode === "copy") values[f.id] = f.target;
        else if (f.digitsOnly) values[f.id] = "1".repeat(Math.max(f.minChars ?? 1, 3));
        else {
          const words = Math.max(f.minWords ?? 1, 2);
          let t = "Eu" + " gosto".repeat(words) + " muito de aprender computador.";
          while (t.length < (f.minChars ?? 1)) t += " mais";
          values[f.id] = t;
        }
      }
      return { values };
    }
    case "files": {
      const folders: string[] = [...config.initialFolders];
      const files = config.initialFiles.map((f: any) => ({
        orig: f.name, name: f.name, folder: f.folder, deleted: false, isCopy: false,
      }));
      for (const g of config.goals) {
        if (g.type === "folder_exists" && !folders.includes(g.path)) folders.push(g.path);
      }
      for (const g of config.goals) {
        if (g.type === "file_in") {
          if (!folders.includes(g.folder)) folders.push(g.folder);
          const f = files.find((x: any) => x.orig === g.orig);
          if (f) f.folder = g.folder;
        }
        if (g.type === "file_renamed") {
          const f = files.find((x: any) => x.orig === g.orig);
          if (f) f.name = g.to;
        }
        if (g.type === "file_deleted") {
          const f = files.find((x: any) => x.orig === g.orig);
          if (f) f.deleted = true;
        }
        if (g.type === "file_copied") {
          if (!folders.includes(g.folder)) folders.push(g.folder);
          const f = files.find((x: any) => x.orig === g.orig);
          files.push({ orig: g.orig, name: f?.name ?? g.orig, folder: g.folder, deleted: false, isCopy: true });
        }
      }
      return { folders, files };
    }
    case "gesture":
      return { done: true };
    case "draw":
      return { strokes: config.minStrokes, colors: config.minColors };
    case "desktop":
      return { actions: config.required };
  }
}
