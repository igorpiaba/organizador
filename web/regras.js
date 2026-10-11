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

const PESO = { alta: 0, media: 1, baixa: 2 };

function porPrioridade(a, b) {
  return (PESO[a.tarefa.prioridade] ?? 1) - (PESO[b.tarefa.prioridade] ?? 1)
    || a.tarefa.nome.localeCompare(b.tarefa.nome, 'pt-BR');
}

function porHorario(a, b) {
  const ha = a.tarefa.horario_sugerido || '99:99';
  const hb = b.tarefa.horario_sugerido || '99:99';
  return ha.localeCompare(hb) || porPrioridade(a, b);
}

export function montarDia(tarefas, conclusoes, hoje) {
  const porId = new Map(tarefas.map(t => [t.id, t]));
  const feitasHoje = new Set(conclusoes.filter(c => c.dia === hoje).map(c => c.tarefa_id));
  const dia = { hoje, atrasadas: [], coberturas: [], rotinas: [], avulsas: [] };
  const avulsasSemPrazo = [];

  for (const tarefa of tarefas) {
    if (!tarefa.ativa) continue;
    if (tarefa.tipo === 'cobertura') {
      const status = statusCobertura(tarefa, porId, hoje);
      if (status.estado === 'atrasada') dia.atrasadas.push({ tarefa, status });
      else if (status.estado === 'acabando' || status.alcancouLimite) dia.coberturas.push({ tarefa, status });
    } else if (tarefa.tipo === 'rotina') {
      if (rotinaVenceEm(tarefa.repeticao, hoje)) dia.rotinas.push({ tarefa, feita: feitasHoje.has(tarefa.id) });
    } else if (tarefa.tipo === 'avulsa' && !tarefa.concluida_em) {
      if (!tarefa.prazo) avulsasSemPrazo.push({ tarefa });
      else if (tarefa.prazo < hoje) dia.atrasadas.push({ tarefa });
      else if (tarefa.prazo === hoje) dia.avulsas.push({ tarefa });
    }
  }

  dia.atrasadas.sort(porPrioridade);
  dia.coberturas.sort(porPrioridade);
  dia.rotinas.sort(porHorario);
  dia.avulsas.sort(porPrioridade);
  dia.avulsas.push(...avulsasSemPrazo.sort(porPrioridade));
  return dia;
}

// Textos de status, usados pela tela "Hoje" e pela mensagem do Telegram.
export function textoItem(item) {
  const { tarefa, status } = item;
  if (tarefa.tipo === 'cobertura') {
    if (!tarefa.coberto_ate) return `${tarefa.nome} — sem data de cobertura`;
    const data = formatarDDMM(tarefa.coberto_ate);
    if (status.estado === 'atrasada') return `${tarefa.nome} — acabou em ${data}`;
    if (status.estado === 'acabando') {
      const n = status.diasRestantes;
      const quando = n === 0 ? 'acaba hoje' : n === 1 ? 'acaba amanhã' : `acaba em ${n} dias`;
      return `${tarefa.nome} — ${quando} (${data})`;
    }
    return `${tarefa.nome} — coberto até ${data}`;
  }
  if (tarefa.tipo === 'rotina') {
    return tarefa.horario_sugerido ? `${tarefa.horario_sugerido} ${tarefa.nome}` : tarefa.nome;
  }
  if (tarefa.prazo && tarefa.prazo < (item.hoje ?? tarefa.prazo)) {
    return `${tarefa.nome} — prazo era ${formatarDDMM(tarefa.prazo)}`;
  }
  return tarefa.lembrete ? `${tarefa.nome} (lembrete ${tarefa.lembrete})` : tarefa.nome;
}

export function textoLimite(status) {
  if (!status?.alcancouLimite) return null;
  const lim = status.limitante;
  return `alcançou “${lim.nome}” (${formatarDDMM(lim.coberto_ate)}): hora de preparar as próximas`;
}

// Navegação entre dias na tela "Hoje".
export const LIMITE_PASSADO = 7;
export const LIMITE_FUTURO = 30;
const NOMES_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function rotuloDia(dia, hoje) {
  const n = diasEntre(hoje, dia);
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Amanhã';
  if (n === -1) return 'Ontem';
  return NOMES_SEMANA[diaDaSemana(dia)];
}

export function limitarDia(dia, hoje) {
  const n = Math.max(-LIMITE_PASSADO, Math.min(LIMITE_FUTURO, diasEntre(hoje, dia)));
  return somarDias(hoje, n);
}

// Aba "Feitas": o que foi concluído nos últimos dias, agrupado por dia.
export const DIAS_HISTORICO = 30;
const ORDEM_TIPO = { cobertura: 0, rotina: 1, avulsa: 2 };

export function montarFeitas(tarefas, conclusoes, historico, hoje) {
  const porId = new Map(tarefas.map(t => [t.id, t]));
  const inicio = somarDias(hoje, -(DIAS_HISTORICO - 1));
  const itens = [];

  for (const c of conclusoes) {
    const tarefa = porId.get(c.tarefa_id);
    if (tarefa) itens.push({ tipo: 'rotina', tarefa, dia: c.dia });
  }
  for (const tarefa of tarefas) {
    if (tarefa.tipo === 'avulsa' && tarefa.concluida_em) {
      itens.push({ tipo: 'avulsa', tarefa, dia: hojeSP(new Date(tarefa.concluida_em)) });
    }
  }
  for (const h of historico) {
    const tarefa = porId.get(h.tarefa_id);
    if (tarefa) itens.push({ tipo: 'cobertura', tarefa, dia: hojeSP(new Date(h.em)), de: h.de, para: h.para, origem: h.origem });
  }

  const porDia = new Map();
  for (const item of itens) {
    if (item.dia < inicio) continue;
    if (!porDia.has(item.dia)) porDia.set(item.dia, []);
    porDia.get(item.dia).push(item);
  }
  const dias = [...porDia.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dia, lista]) => ({
      dia,
      itens: lista.sort((a, b) => ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo] || a.tarefa.nome.localeCompare(b.tarefa.nome, 'pt-BR')),
    }));
  const desde7 = somarDias(hoje, -6);
  const ultimos7 = itens.filter(i => i.dia >= desde7 && i.dia <= hoje).length;
  return { dias, ultimos7 };
}
