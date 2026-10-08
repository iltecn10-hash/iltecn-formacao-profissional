/**
 * Semeia o programa ILTECN LAB (trilha, 6 módulos, 30 aulas, atividades e
 * conquistas). Idempotente: pode rodar quantas vezes quiser.
 *
 *   npm run seed:lab                 # cria só o que falta (não mexe no que o admin editou)
 *   npm run seed:lab -- --overwrite  # reaplica o conteúdo do código sobre o existente
 *
 * Precisa de DATABASE_URL e da migration migrations/2026-10-08_iltecn_lab.sql já aplicada.
 */
import { Pool } from "pg";
import { seedLabProgram } from "../src/modules/lab/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida.");
  const overwrite = process.argv.includes("--overwrite");

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const summary = await seedLabProgram(client, { overwrite });
    await client.query("COMMIT");
    console.log(overwrite ? "Seed (overwrite) concluído:" : "Seed concluído:", summary);
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
