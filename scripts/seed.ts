import { pool } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Verificando se já existe um administrador...");
    const existing = await client.query(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`
    );

    if (existing.rows.length > 0) {
      console.log("Já existe um administrador cadastrado. Nada a fazer.");
      return;
    }

    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@iltecn.com.br";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "iltecn2026";
    const passwordHash = await hashPassword(adminPassword);

    console.log("Criando usuário administrador...");
    await client.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'admin')`,
      [adminEmail.toLowerCase(), passwordHash, "Administrador ILTECN"]
    );

    console.log("Criando escola de exemplo...");
    await client.query(
      `INSERT INTO schools (name, code, city, state)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO NOTHING`,
      ["Escola Modelo ILTECN", "ILTECN-01", "São Paulo", "SP"]
    );

    console.log("\nSeed concluído com sucesso.");
    console.log(`  Login admin: ${adminEmail}`);
    console.log(`  Senha: ${adminPassword}`);
    console.log("  (altere a senha após o primeiro acesso)");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Erro ao rodar o seed:", err);
  process.exit(1);
});
