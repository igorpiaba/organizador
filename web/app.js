// Casca do app: login, abas, carga dos dados e modo offline.
import { el } from './dom.js';
import { hojeSP, formatarDDMM, diaDaSemana, somarDias, rotuloDia, limitarDia, diasEntre, LIMITE_PASSADO, LIMITE_FUTURO } from './regras.js';
import * as dados from './dados.js';
import * as hoje from './telas/hoje.js';
import * as coberturas from './telas/coberturas.js';
import * as tarefas from './telas/tarefas.js';

const ABAS = [
  ['hoje', 'Hoje', hoje],
  ['coberturas', 'Coberturas', coberturas],
  ['tarefas', 'Tarefas', tarefas],
];
const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const app = document.getElementById('app');
let logado = false;
let diaVisto = null; // dia escolhido na aba Hoje (null = hoje)

const TEMAS = [['auto', 'Automático', '◐'], ['claro', 'Claro', '☀︎'], ['escuro', 'Escuro', '☾']];

function temaSalvo() {
  try { return localStorage.getItem('organizador:tema') || 'auto'; } catch { return 'auto'; }
}

function aplicarTema(tema) {
  const raiz = document.documentElement;
  if (tema === 'claro') raiz.dataset.theme = 'light';
  else if (tema === 'escuro') raiz.dataset.theme = 'dark';
  else delete raiz.dataset.theme;
  try { localStorage.setItem('organizador:tema', tema); } catch { /* sem armazenamento: vale só nesta sessão */ }
}

function botaoTema() {
  const atual = TEMAS.find(([t]) => t === temaSalvo()) || TEMAS[0];
  const proximo = TEMAS[(TEMAS.indexOf(atual) + 1) % TEMAS.length];
  return el('button', { type: 'button', class: 'botao-icone', title: `Tema: ${atual[1]}`, 'aria-label': `Tema: ${atual[1]}. Trocar para ${proximo[1]}`,
    onclick: () => { aplicarTema(proximo[0]); renderizar(); } }, atual[2]);
}

function navegacaoDia(estado) {
  const n = diasEntre(estado.hoje, estado.dia);
  const ir = (dia) => { diaVisto = dia === estado.hoje ? null : dia; renderizar(); };
  return el('div', { class: 'nav-dia' },
    el('button', { type: 'button', class: 'botao-icone', 'aria-label': 'Dia anterior', disabled: n <= -LIMITE_PASSADO,
      onclick: () => ir(somarDias(estado.dia, -1)) }, '‹'),
    el('button', { type: 'button', class: 'botao-icone', 'aria-label': 'Próximo dia', disabled: n >= LIMITE_FUTURO,
      onclick: () => ir(somarDias(estado.dia, 1)) }, '›'),
    n === 0 ? null : el('button', { type: 'button', class: 'secundario botao-hoje', onclick: () => ir(estado.hoje) }, 'Hoje'));
}

function abaAtual() {
  const nome = location.hash.slice(1);
  return ABAS.find(([chave]) => chave === nome) || ABAS[0];
}

function aviso(texto) {
  const caixa = el('div', { class: 'aviso', role: 'status' }, texto);
  document.body.append(caixa);
  setTimeout(() => caixa.remove(), 4000);
}

function mensagemErro(erro) {
  return erro?.message?.includes('Failed to fetch') ? 'Sem conexão. Tente de novo.' : `Não deu certo: ${erro?.message || erro}`;
}

function criarAcoes(online) {
  const acoes = { online, aviso };
  for (const nome of ['marcarFeito', 'desmarcarFeito', 'atualizarCobertura', 'salvarTarefa', 'apagarTarefa', 'salvarCategoria', 'apagarCategoria']) {
    acoes[nome] = async (...args) => {
      try {
        await dados[nome](...args);
      } catch (erro) {
        if (nome === 'salvarTarefa') throw erro; // o formulário mostra o erro e continua aberto
        aviso(mensagemErro(erro));
      }
      renderizar();
    };
  }
  return acoes;
}

