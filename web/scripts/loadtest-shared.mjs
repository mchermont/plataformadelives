// Constantes compartilhadas entre os scripts de ensaio de carga
// (loadtest-seed-users.mjs, loadtest-audience.mjs, loadtest-cleanup.mjs).
// Arquivo sem efeito colateral — só exports puros, seguro de importar.

export const LOADTEST_PASSWORD = "loadtest-golive-2026";

export function loadtestEmail(i) {
  return `loadtest-participante-${i}@golive.test`;
}
