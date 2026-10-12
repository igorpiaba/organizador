// Distingue "sessão vencida/inválida" (volta ao login) de "sem internet" (modo offline).
export function ehErroDeLogin(erro) {
  if (!erro) return false;
  if (erro.status === 401 || erro.code === 'PGRST301' || erro.code === 'PGRST302') return true;
  if (erro.name === 'AuthSessionMissingError') return true;
  return /jwt/i.test(erro.message || '');
}
