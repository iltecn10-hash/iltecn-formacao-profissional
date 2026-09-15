export type UserRole = "admin" | "teacher" | "student" | "coordinator";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
}

export interface School {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  created_at: string;
}

export interface Teacher {
  id: string;
  user_id: string;
  school_id: string;
  bio: string | null;
  name?: string;
  email?: string;
}

export interface Student {
  id: string;
  user_id: string;
  school_id: string;
  birth_date: string | null;
  guardian_name: string | null;
  guardian_contact: string | null;
  level: number;
  points: number;
  name?: string;
  email?: string;
}

export interface Coordinator {
  id: string;
  user_id: string;
  school_id: string | null;
  name?: string;
  email?: string;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  teacher_id: string | null;
  name: string;
  shift: "manha" | "tarde" | "noite" | "integral" | null;
  school_year: number;
  active: boolean;
  teacher_name?: string;
  student_count?: number;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  status: "active" | "inactive" | "transferred";
  enrolled_at: string;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  earned_at: string | null;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface InternalMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  parent_message_id: string | null;
  subject: string;
  body: string;
  attachment_url: string | null;
  is_forward: boolean;
  read_at: string | null;
  created_at: string;
  sender_name?: string;
  sender_email?: string;
  recipient_name?: string;
  recipient_email?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
}

export interface Customer {
  id: string;
  name: string;
  contact: string | null;
}

export interface Product {
  id: string;
  code: string | null;
  name: string;
  category_id: string | null;
  supplier_id: string | null;
  price: string;
  cost_price: string | null;
  stock: number;
  min_stock: number;
  active: boolean;
  category_name?: string;
  supplier_name?: string;
}

export type CashRegisterStatus = "aberto" | "fechado";

export interface CashRegister {
  id: string;
  opened_by: string;
  opening_amount: string;
  closing_amount: string | null;
  status: CashRegisterStatus;
  opened_at: string;
  closed_at: string | null;
  opened_by_name?: string;
}

export type PaymentMethod = "dinheiro" | "pix" | "debito" | "credito";

