import { query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

/**
 * Coordenação e direção. O Diretor usa o MESMO perfil (role = 'coordinator') e o mesmo acesso
 * do Coordenador; `coordinators.position` só define como a pessoa é chamada na tela.
 */
export type CoordinatorPosition = "coordenador" | "diretor";

export const POSITION_LABEL: Record<CoordinatorPosition, string> = {
  coordenador: "Coordenador",
  diretor: "Diretor",
};

export interface CoordinationMember {
  id: string;
  user_id: string;
  school_id: string | null;
  school_name: string | null;
  position: CoordinatorPosition;
  name: string;
  email: string;
  active: boolean;
}

export async function listCoordinationMembers(): Promise<CoordinationMember[]> {
  return query<CoordinationMember>(
    `SELECT c.id, c.user_id, c.school_id, s.name AS school_name, c.position,
            u.name, u.email, u.active
       FROM coordinators c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN schools s ON s.id = c.school_id
      ORDER BY u.name ASC`
  );
}

export async function getPositionByUserId(userId: string): Promise<CoordinatorPosition | null> {
  const row = await queryOne<{ position: CoordinatorPosition }>(
    `SELECT position FROM coordinators WHERE user_id = $1::uuid`,
    [userId]
  );
  return row?.position ?? null;
}

export interface CreateCoordinatorInput {
  name: string;
  email: string;
  password: string;
  schoolId: string;
  position: CoordinatorPosition;
}

export async function createCoordinationMember(input: CreateCoordinatorInput) {
  const passwordHash = await hashPassword(input.password);
  const user = await queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, 'coordinator')
     RETURNING id`,
    [input.email.toLowerCase(), passwordHash, input.name]
  );
  if (!user) throw new Error("Falha ao criar usuário.");
  const row = await queryOne<{ id: string }>(
    `INSERT INTO coordinators (user_id, school_id, position)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [user.id, input.schoolId, input.position]
  );
  if (!row) throw new Error("Falha ao criar cadastro de coordenação.");
  return { id: row.id, user_id: user.id, position: input.position };
}
