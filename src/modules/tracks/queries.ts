import { query, queryOne } from "@/lib/db";
import type { Track, CourseModule, Competency } from "@/types";

export async function listTracks(): Promise<Track[]> {
  return query<Track>(
    `SELECT id, name, slug, description, sort_order, active
     FROM tracks ORDER BY sort_order ASC`
  );
}

export async function listModulesByTrack(trackId: string): Promise<CourseModule[]> {
  return query<CourseModule>(
    `SELECT id, track_id, name, description, sort_order, active
     FROM modules WHERE track_id = $1 ORDER BY sort_order ASC`,
    [trackId]
  );
}

export async function listAllModules(): Promise<CourseModule[]> {
  return query<CourseModule>(
    `SELECT id, track_id, name, description, sort_order, active
     FROM modules ORDER BY sort_order ASC`
  );
}

export async function listCompetencies(): Promise<Competency[]> {
  return query<Competency>(
    `SELECT id, name, description FROM competencies ORDER BY name ASC`
  );
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface CreateTrackInput {
  name: string;
  description?: string;
  sortOrder?: number;
}

export async function createTrack(input: CreateTrackInput): Promise<Track> {
  const slug = slugify(input.name);
  const track = await queryOne<Track>(
    `INSERT INTO tracks (name, slug, description, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, slug, description, sort_order, active`,
    [input.name, slug, input.description ?? null, input.sortOrder ?? 0]
  );
  if (!track) throw new Error("Falha ao criar trilha.");
  return track;
}

export interface CreateModuleInput {
  trackId: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

export async function createModule(input: CreateModuleInput): Promise<CourseModule> {
  const courseModule = await queryOne<CourseModule>(
    `INSERT INTO modules (track_id, name, description, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, track_id, name, description, sort_order, active`,
    [input.trackId, input.name, input.description ?? null, input.sortOrder ?? 0]
  );
  if (!courseModule) throw new Error("Falha ao criar módulo.");
  return courseModule;
}
