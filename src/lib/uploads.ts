import { RecordError } from "@/modules/registry/records";

/** Limite por envio: a Vercel recusa corpos acima de ~4,5 MB, então ficamos abaixo. */
export const MAX_TOTAL_BYTES = 4_000_000;
export const MAX_FILES = 3;

/** Só tipos de documento/imagem comuns. O tipo vem da extensão (nunca do que o navegador diz). */
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  zip: "application/zip",
};

export const ALLOWED_EXTENSIONS = Object.keys(MIME_BY_EXT);

export interface UploadedFile {
  name: string;
  mime: string;
  size: number;
  data: Buffer;
}

export function safeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f"<>|?*:]/g, "").trim().slice(-150);
  return clean || "arquivo";
}

export function mimeForName(name: string): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return name.includes(".") ? (MIME_BY_EXT[ext] ?? null) : null;
}

/** Valida e normaliza os arquivos de um envio (quantidade, tamanho total, extensão). */
export async function readUploads(files: File[]): Promise<UploadedFile[]> {
  const real = files.filter((f) => f && f.size > 0);
  if (real.length > MAX_FILES) throw new RecordError(400, `Envie no máximo ${MAX_FILES} arquivos por vez.`);
  const total = real.reduce((n, f) => n + f.size, 0);
  if (total > MAX_TOTAL_BYTES) throw new RecordError(400, "Os arquivos juntos passam de 4 MB. Envie menos ou compacte.");
  const out: UploadedFile[] = [];
  for (const f of real) {
    const name = safeFileName(f.name);
    const mime = mimeForName(name);
    if (!mime) {
      throw new RecordError(400, `Tipo de arquivo não permitido (${name}). Aceitos: ${ALLOWED_EXTENSIONS.join(", ")}.`);
    }
    out.push({ name, mime, size: f.size, data: Buffer.from(await f.arrayBuffer()) });
  }
  return out;
}
