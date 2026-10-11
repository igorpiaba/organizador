import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hojeSP, somarDias, diasEntre, formatarDDMM, diaDaSemana, rotinaVenceEm } from '../web/regras.js';

test('hojeSP usa o fuso de São Paulo', () => {
  assert.equal(hojeSP(new Date('2026-10-12T02:30:00Z')), '2026-10-11'); // 23h30 em SP
  assert.equal(hojeSP(new Date('2026-10-12T03:00:00Z')), '2026-10-12');
});
test('somarDias vira mês e ano', () => {
  assert.equal(somarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(somarDias('2026-10-22', -1), '2026-10-21');
});
test('diasEntre', () => {
  assert.equal(diasEntre('2026-10-11', '2026-10-22'), 11);
  assert.equal(diasEntre('2026-10-22', '2026-10-21'), -1);
});
test('formatarDDMM', () => assert.equal(formatarDDMM('2026-10-05'), '05/10'));
test('diaDaSemana', () => {
  assert.equal(diaDaSemana('2026-10-11'), 0); // domingo
  assert.equal(diaDaSemana('2026-10-17'), 6); // sábado
});
test('rotina diaria e dias úteis', () => {
  assert.equal(rotinaVenceEm({tipo:'diario'}, '2026-10-11'), true);       // domingo
  assert.equal(rotinaVenceEm({tipo:'uteis'}, '2026-10-11'), false);       // domingo
  assert.equal(rotinaVenceEm({tipo:'uteis'}, '2026-10-10'), false);       // sábado
  assert.equal(rotinaVenceEm({tipo:'uteis'}, '2026-10-12'), true);        // segunda
});
test('rotina por dias da semana', () => {
  assert.equal(rotinaVenceEm({tipo:'semana', dias:[1,4]}, '2026-10-12'), true);  // seg
  assert.equal(rotinaVenceEm({tipo:'semana', dias:[1,4]}, '2026-10-13'), false); // ter
});
test('rotina mensal cai no último dia quando o mês é curto', () => {
  assert.equal(rotinaVenceEm({tipo:'mes', dia:31}, '2026-10-31'), true);
  assert.equal(rotinaVenceEm({tipo:'mes', dia:31}, '2026-11-30'), true);
  assert.equal(rotinaVenceEm({tipo:'mes', dia:31}, '2026-11-29'), false);
  assert.equal(rotinaVenceEm({tipo:'mes', dia:30}, '2027-02-28'), true);
  assert.equal(rotinaVenceEm({tipo:'mes', dia:15}, '2026-11-15'), true);
});
