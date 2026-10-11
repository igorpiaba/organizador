import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hojeSP, somarDias, diasEntre, formatarDDMM, diaDaSemana, rotinaVenceEm, statusCobertura } from '../web/regras.js';

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

const img = {id:'i', nome:'Banners: imagens prontas', coberto_ate:'2026-10-22', avisar_dias_antes:1, limitada_por:null, ativa:true};
const pal = (ate, extra={}) => ({id:'p', nome:'Banners agendados: Palpite', coberto_ate:ate, avisar_dias_antes:1, limitada_por:'i', ativa:true, ...extra});
const mapa = (...ts) => new Map(ts.map(t => [t.id, t]));

test('cobertura ok, acabando, no limite exato e vencida', () => {
  assert.equal(statusCobertura(img, mapa(img), '2026-10-20').estado, 'ok');
  assert.deepEqual(statusCobertura(img, mapa(img), '2026-10-21'), {estado:'acabando', diasRestantes:1, alcancouLimite:false, limitante:null});
  assert.equal(statusCobertura(img, mapa(img), '2026-10-22').estado, 'acabando');
  assert.equal(statusCobertura(img, mapa(img), '2026-10-23').estado, 'atrasada');
  assert.equal(statusCobertura(img, mapa(img), '2026-10-23').diasRestantes, -1);
});
test('antecedência de N dias', () => {
  const t = {...img, avisar_dias_antes:3};
  assert.equal(statusCobertura(t, mapa(t), '2026-10-18').estado, 'ok');
  assert.equal(statusCobertura(t, mapa(t), '2026-10-19').estado, 'acabando');
});
test('alcançou o limite', () => {
  assert.equal(statusCobertura(pal('2026-10-19'), mapa(img), '2026-10-11').alcancouLimite, false);
  const s = statusCobertura(pal('2026-10-22'), mapa(img), '2026-10-11');
  assert.equal(s.alcancouLimite, true);
  assert.equal(s.limitante.id, 'i');
});
test('limitante pausada não dispara limite', () => {
  const pausada = {...img, ativa:false};
  assert.equal(statusCobertura(pal('2026-10-22'), mapa(pausada), '2026-10-11').alcancouLimite, false);
});
test('cobertura sem data é atrasada', () => {
  assert.deepEqual(statusCobertura({...img, coberto_ate:null}, mapa(), '2026-10-11'),
    {estado:'atrasada', diasRestantes:null, alcancouLimite:false, limitante:null});
});
