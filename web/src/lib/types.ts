// Tipos do domínio — espelham o schema em supabase/migrations/0001_initial_schema.sql

export type EventStatus = "draft" | "scheduled" | "live" | "ended" | "ondemand";
export type StreamProvider = "youtube" | "vimeo" | "dacast" | "hls" | "studio";
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

/** Resultado do RPC get_public_client (resolve slug mesmo com pasta privada) */
export interface PublicClient {
  id: string;
  name: string;
  slug: string;
  brand_color: string;
  brand_logo_url: string | null;
  bg_image_url: string | null;
  bg_image_mobile_url: string | null;
  can_view_folder: boolean;
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
  { key: "can_chat", label: "Chat", hint: "Moderar e aprovar: chat, perguntas e fotos" },
  { key: "can_quiz", label: "Quiz e interações", hint: "Perguntas, enquetes e nuvem de palavras" },
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
  /** tipos de atividade habilitados para uso neste evento (migração 0023) */
  enabled_activity_types: ActivityType[];
  brand_logo_url: string | null;
  brand_color: string;
  created_by: string | null;
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
  // Q&A (migração 0014) — moderação é sempre obrigatória (migração 0023)
  qa_enabled: boolean;
  qa_allow_anonymous: boolean;
  qa_upvote_enabled: boolean;
  /** chat pré-moderado (migração 0015): mensagem só publica após aprovação */
  chat_moderation: boolean;
  /** galeria de fotos dos participantes (migração 0016), moderação obrigatória */
  gallery_enabled: boolean;
  /** contador de "X online" e reações em emoji na sala (migração 0028) */
  presence_enabled: boolean;
  reactions_enabled: boolean;
}

// ===== Galeria de fotos (migração 0016, Fase G.2) =====

export type PhotoStatus = "pending" | "approved" | "rejected";

export interface EventPhoto {
  id: string;
  event_id: string;
  author_id: string | null;
  /** desnormalizado (padrão de posts) — só aparece na moderação */
  author_name: string;
  storage_path: string;
  status: PhotoStatus;
  created_at: string;
}

// ===== Q&A com upvote (migração 0014, Fase F) =====

export type QuestionStatusQA = "pending" | "visible" | "answered" | "rejected";

export interface EventQuestion {
  id: string;
  event_id: string;
  author_id: string | null;
  /** '' quando anônima (nome real só no CSV do organizador) */
  author_name: string;
  is_anonymous: boolean;
  content: string;
  status: QuestionStatusQA;
  votes_count: number;
  created_at: string;
}

// ===== Materiais do evento (migração 0017, Fase G.3) =====

