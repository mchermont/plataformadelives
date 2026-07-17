// Tipos do domínio — espelham o schema em supabase/migrations/0001_initial_schema.sql

export type EventStatus = "draft" | "scheduled" | "live" | "ended";
export type StreamProvider = "youtube" | "vimeo" | "dacast" | "hls";
export type RegistrationStatus = "pending" | "approved" | "rejected" | "banned";
export type FieldType = "text" | "select" | "checkbox";
export type PostKind = "message" | "announcement";
export type QuizStatus = "draft" | "active" | "closed";
export type QuestionStatus = "pending" | "open" | "closed" | "revealed";
export type FolderVisibility = "public" | "restricted" | "private";
export type ClientRole = "admin" | "collaborator";
export type RegistrationMode = "open" | "allowlist" | "domain";

export interface Agency {
  id: string;
  name: string;
  created_at: string;
}

export interface Client {
  id: string;
  agency_id: string | null;
  name: string;
  slug: string;
  folder_visibility: FolderVisibility;
  brand_color: string;
  brand_logo_url: string | null;
  bg_image_url: string | null;
  bg_image_mobile_url: string | null;
  created_at: string;
}

export interface ClientMember {
  client_id: string;
  user_id: string;
  role: ClientRole;
  created_at: string;
}

export interface ClientInvite {
  id: string;
  client_id: string;
  email: string;
  role: ClientRole;
  invited_by: string | null;
  created_at: string;
  accepted_at: string | null;
}

export interface EventMember {
  event_id: string;
  user_id: string;
  can_stream: boolean;
  can_chat: boolean;
  can_quiz: boolean;
  can_registrations: boolean;
  can_reports: boolean;
  created_at: string;
}

export const CLIENT_ROLE_LABELS: Record<ClientRole, string> = {
  admin: "Administrador",
  collaborator: "Colaborador",
};

export const FOLDER_VISIBILITY_LABELS: Record<FolderVisibility, string> = {
  public: "Pública",
  restricted: "Restrita à base do cliente",
  private: "Privada (só a equipe)",
};

export const EVENT_CAPABILITIES = [
  { key: "can_stream", label: "Transmissão", hint: "Configurar fonte e entrar/sair do ar" },
  { key: "can_chat", label: "Chat", hint: "Moderar, fixar e banir" },
  { key: "can_quiz", label: "Quiz", hint: "Criar e disparar perguntas" },
  { key: "can_registrations", label: "Inscrições", hint: "Aprovar, banir, planilha" },
  { key: "can_reports", label: "Relatórios", hint: "Ver e exportar" },
] as const;

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_platform_admin: boolean;
  is_moderator: boolean;
  created_at: string;
}

export interface LiveEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: EventStatus;
  stream_provider: StreamProvider;
  stream_ref: string;
  allowed_domains: string[];
  google_login_enabled: boolean;
  capacity: number;
  chat_enabled: boolean;
  quiz_enabled: boolean;
  brand_logo_url: string | null;
  brand_color: string;
  created_by: string;
  created_at: string;
  // multi-tenant (migração 0004)
  client_id: string | null;
  listed_on_client_page: boolean;
  accept_client_base: boolean;
  registration_mode: RegistrationMode;
  require_approval: boolean;
  allowlist_fallback_approval: boolean;
  consent_text: string;
  bg_image_url: string | null;
  bg_image_mobile_url: string | null;
  card_image_url: string | null;
  sponsor_logos: string[];
}

export interface EventField {
  id: string;
  event_id: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  options: string[];
  position: number;
}

export interface EventAllowlistEntry {
  event_id: string;
  email: string;
  added_by: string | null;
  created_at: string;
}

export interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  status: RegistrationStatus;
  answers: Record<string, string>;
  consent_accepted_at: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  event_id: string;
  author_id: string;
  author_name: string;
  content: string;
  kind: PostKind;
  pinned: boolean;
  deleted_at: string | null;
  created_at: string;
}

export interface Quiz {
  id: string;
  event_id: string;
  title: string;
  status: QuizStatus;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  prompt: string;
  options: string[];
  time_limit_sec: number;
  position: number;
  status: QuestionStatus;
  opened_at: string | null;
  /** preenchido apenas quando status = 'revealed' */
  revealed_correct_index: number | null;
}

export interface QuizAnswer {
  id: string;
  question_id: string;
  user_id: string;
  selected_index: number;
  answered_at: string;
}

export interface Attendance {
  event_id: string;
  user_id: string;
  first_joined_at: string;
  last_seen_at: string;
  watch_seconds: number;
}

export interface LeaderboardRow {
  event_id: string;
  user_id: string;
  full_name: string;
  correct_count: number;
  score: number;
}

export const PROVIDER_LABELS: Record<StreamProvider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  dacast: "Dacast",
  hls: "Servidor próprio (HLS)",
};

export const REGISTRATION_MODE_LABELS: Record<RegistrationMode, string> = {
  open: "Cadastro simples",
  allowlist: "Lista de convidados (planilha)",
  domain: "Restrito a domínios de e-mail",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  live: "Ao vivo",
  ended: "Encerrado",
};
