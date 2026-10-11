// Rodada de aviso: lê o Supabase, monta o dia e manda ao Telegram.
// Uso: node avisos/enviar.js --rodada manha|tarde|teste
import { hojeSP, montarDia } from '../web/regras.js';
import { montarMensagem } from './mensagem.js';
import { comTentativas } from './tentativas.js';

const PREFIXO_TESTE = '✅ Teste do organizador: tudo conectado.\n\n';

export async function principal({ rodada, env, fetch, agora = new Date(), esperaMs = 2000 }) {
  const hoje = hojeSP(agora);
  const cabecalhos = {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  const supabase = (caminho, opcoes = {}) => comTentativas(async () => {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${caminho}`, { headers: cabecalhos, ...opcoes });
    if (!r.ok) throw new Error(`Supabase respondeu ${r.status} em ${caminho.split('?')[0]}`);
    return r;
  }, { esperaMs });

  const tarefas = await (await supabase('tarefas?select=*')).json();
  const conclusoes = await (await supabase(`conclusoes?select=tarefa_id,dia&dia=eq.${hoje}`)).json();
  await supabase('heartbeat', { method: 'POST', body: JSON.stringify({ rodada }) });

  const dia = montarDia(tarefas, conclusoes, hoje);
  let texto = montarMensagem(dia, rodada === 'tarde' ? 'tarde' : 'manha');
  if (rodada === 'teste') texto = PREFIXO_TESTE + texto;
  if (!texto) return { enviada: false };

  await comTentativas(async () => {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: texto }),
    });
    if (!r.ok) throw new Error(`Telegram respondeu ${r.status}`);
  }, { esperaMs });
  return { enviada: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--rodada');
  const rodada = i > 0 ? process.argv[i + 1] : '';
  if (!['manha', 'tarde', 'teste'].includes(rodada)) {
    console.error('use --rodada manha|tarde|teste');
    process.exit(1);
  }
  principal({ rodada, env: process.env, fetch: globalThis.fetch })
    .then(r => console.log(r.enviada ? `rodada ${rodada}: mensagem enviada` : `rodada ${rodada}: nada a enviar`))
    .catch(erro => { console.error(`rodada ${rodada} falhou: ${erro.message}`); process.exit(1); });
}