export async function renderizar() {
  if (!logado) return;
  let estado;
  let online = navigator.onLine;
  if (online) {
    try { estado = await dados.carregar(); } catch { online = false; }
  }
  if (!online) estado = dados.estadoSalvo();
  if (!estado) {
    app.replaceChildren(el('p', { class: 'vazio' }, 'Sem conexão e sem dados salvos neste aparelho.'));
    return;
  }
  estado.hoje = hojeSP();
  estado.dia = limitarDia(diaVisto || estado.hoje, estado.hoje);

  const [chaveAba, tituloAba, tela] = abaAtual();
  const naAbaHoje = chaveAba === 'hoje';
  const diaTopo = naAbaHoje ? estado.dia : estado.hoje;
  const conteudo = el('main', { class: 'conteudo' });
  tela.desenhar(conteudo, estado, criarAcoes(online));

  app.replaceChildren(
    el('header', { class: 'topo' },
      el('h1', {}, naAbaHoje ? rotuloDia(estado.dia, estado.hoje) : tituloAba),
      el('span', { class: 'data' }, `${NOMES_DIA[diaDaSemana(diaTopo)]}, ${formatarDDMM(diaTopo)}`),
      online ? null : el('span', { class: 'selo selo-offline' }, 'offline'),
      el('div', { class: 'topo-acoes' }, naAbaHoje ? navegacaoDia(estado) : null, botaoTema())),
    conteudo,
    el('nav', { class: 'abas' }, ABAS.map(([chave, titulo]) =>
      el('a', { href: `#${chave}`, class: chave === chaveAba ? 'ativa' : '', 'aria-current': chave === chaveAba ? 'page' : null }, titulo))),
  );
}

function telaLogin() {
  let email = '';
  const status = el('p', { class: 'login-status' });
  const campoCodigo = el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 20, placeholder: '12345678', autocapitalize: 'off' });
  const passoCodigo = el('form', { class: 'login-codigo', hidden: true, onsubmit: async (e) => {
    e.preventDefault();
    const { error } = await dados.supabase.auth.verifyOtp({ email, token: campoCodigo.value.replace(/\D/g, ''), type: 'email' });
    if (error) status.textContent = 'Código inválido ou vencido. Peça outro.';
    else iniciar();
  } }, el('label', {}, 'Código do e-mail', campoCodigo), el('button', { type: 'submit' }, 'Entrar'));

  const campoEmail = el('input', { type: 'email', required: true, autocomplete: 'email', autocapitalize: 'off', placeholder: 'seu@email.com' });
  const passoEmail = el('form', { onsubmit: async (e) => {
    e.preventDefault();
    email = campoEmail.value.trim().toLowerCase();
    const { error } = await dados.supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: false },
    });
    if (error) {
      status.textContent = /rate limit/i.test(error.message)
        ? 'Limite de e-mails por hora atingido. Se já tem um código, use "Já tenho um código".'
        : `Não deu certo: ${error.message}`;
      return;
    }
    status.textContent = `Enviado para ${email}. Digite o código do e-mail aqui, ou abra o link no mesmo aparelho.`;
    passoCodigo.hidden = false;
    campoCodigo.focus();
  } }, el('label', {}, 'E-mail', campoEmail), el('button', { type: 'submit' }, 'Entrar com link'));

  const jaTenho = el('button', { type: 'button', class: 'secundario', onclick: () => {
    email = campoEmail.value.trim().toLowerCase();
    if (!email) { status.textContent = 'Digite o e-mail primeiro.'; campoEmail.focus(); return; }
    status.textContent = '';
    passoCodigo.hidden = false;
    campoCodigo.focus();
  } }, 'Já tenho um código');

  app.replaceChildren(el('main', { class: 'login' }, el('h1', {}, 'Organizador'), passoEmail, jaTenho, passoCodigo, status));
}

async function iniciar() {
  if (!dados.configurado) {
    app.replaceChildren(el('p', { class: 'vazio' }, 'Falta preencher web/config.js com o endereço e a chave anon do Supabase.'));
    return;
  }
  const { data } = await dados.supabase.auth.getSession();
  if (!data.session) return telaLogin();
  logado = true;
  if (!ABAS.some(([c]) => c === location.hash.slice(1))) history.replaceState(null, '', '#hoje');
  renderizar();
}

aplicarTema(temaSalvo());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('hashchange', () => renderizar());
window.addEventListener('online', () => renderizar());
window.addEventListener('offline', () => renderizar());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') renderizar(); });
iniciar();
