// Estado fixo usado pelos testes de regras, mensagem e envio. "Hoje" = 2026-10-21 (quarta).
const base = { avisar_dias_antes: 1, limitada_por: null, ativa: true, prioridade: 'media', categoria_id: null,
  coberto_ate: null, repeticao: null, horario_sugerido: null, prazo: null, lembrete: null, concluida_em: null };
const t = (campos) => ({ ...base, ...campos });

export const HOJE = '2026-10-21';

export const tarefasExemplo = [
  t({ id: 'img', codigo: 'banners-imagens', nome: 'Banners: imagens prontas', tipo: 'cobertura', coberto_ate: '2026-10-30' }),
  t({ id: 'pal', codigo: 'banners-palpite', nome: 'Banners agendados: Palpite', tipo: 'cobertura', coberto_ate: '2026-10-22', limitada_por: 'img' }),
  t({ id: 'pix', codigo: 'banners-pixgol', nome: 'Banners agendados: PIXGOL', tipo: 'cobertura', coberto_ate: '2026-10-19', limitada_por: 'img' }),
  t({ id: 'dash', codigo: 'dashboard-palpite', nome: 'Fechar dia dashboard: Palpite', tipo: 'rotina', repeticao: { tipo: 'diario' }, horario_sugerido: '08:00' }),
  t({ id: 'alta', nome: 'Conferir odds', tipo: 'rotina', repeticao: { tipo: 'diario' }, prioridade: 'alta' }),
  t({ id: 'util', nome: 'Rotina de dia útil', tipo: 'rotina', repeticao: { tipo: 'uteis' }, prioridade: 'baixa' }),
  t({ id: 'venc', nome: 'Pagar fornecedor', tipo: 'avulsa', prazo: '2026-10-20' }),
  t({ id: 'hoje', nome: 'Responder jurídico', tipo: 'avulsa', prazo: '2026-10-21' }),
  t({ id: 'semp', nome: 'Ler relatório', tipo: 'avulsa' }),
  t({ id: 'feita', nome: 'Já feita', tipo: 'avulsa', prazo: '2026-10-21', concluida_em: '2026-10-21T10:00:00Z' }),
  t({ id: 'paus', nome: 'Pausada', tipo: 'rotina', repeticao: { tipo: 'diario' }, ativa: false }),
];
