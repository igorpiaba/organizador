import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarDia } from '../web/regras.js';
import { montarMensagem } from '../avisos/mensagem.js';
import { HOJE, tarefasExemplo } from './exemplo.js';

const cobertura = (id, ate, extra = {}) => ({ id, nome: `Cobertura ${id}`, tipo: 'cobertura', coberto_ate: ate,
  avisar_dias_antes: 3, limitada_por: null, ativa: true, prioridade: 'media', ...extra });

test('mensagem da manhã completa', () => {
  const texto = montarMensagem(montarDia(tarefasExemplo, [], HOJE), 'manha');
  assert.equal(texto, [
    '☀️ Bom dia! Hoje, 21/10 (qua)',
    '',
    '🔴 Atrasadas (2)',
    '• Banners agendados: PIXGOL — acabou em 19/10',
    '• Pagar fornecedor — prazo era 20/10',
    '',
    '🟡 Coberturas (1)',
    '• Banners agendados: Palpite — acaba amanhã (22/10)',
    '',
    '🔁 Rotinas (3)',
    '• 08:00 Fechar dia dashboard: Palpite',
    '• Conferir odds',
    '• Rotina de dia útil',
    '',
    '📌 Avulsas (2)',
    '• Responder jurídico',
    '• Ler relatório',
  ].join('\n'));
});

test('linha de limite e cobertura folgada', () => {
  const tarefas = tarefasExemplo.map(x => x.id === 'pal' ? { ...x, coberto_ate: '2026-10-30' } : x);
  const texto = montarMensagem(montarDia(tarefas, [], HOJE), 'manha');
  assert.ok(texto.includes([
    '🟡 Coberturas (1)',
    '• Banners agendados: Palpite — coberto até 30/10',
    '  ↳ alcançou “Banners: imagens prontas” (30/10): hora de preparar as próximas',
  ].join('\n')));
});

test('acaba hoje, amanhã e em N dias', () => {
  const dia = montarDia([cobertura('a', '2026-10-21'), cobertura('b', '2026-10-22'), cobertura('c', '2026-10-24')], [], HOJE);
  const texto = montarMensagem(dia, 'manha');
  assert.ok(texto.includes('• Cobertura a — acaba hoje (21/10)'));
  assert.ok(texto.includes('• Cobertura b — acaba amanhã (22/10)'));
  assert.ok(texto.includes('• Cobertura c — acaba em 3 dias (24/10)'));
});

test('cobertura sem data', () => {
  const texto = montarMensagem(montarDia([cobertura('x', null)], [], HOJE), 'manha');
  assert.ok(texto.includes('🔴 Atrasadas (1)\n• Cobertura x — sem data de cobertura'));
});

test('rotina feita aparece com ✅ de manhã', () => {
  const texto = montarMensagem(montarDia(tarefasExemplo, [{ tarefa_id: 'dash', dia: HOJE }], HOJE), 'manha');
  assert.ok(texto.includes('✅ 08:00 Fechar dia dashboard: Palpite'));
});

test('avulsa com lembrete', () => {
  const tarefas = [{ ...tarefasExemplo[7], lembrete: '15:00' }];
  assert.ok(montarMensagem(montarDia(tarefas, [], HOJE), 'manha').includes('• Responder jurídico (lembrete 15:00)'));
});

test('tarde com tudo feito não envia', () => {
  const rotina = tarefasExemplo.find(x => x.id === 'dash');
  assert.equal(montarMensagem(montarDia([rotina], [{ tarefa_id: 'dash', dia: HOJE }], HOJE), 'tarde'), null);
});

test('tarde lista só o pendente', () => {
  const rotinas = tarefasExemplo.filter(x => x.id === 'dash' || x.id === 'alta');
  const texto = montarMensagem(montarDia(rotinas, [{ tarefa_id: 'dash', dia: HOJE }], HOJE), 'tarde');
  assert.equal(texto, '🌆 Pendente hoje, 21/10 (qua)\n\n🔁 Rotinas (1)\n• Conferir odds');
});

test('manhã vazia', () => {
  assert.equal(montarMensagem(montarDia([], [], '2026-10-25'), 'manha'),
    '☀️ Bom dia! Hoje, 25/10 (dom)\n\nNada pendente hoje. 🎉');
});
