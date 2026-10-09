/**
 * Semeia a Central de Jogos Educativos (jogos oficiais + medalhas). Idempotente.
 *
 *   npm run seed:games                 # cria só o que falta
 *   npm run seed:games -- --overwrite  # reaplica o conteúdo do código sobre os jogos existentes
 *   npm run seed:games -- --sql        # só IMPRIME o SQL equivalente (para rodar por outra ferramenta)
 *
 * Precisa de DATABASE_URL e da migration migrations/2026-10-09_games.sql já aplicada
 * (exceto com --sql, que não conecta).
 */
import { Pool } from "pg";
import { seedGames, type SeedClient } from "../src/modules/games/seed";

async function printSql() {
  const statements: string[] = [];
  const lit = (v: unknown): string => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    return `'${String(v).replace(/'/g, "''")}'`;
  };
  // "Banco" falso: cada consulta vira texto; SELECTs devolvem vazio (assume banco sem o jogo).
  const fake: SeedClient = {
    async query(text, params = []) {
      if (/^\s*SELECT/i.test(text)) return { rows: [] };
      let sql = text.replace(/\$(\d+)(::\w+)?/g, (_m, n) => lit(params[Number(n) - 1]));
      // O id do jogo é obtido por RETURNING; no SQL impresso usamos o `code`.
      sql = sql.replace(/RETURNING id/i, "");
      statements.push(sql.trim().replace(/\s+/g, " "));
      return { rows: [{ id: "00000000-0000-0000-0000-000000000000" }] };
    },
  };
  await seedGames(fake);
  // Troca o id fictício pelo lookup real por code.
  const out = statements.map(
    (s) =>
      s.replace(/'00000000-0000-0000-0000-000000000000'/g, "(SELECT id FROM games WHERE code = 'desafio-explorador-digital')") +
      // `code` é único em games e achievements: rodar o SQL duas vezes não duplica nada.
      (/^INSERT INTO (games|achievements) /i.test(s) ? " ON CONFLICT (code) DO NOTHING;" : ";")
  );
  console.log(out.join("\n"));
}

async function main() {
  if (process.argv.includes("--sql")) return printSql();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida.");
  const overwrite = process.argv.includes("--overwrite");
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const summary = await seedGames(client, { overwrite });
    await client.query("COMMIT");
    console.log(overwrite ? "Seed de jogos (overwrite) concluído:" : "Seed de jogos concluído:", summary);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
