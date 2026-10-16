import { describe, it, expect } from "vitest";
import { readUploads, safeFileName, mimeForName, MAX_TOTAL_BYTES } from "@/lib/uploads";

const f = (name: string, size = 10) => new File([new Uint8Array(size)], name);

describe("uploads", () => {
  it("aceita documentos comuns e rejeita executáveis/html/svg", async () => {
    expect(await readUploads([f("a.pdf"), f("b.DOCX")])).toHaveLength(2);
    for (const bad of ["x.exe", "x.html", "x.svg", "x.js", "semextensao", "x.pdf.exe"]) {
      await expect(readUploads([f(bad)])).rejects.toMatchObject({ status: 400 });
    }
  });
  it("limita quantidade e tamanho total", async () => {
    await expect(readUploads([f("1.pdf"), f("2.pdf"), f("3.pdf"), f("4.pdf")])).rejects.toMatchObject({ status: 400 });
    await expect(readUploads([f("a.pdf", MAX_TOTAL_BYTES + 1)])).rejects.toMatchObject({ status: 400 });
  });
  it("ignora arquivo vazio e limpa o nome", async () => {
    expect(await readUploads([f("vazio.pdf", 0)])).toHaveLength(0);
    expect(safeFileName("../../etc/pass\"wd.pdf")).toBe("pass" + "wd.pdf");
    expect(mimeForName("a.png")).toBe("image/png");
  });
});
