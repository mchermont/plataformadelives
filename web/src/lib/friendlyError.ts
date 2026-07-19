const PATTERNS: [RegExp, string][] = [
  [/permission denied|row-level security/i, "Você não tem permissão para fazer isso."],
  [/duplicate key|already exists/i, "Já existe um registro com esses dados."],
  [/violates .*constraint/i, "Os dados informados não são válidos."],
  [/JWT|expired/i, "Sua sessão expirou. Atualize a página e entre novamente."],
  [/network|fetch failed|failed to fetch/i, "Falha de conexão. Verifique sua internet e tente de novo."],
];

/**
 * Traduz erros técnicos do Postgres/Supabase para pt-BR. Mensagens que já
 * vêm em pt-BR (RPCs próprias, ex. run_raffle/activity_control) passam
 * direto — a heurística de acento evita traduzir o que já está traduzido.
 */
export function friendlyError(message: string): string {
  if (!message) return "Algo deu errado. Tente novamente.";
  for (const [pattern, friendly] of PATTERNS) {
    if (pattern.test(message)) return friendly;
  }
  if (/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(message)) return message;
  return "Não foi possível concluir a ação. Tente novamente.";
}