export interface EventMaterial {
  id: string;
  event_id: string;
  title: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  visible: boolean;
  added_by: string | null;
  created_at: string;
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
  author_id: string | null;
  author_name: string;
  content: string;
  kind: PostKind;
  pinned: boolean;
  deleted_at: string | null;
  created_at: string;
  /** mensagem citada (reply), migração 0012 */
  reply_to_id: string | null;
  /** false = aguardando moderação (migração 0015) */
  approved: boolean;
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

// ===== Atividades interativas (migração 0009, Fase E) =====

export type ActivityType =
  | "word_cloud"
  | "poll"
  | "quiz"
  | "quiz_ranking"
  | "scale"
  | "open_text"
  | "ordering"
  | "matrix";
export type ActivityStatus = "pending" | "open" | "closed";
export type ActivityResultsVisible = "live" | "after_publish";

export interface ActivityConfig {
  /** poll/ordering: alternativas/itens */
  options?: string[];
  /** word_cloud/open_text: envios por pessoa (padrão 3) */
  max_entries?: number;
  /** scale: afirmações avaliadas */
  statements?: string[];
  /** scale: valor máximo da régua (padrão 5) */
  scale_max?: number;
  /** scale: rótulos das pontas */
  min_label?: string;
  max_label?: string;
  /** open_text: id da resposta destacada no telão */
  spotlight?: string;
  /** matrix: rótulos dos eixos */
  x_label?: string;
  y_label?: string;
}

export interface Activity {
  id: string;
  event_id: string;
  type: ActivityType;
  title: string;
  config: ActivityConfig;
  status: ActivityStatus;
  results_visible: ActivityResultsVisible;
  results_published: boolean;
  highlight: boolean;
  require_moderation: boolean;
  position: number;
  opened_at: string | null;
  created_at: string;
  /** vínculo com a tabela quizzes (type = 'quiz'), migração 0010 */
  quiz_id: string | null;
}

export interface ActivityResponse {
  id: string;
  activity_id: string;
  user_id: string;
  payload: {
    word?: string;
    option_index?: number;
    ratings?: number[];
    text?: string;
    order?: number[];
    xs?: number[];
    ys?: number[];
  };
  approved: boolean;
  created_at: string;
}

/** Pergunta de quiz dentro do resultado agregado (gabarito só após revelar) */
export interface QuizQuestionResults {
  id: string;
  prompt: string;
  options: string[];
  status: QuestionStatus;
  correct_index: number | null;
  total: number;
  counts: number[];
  correct_count: number | null;
}

export interface RankingRow {
  name: string;
  score: number;
  correct: number;
}

export interface ScaleStatementResults {
  statement: string;
  avg: number | null;
  count: number;
  /** distribuição de votos por valor (1..scale_max) */
  dist: number[];
}

export interface OpenEntry {
  id: string;
  text: string;
}

export interface MatrixItemResults {
  option: string;
  index: number;
  avg_x: number | null;
  avg_y: number | null;
}

export interface OrderingItemResults {
  option: string;
  /** índice original do item na config */
  index: number;
  /** posição média (1 = topo); null sem respostas */
  avg_pos: number | null;
}

/** Resultado agregado do RPC get_activity_results */
export interface ActivityResults {
  type: ActivityType;
  total: number;
  words?: { word: string; count: number }[];
  counts?: number[];
  questions?: QuizQuestionResults[];
  ranking?: RankingRow[];
  scale_max?: number;
  statements?: ScaleStatementResults[];
  entries?: OpenEntry[];
  spotlight?: OpenEntry | null;
  order?: OrderingItemResults[];
  items?: MatrixItemResults[];
}

// ===== Sorteios (migração 0018, Fase H) =====

export type RaffleKind = "participants" | "numbers" | "coin";
export type RaffleVisual = "cards" | "wheel" | "coin";
export type RaffleSource = "registrations" | "attendance" | "list";

export interface RaffleWinner {
  /** user_id (fontes do banco) ou o próprio nome (lista colada) */
  key: string;
  name: string;
}

export interface RaffleConfig {
  source?: RaffleSource;
  winners?: number;
  exclude_team?: boolean;
  exclude_winners?: boolean;
  list?: string[];
  min?: number;
  max?: number;
  count?: number;
  exclude_drawn?: boolean;
}

export interface Raffle {
  id: string;
  event_id: string;
  kind: RaffleKind;
  visual: RaffleVisual;
  title: string;
  config: RaffleConfig;
  /** semente do sorteio: ganhadores = menores md5(semente || chave) */
  seed: string;
  /** snapshot dos elegíveis (auditoria) */
  entries: RaffleWinner[] | { min: number; max: number; excluded: number[] };
  result: RaffleWinner[] | number[] | string[];
  displayed: boolean;
  drawn_by: string | null;
  created_at: string;
}

export const RAFFLE_KIND_LABELS: Record<RaffleKind, string> = {
  participants: "Participantes",
  numbers: "Números",
  coin: "Cara ou coroa",
};

/** Sorteio exibido no telão (parte do get_screen_state) */
export interface ScreenRaffle {
  id: string;
  kind: RaffleKind;
  visual: RaffleVisual;
  title: string;
  result: RaffleWinner[] | number[] | string[];
  total_entries: number | null;
}

/** Estado público do telão (RPC get_screen_state) */
export interface ScreenState {
  event: {
    title: string;
    brand_color: string;
    brand_logo_url: string | null;
    bg_image_url: string | null;
  };
  activity: Pick<Activity, "id" | "type" | "title" | "status" | "config"> | null;
  results: ActivityResults | null;
  /** sorteio exibido (migração 0018) — tem prioridade sobre a atividade */
  raffle: ScreenRaffle | null;
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  word_cloud: "Nuvem de palavras",
  poll: "Enquete",
  quiz: "Quiz",
  quiz_ranking: "Ranking geral",
  scale: "Escalas",
  open_text: "Respostas abertas",
  ordering: "Ordenação",
  matrix: "Matriz 2×2",
};

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  pending: "Aguardando",
  open: "Aberta",
  closed: "Fechada",
};

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
  studio: "Estúdio GoLive (WebRTC / Cloud Mixer)",
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
  ondemand: "On demand",
};

// ===== Estúdio GoLive (migração 0032) =====

export type StudioLayout =
  | "grid"
  | "solo"
  | "split"
  | "split-2-1"
  | "thumbs-right"
  | "thumbs-left"
  | "thumbs-bottom"
  | "pip";

export type StudioAssetType =
  | "gc_name"
  | "banner"
  | "ticker"
  | "logo"
  | "overlay"
  | "background"
  | "video_clip"
  | "presentation";

export interface StudioRoom {
  id: string;
  event_id: string;
  active_layout: StudioLayout;
  active_scene_id: string;
  spotlight_participant_id: string | null;
  active_banner_id: string | null;
  active_ticker_text: string | null;
  active_overlay_url: string | null;
  active_background_url: string | null;
  active_logo_url: string | null;
  active_presentation_id: string | null;
  active_slide_index: number;
  created_at: string;
  updated_at: string;
}

export interface StudioAsset {
  id: string;
  event_id: string;
  asset_type: StudioAssetType;
  title: string;
  subtitle: string | null;
  content_json: Record<string, unknown>;
  file_url: string | null;
  sort_order: number;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

