// Lembretes ao longo do dia: avulsas com horário de lembrete, avisadas uma vez por dia.
const FUSO = 'America/Sao_Paulo';
const INICIO = '08:00'; // lembretes até 08:00 já saem no resumo da manhã

export function horaSP(agora = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(agora);
}

export function chaveLembrete(tarefaId, dia) {
  return `lembrete ${tarefaId} ${dia}`;
}

export function lembretesDevidos(tarefas, enviados, hoje, hora) {
  return tarefas
    .filter(t => t.tipo === 'avulsa' && t.ativa && !t.concluida_em && t.lembrete)
    .filter(t => !t.prazo || t.prazo <= hoje)
    .filter(t => t.lembrete > INICIO && t.lembrete <= hora)
    .filter(t => !enviados.has(chaveLembrete(t.id, hoje)))
    .sort((a, b) => a.lembrete.localeCompare(b.lembrete) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function montarMensagemLembretes(tarefas) {
  const titulo = tarefas.length === 1 ? '⏰ Lembrete' : `⏰ Lembretes (${tarefas.length})`;
  const linhas = tarefas.flatMap(t => [`• ${t.nome} (${t.lembrete})`, ...(t.observacao ? [`  ${t.observacao}`] : [])]);
  return [titulo, ...linhas].join('\n');
}
