// Regras de vencimento do organizador. Módulo puro, usado pelo app e pelos avisos (Node).
// Datas são strings ISO 'AAAA-MM-DD'; "hoje" é sempre o dia em America/Sao_Paulo.

const FUSO = 'America/Sao_Paulo';
const DIA_MS = 86400000;

function paraMs(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

function deMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function hojeSP(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora);
}

export function somarDias(iso, n) {
  return deMs(paraMs(iso) + n * DIA_MS);
}

export function diasEntre(de, ate) {
  return Math.round((paraMs(ate) - paraMs(de)) / DIA_MS);
}

export function formatarDDMM(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function diaDaSemana(iso) {
  return new Date(paraMs(iso)).getUTCDay();
}

function ultimoDiaDoMes(iso) {
  const [a, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export function rotinaVenceEm(repeticao, iso) {
  const semana = diaDaSemana(iso);
  switch (repeticao?.tipo) {
    case 'diario': return true;
    case 'uteis': return semana >= 1 && semana <= 5;
    case 'semana': return (repeticao.dias || []).includes(semana);
    case 'mes': {
      const dia = Number(iso.slice(8, 10));
      return dia === Math.min(repeticao.dia, ultimoDiaDoMes(iso));
    }
    default: return false;
  }
}

export function statusCobertura(tarefa, porId, hoje) {
  if (!tarefa.coberto_ate) {
    return { estado: 'atrasada', diasRestantes: null, alcancouLimite: false, limitante: null };
  }
  const diasRestantes = diasEntre(hoje, tarefa.coberto_ate);
  const antes = tarefa.avisar_dias_antes ?? 1;
  const estado = diasRestantes < 0 ? 'atrasada' : diasRestantes <= antes ? 'acabando' : 'ok';

  const lim = tarefa.limitada_por ? porId.get(tarefa.limitada_por) : null;
  const alcancouLimite = Boolean(lim && lim.ativa && lim.coberto_ate && tarefa.coberto_ate >= lim.coberto_ate);
  return { estado, diasRestantes, alcancouLimite, limitante: alcancouLimite ? lim : null };
}