export interface SaleItemInput {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface Sale {
  id: string;
  cash_register_id: string;
  operator_id: string;
  customer_id: string | null;
  subtotal: string;
  discount: string;
  total: string;
  payment_method: PaymentMethod;
  status: "concluida" | "cancelada";
  created_at: string;
  operator_name?: string;
  items?: { product_name: string; quantity: number; unit_price: string; subtotal: string }[];
}

export interface AccountPayable {
  id: string;
  supplier_id: string | null;
  description: string;
  due_date: string;
  amount: string;
  status: "pendente" | "pago" | "vencido";
  supplier_name?: string;
}

export interface AccountReceivable {
  id: string;
  customer_id: string | null;
  description: string;
  due_date: string;
  amount: string;
  status: "pendente" | "recebido" | "vencido";
  customer_name?: string;
}

export interface Track {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

export interface CourseModule {
  id: string;
  track_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

export interface Competency {
  id: string;
  name: string;
  description: string | null;
}

/**
 * Configuração de trabalho declarada pela própria missão (Fase 9.4):
 * substitui a escolha manual de missão/modelo que existia nos formulários
 * "Novo documento"/"Nova planilha" da 9.2/9.3. `templateKey: null` significa
 * "planilha/documento livre, sem modelo pedagógico pré-definido". Uma
 * missão sem `work_config` (`null`) não tem trabalho associado.
 */
export interface MissionWorkConfig {
  workType: WorkType;
  templateKey: string | null;
}

export interface Mission {
  id: string;
  module_id: string;
  title: string;
  context: string | null;
  objective: string | null;
  level: number;
  points_value: number;
  estimated_minutes: number | null;
  sort_order: number;
  active: boolean;
  resource_url: string | null;
  work_config: MissionWorkConfig | null;
}

export interface MissionTask {
  id: string;
  mission_id: string;
  description: string;
  sort_order: number;
}

// ---- Fase 10: vídeos didáticos por etapa ----

/**
 * Arquitetura preparada para múltiplas origens (item 10 do aditivo), mas por
 * ora só YOUTUBE tem player embutido no simulador (10.2); as demais caem
 * para um link "assistir" simples até serem implementadas.
 */
export type VideoProvider = "YOUTUBE" | "VIMEO" | "CLOUD_STORAGE" | "INTERNAL";

export type VideoType = "EXPLICATIVO" | "DEMONSTRATIVO" | "EXEMPLO" | "ORIENTACAO";

export interface MissionTaskVideo {
  id: string;
  mission_task_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  provider: VideoProvider;
  video_type: VideoType;
  active: boolean;
}

/** Uma etapa (`MissionTask`) com o vídeo associado, se houver (no máximo um por etapa). */
export interface MissionTaskWithVideo extends MissionTask {
  video: MissionTaskVideo | null;
}

/**
 * Vídeo explicativo da missão como um todo (Fase 10.5) — diferente de
 * `MissionTaskVideo`, que é por etapa. Mesma forma (mesmo `provider`/
 * `video_type`), só a chave estrangeira muda (`mission_id` em vez de
 * `mission_task_id`), guardado em uma tabela própria (`mission_videos`)
 * porque é uma relação 1:1 com a missão, não com uma etapa dela.
 */
export interface MissionVideo {
  id: string;
  mission_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  provider: VideoProvider;
  video_type: VideoType;
  active: boolean;
}

export type MissionAttemptStatus =
  | "bloqueada"
  | "disponivel"
  | "em_andamento"
  | "concluida"
  | "refazer";

export interface MissionAttempt {
  id: string;
  student_id: string;
  mission_id: string;
  status: MissionAttemptStatus;
  score: number | null;
  started_at: string | null;
  completed_at: string | null;
  submission_url: string | null;
}

export interface MissionWithProgress extends Mission {
  status: MissionAttemptStatus;
  competencies: string[];
  submission_url: string | null;
  /** Etapas da missão com vídeo, quando houver (Fase 10.2). */
  tasks: MissionTaskWithVideo[];
  /** Vídeo explicativo da missão como um todo, quando houver (Fase 10.5). */
  video: MissionVideo | null;
}

export interface ModuleWithMissions extends CourseModule {
  missions: MissionWithProgress[];
  progress_percent: number;
}

export interface TrackWithModules extends Track {
  modules: ModuleWithMissions[];
  progress_percent: number;
}

// ---- Fase 9: Laboratório Prático de Documentos e Planilhas ----

export type WorkType = "DOCUMENT" | "SPREADSHEET";

export type StudentWorkStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "RETURNED"
  | "APPROVED";

export interface StudentWork {
  id: string;
  student_id: string;
  mission_id: string;
  mission_attempt_id: string | null;
  work_type: WorkType;
  title: string;
  template_key: string | null;
  content: Record<string, unknown>;
  status: StudentWorkStatus;
  version: number;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  mission_title?: string;
  student_name?: string;
}

export interface StudentWorkVersion {
  id: string;
  student_work_id: string;
  version: number;
  content: Record<string, unknown>;
  label: string | null;
  created_at: string;
}

export type WorkEvaluationType = "AUTO" | "MANUAL";

export interface WorkEvaluation {
  id: string;
  student_work_id: string;
  evaluator_id: string | null;
  evaluation_type: WorkEvaluationType;
  score: number | null;
  passed: boolean | null;
  feedback: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface WorkComment {
  id: string;
  student_work_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name?: string;
}

/**
 * Formato de `student_works.content` quando `work_type = 'DOCUMENT'`.
 * `fields` guarda os campos estruturados de texto simples/data do modelo
 * (número, data, destinatário...). `rich` guarda, para cada campo do tipo
 * "richtext" do modelo (ou a chave fixa "body" quando não há modelo), o JSON
 * do editor Tiptap daquele campo.
 */
export interface DocumentWorkContent {
  fields: Record<string, string>;
  rich: Record<string, Record<string, unknown>>;
}

/**
 * Formato de `student_works.content` quando `work_type = 'SPREADSHEET'`.
 * `cells` é um mapa esparso — só células com conteúdo aparecem — indexado
 * por referência estilo planilha ("A1", "B12"). Cada valor é o texto bruto
 * digitado pelo aluno: um literal (texto/número) ou uma fórmula começando
 * com "=" (ver `src/lib/spreadsheet-formulas.ts`). `rows`/`cols` definem o
 * tamanho da grade exibida.
 */
export interface SpreadsheetWorkContent {
  rows: number;
  cols: number;
  cells: Record<string, string>;
}
