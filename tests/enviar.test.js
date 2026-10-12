import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comTentativas } from '../avisos/tentativas.js';
import { principal } from '../avisos/enviar.js';
import { tarefasExemplo } from './exemplo.js';

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'chave', TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHAT_ID: '-100' };
const QUARTA_9H = new Date('2026-10-21T12:00:00Z');

function fetchFalso({ tarefas = tarefasExemplo, conclusoes = [], telegramStatus = 200, heartbeat = [] } = {}) {
  const chamadas = [];
  const fn = async (url, opcoes = {}) => {
    chamadas.push({ url, opcoes });
    const json = (corpo, status = 200) => ({ ok: status < 300, status, json: async () => corpo, text: async () => JSON.stringify(corpo) });
    if (url.includes('api.telegram.org')) return json({ ok: telegramStatus === 200 }, telegramStatus);
    if (url.includes('/rest/v1/tarefas')) return json(tarefas);
    if (url.includes('/rest/v1/conclusoes')) return json(conclusoes);
    if (url.includes('/rest/v1/heartbeat')) return (opcoes.method || 'GET') === 'GET' ? json(heartbeat) : json(null, 201);
    throw new Error('url inesperada ' + url);
  };
  return { fn, chamadas, telegram: () => chamadas.filter(c => c.url.includes('api.telegram.org')) };
}

test('comTentativas acerta na terceira', async () => {
  let n = 0;
  const valor = await comTentativas(async () => { n++; if (n < 3) throw new Error('falha'); return 'ok'; }, { esperaMs: 0 });
  assert.equal(valor, 'ok');
  assert.equal(n, 3);
});

test('comTentativas desiste depois de 3', async () => {
  let n = 0;
  await assert.rejects(comTentativas(async () => { n++; throw new Error('sempre'); }, { esperaMs: 0 }), /sempre/);
  assert.equal(n, 3);
});

test('tarde sem pendência não chama o Telegram mas grava heartbeat', async () => {
  const rotina = tarefasExemplo.find(t => t.id === 'dash');
  const f = fetchFalso({ tarefas: [rotina], conclusoes: [{ tarefa_id: 'dash', dia: '2026-10-21' }] });
  const r = await principal({ rodada: 'tarde', env, fetch: f.fn, agora: QUARTA_9H, esperaMs: 0 });
  assert.deepEqual(r, { enviada: false });
  assert.equal(f.telegram().length, 0);
  assert.equal(f.chamadas.filter(c => c.url.includes('/rest/v1/heartbeat')).length, 1);
});

test('manhã envia ao chat certo', async () => {
  const f = fetchFalso();
  const r = await principal({ rodada: 'manha', env, fetch: f.fn, agora: QUARTA_9H, esperaMs: 0 });
  assert.deepEqual(r, { enviada: true });
  const corpo = JSON.parse(f.telegram()[0].opcoes.body);
  assert.equal(corpo.chat_id, '-100');
  assert.ok(corpo.text.startsWith('☀️ Bom dia!'));
  assert.equal(f.telegram()[0].url, 'https://api.telegram.org/bottok/sendMessage');
});

test('teste prefixa a mensagem', async () => {
  const f = fetchFalso();
  await principal({ rodada: 'teste', env, fetch: f.fn, agora: QUARTA_9H, esperaMs: 0 });
  assert.ok(JSON.parse(f.telegram()[0].opcoes.body).text.startsWith('✅ Teste do organizador: tudo conectado.\n\n☀️ Bom dia!'));
});

test('Telegram fora do ar: 3 tentativas e erro', async () => {
  const f = fetchFalso({ telegramStatus: 500 });
  await assert.rejects(principal({ rodada: 'manha', env, fetch: f.fn, agora: QUARTA_9H, esperaMs: 0 }));
  assert.equal(f.telegram().length, 3);
});

test('usa o dia de São Paulo nas conclusões', async () => {
  const f = fetchFalso();
  await principal({ rodada: 'manha', env, fetch: f.fn, agora: new Date('2026-10-22T02:30:00Z'), esperaMs: 0 });
  assert.ok(f.chamadas.some(c => c.url.includes('/rest/v1/conclusoes') && c.url.includes('dia=eq.2026-10-21')));
});

const comLembrete = tarefasExemplo.map(t => t.id === 'hoje' ? { ...t, lembrete: '15:00' } : t);
const QUARTA_15H10 = new Date('2026-10-21T18:10:00Z');

test('rodada de lembretes envia o que venceu e registra', async () => {
  const f = fetchFalso({ tarefas: comLembrete });
  const r = await principal({ rodada: 'lembretes', env, fetch: f.fn, agora: QUARTA_15H10, esperaMs: 0 });
  assert.deepEqual(r, { enviada: true });
  assert.equal(JSON.parse(f.telegram()[0].opcoes.body).text, '⏰ Lembrete\n• Responder jurídico (15:00)');
  const registros = f.chamadas.filter(c => c.url.includes('/rest/v1/heartbeat') && c.opcoes.method === 'POST').map(c => JSON.parse(c.opcoes.body));
  assert.deepEqual(registros, [{ rodada: 'lembrete hoje 2026-10-21' }]);
});

test('rodada de lembretes não repete o que já foi avisado', async () => {
  const f = fetchFalso({ tarefas: comLembrete, heartbeat: [{ rodada: 'lembrete hoje 2026-10-21' }] });
  const r = await principal({ rodada: 'lembretes', env, fetch: f.fn, agora: QUARTA_15H10, esperaMs: 0 });
  assert.deepEqual(r, { enviada: false });
  assert.equal(f.telegram().length, 0);
  assert.equal(f.chamadas.filter(c => c.opcoes.method === 'POST').length, 0);
  assert.ok(f.chamadas.some(c => c.url.includes('heartbeat?select=rodada&rodada=like.lembrete*2026-10-21')));
});
