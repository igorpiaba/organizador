import { test } from 'node:test';
import assert from 'node:assert/strict';
import { horaSP, lembretesDevidos, chaveLembrete, montarMensagemLembretes } from '../avisos/lembretes.js';
import { HOJE, tarefasExemplo } from './exemplo.js';

const avulsa = (id, extra) => ({ ...tarefasExemplo[7], id, nome: `Tarefa ${id}`, prazo: HOJE, prioridade: 'alta', ...extra });

test('horaSP usa o fuso de São Paulo', () => {
  assert.equal(horaSP(new Date('2026-10-21T18:05:00Z')), '15:05');
  assert.equal(horaSP(new Date('2026-10-22T02:30:00Z')), '23:30');
});
test('lembrete devido quando a hora já passou e a tarefa está aberta', () => {
  const tarefas = [avulsa('a', { lembrete: '15:00' }), avulsa('b', { lembrete: '16:00' })];
  assert.deepEqual(lembretesDevidos(tarefas, new Set(), HOJE, '15:10').map(t => t.id), ['a']);
});
test('lembrete não repete no mesmo dia', () => {
  const tarefas = [avulsa('a', { lembrete: '15:00' })];
  assert.deepEqual(lembretesDevidos(tarefas, new Set([chaveLembrete('a', HOJE)]), HOJE, '18:00'), []);
  assert.equal(chaveLembrete('a', HOJE), 'lembrete a 2026-10-21');
});
test('lembrete ignora concluída, pausada, sem lembrete, prazo futuro e até 08:00', () => {
  const tarefas = [
    avulsa('feita', { lembrete: '15:00', concluida_em: '2026-10-21T12:00:00Z' }),
    avulsa('pausa', { lembrete: '15:00', ativa: false }),
    avulsa('sem', { lembrete: null }),
    avulsa('futuro', { lembrete: '15:00', prazo: '2026-10-22' }),
    avulsa('cedo', { lembrete: '08:00' }),
    { ...tarefasExemplo[3], lembrete: '15:00' },  // rotina
  ];
  assert.deepEqual(lembretesDevidos(tarefas, new Set(), HOJE, '20:00'), []);
});
test('lembrete vale para avulsa sem prazo e para atrasada', () => {
  const tarefas = [avulsa('semprazo', { lembrete: '10:00', prazo: null }), avulsa('atrasada', { lembrete: '10:00', prazo: '2026-10-19' })];
  assert.deepEqual(lembretesDevidos(tarefas, new Set(), HOJE, '10:30').map(t => t.id), ['atrasada', 'semprazo']);
});
test('mensagem de lembretes', () => {
  assert.equal(montarMensagemLembretes([avulsa('a', { nome: 'Mercados EPO', lembrete: '15:00', observacao: 'ver com a Digitain' })]),
    '⏰ Lembrete\n• Mercados EPO (15:00)\n  ver com a Digitain');
  assert.equal(montarMensagemLembretes([avulsa('a', { lembrete: '15:00' }), avulsa('b', { lembrete: '15:30' })]),
    '⏰ Lembretes (2)\n• Tarefa a (15:00)\n• Tarefa b (15:30)');
});

test('lembrete só para prioridade alta', () => {
  const tarefas = [avulsa('alta', { lembrete: '15:00' }), avulsa('media', { lembrete: '15:00', prioridade: 'media' }), avulsa('baixa', { lembrete: '15:00', prioridade: 'baixa' })];
  assert.deepEqual(lembretesDevidos(tarefas, new Set(), HOJE, '16:00').map(t => t.id), ['alta']);
});
