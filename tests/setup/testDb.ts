import { newDb, DataType } from "pg-mem";
import { randomUUID } from "crypto";

/**
 * Cria um banco Postgres em memória (pg-mem) com o subconjunto de schema
 * necessário para testar a lógica de negócio real (SQL incluso) sem precisar
 * de acesso de rede ao Neon.
 */
export function createTestDb() {
  const db = newDb({ autoCreateForeignKeyIndices: true });

  db.public.registerFunction({
    name: "gen_random_uuid",
    returns: DataType.uuid,
    impure: true, // cada chamada deve gerar um UUID novo, nunca ser cacheada/constant-folded
    implementation: () => randomUUID(),
  });

  db.public.none(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE schools (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL
    );

    CREATE TABLE students (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      school_id UUID NOT NULL REFERENCES schools(id),
      level INTEGER NOT NULL DEFAULT 1,
      points INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE tracks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE modules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      track_id UUID NOT NULL REFERENCES tracks(id),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE competencies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL
    );

    CREATE TABLE missions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_id UUID NOT NULL REFERENCES modules(id),
      title VARCHAR(255) NOT NULL,
      context TEXT,
      objective TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      points_value INTEGER NOT NULL DEFAULT 100,
      estimated_minutes INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true,
      resource_url TEXT,
      work_config JSONB
    );

    CREATE TABLE mission_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mission_id UUID NOT NULL REFERENCES missions(id),
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE mission_task_videos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mission_task_id UUID NOT NULL UNIQUE REFERENCES mission_tasks(id),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      video_url TEXT NOT NULL,
      thumbnail_url TEXT,
      duration_seconds INTEGER,
      provider VARCHAR(20) NOT NULL DEFAULT 'YOUTUBE',
      video_type VARCHAR(20) NOT NULL DEFAULT 'DEMONSTRATIVO',
      active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE mission_videos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mission_id UUID NOT NULL UNIQUE REFERENCES missions(id),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      video_url TEXT NOT NULL,
      thumbnail_url TEXT,
      duration_seconds INTEGER,
      provider VARCHAR(20) NOT NULL DEFAULT 'YOUTUBE',
      video_type VARCHAR(20) NOT NULL DEFAULT 'DEMONSTRATIVO',
      active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE mission_competencies (
      mission_id UUID NOT NULL REFERENCES missions(id),
      competency_id UUID NOT NULL REFERENCES competencies(id),
      PRIMARY KEY (mission_id, competency_id)
    );

    CREATE TABLE mission_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL REFERENCES students(id),
      mission_id UUID NOT NULL REFERENCES missions(id),
      status VARCHAR(20) NOT NULL DEFAULT 'disponivel',
      score INTEGER,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      submission_url TEXT,
      UNIQUE(student_id, mission_id)
    );

    CREATE TABLE student_competencies (
      student_id UUID NOT NULL REFERENCES students(id),
      competency_id UUID NOT NULL REFERENCES competencies(id),
      score INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY (student_id, competency_id)
    );

    CREATE TABLE scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL REFERENCES students(id),
      mission_attempt_id UUID,
      points INTEGER NOT NULL,
      reason VARCHAR(255)
    );

    CREATE TABLE achievements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      criteria_type VARCHAR(30) NOT NULL,
      criteria_value INTEGER,
      criteria_track_id UUID REFERENCES tracks(id)
    );

    CREATE TABLE student_achievements (
      student_id UUID NOT NULL REFERENCES students(id),
      achievement_id UUID NOT NULL REFERENCES achievements(id),
      earned_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY (student_id, achievement_id)
    );

    CREATE TABLE categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL UNIQUE
    );

    CREATE TABLE suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL
    );

    CREATE TABLE customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL
    );

    CREATE TABLE products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50),
      name VARCHAR(255) NOT NULL,
      category_id UUID REFERENCES categories(id),
      supplier_id UUID REFERENCES suppliers(id),
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 5,
      active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE cash_registers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      opened_by UUID NOT NULL REFERENCES users(id),
      opening_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      closing_amount NUMERIC(10,2),
      status VARCHAR(20) NOT NULL DEFAULT 'aberto',
      closed_at TIMESTAMP
    );

    CREATE TABLE sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cash_register_id UUID NOT NULL REFERENCES cash_registers(id),
      operator_id UUID NOT NULL REFERENCES users(id),
      customer_id UUID REFERENCES customers(id),
      subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
      discount NUMERIC(10,2) NOT NULL DEFAULT 0,
      total NUMERIC(10,2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'concluida',
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE sale_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sale_id UUID NOT NULL REFERENCES sales(id),
      product_id UUID NOT NULL REFERENCES products(id),
      product_name VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL
    );

    CREATE TABLE inventory_movements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id),
      type VARCHAR(20) NOT NULL,
      quantity INTEGER NOT NULL,
      reason VARCHAR(255),
      user_id UUID REFERENCES users(id)
    );

    CREATE TABLE student_works (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL REFERENCES students(id),
      mission_id UUID NOT NULL REFERENCES missions(id),
      mission_attempt_id UUID REFERENCES mission_attempts(id),
      work_type VARCHAR(20) NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT '',
      template_key VARCHAR(50),
      content JSONB NOT NULL DEFAULT '{}',
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      version INTEGER NOT NULL DEFAULT 1,
      submitted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now(),
      UNIQUE(student_id, mission_id, work_type)
    );

    CREATE TABLE student_work_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_work_id UUID NOT NULL REFERENCES student_works(id),
      version INTEGER NOT NULL,
      content JSONB NOT NULL,
      label VARCHAR(50),
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE(student_work_id, version)
    );

    CREATE TABLE work_evaluations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_work_id UUID NOT NULL REFERENCES student_works(id),
      evaluator_id UUID REFERENCES users(id),
      evaluation_type VARCHAR(20) NOT NULL,
      score INTEGER,
      passed BOOLEAN,
      feedback TEXT,
      details JSONB,
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE work_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_work_id UUID NOT NULL REFERENCES student_works(id),
      author_id UUID NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  async function query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<T[]> {
    const result = await pool.query(text, params);
    return result.rows as T[];
  }

  async function queryOne<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<T | null> {
    const rows = await query<T>(text, params);
    return rows[0] ?? null;
  }

  return { pool, query, queryOne };
}
