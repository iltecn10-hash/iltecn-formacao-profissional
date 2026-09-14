import { query, queryOne } from "@/lib/db";
import type { School } from "@/types";

export async function listSchools(): Promise<School[]> {
  return query<School>(
    `SELECT id, name, code, address, city, state, active, created_at
     FROM schools ORDER BY name ASC`
  );
}

export async function getSchoolById(id: string): Promise<School | null> {
  return queryOne<School>(`SELECT * FROM schools WHERE id = $1`, [id]);
}

export interface CreateSchoolInput {
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
}

export async function createSchool(input: CreateSchoolInput): Promise<School> {
  const school = await queryOne<School>(
    `INSERT INTO schools (name, code, address, city, state)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, code, address, city, state, active, created_at`,
    [
      input.name,
      input.code ?? null,
      input.address ?? null,
      input.city ?? null,
      input.state ?? null,
    ]
  );
  if (!school) throw new Error("Falha ao criar escola.");
  return school;
}
