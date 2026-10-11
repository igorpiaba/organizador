// Aba "Tarefas": listar, criar, editar, pausar e apagar; categorias no fim.
import { el } from '../dom.js';
import { formatarDDMM } from '../regras.js';
import { bolinha, seloPrioridade } from './comum.js';

const TIPOS = { cobertura: 'Cobertura', rotina: 'Rotina', avulsa: 'Avulsa' };
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const filtro = { categoria: '', tipo: '' };
let editando = null; // tarefa em edição, {} para nova, null para nenhuma

function resumo(t) {
  if (t.tipo === 'cobertura') return t.coberto_ate ? `coberto até ${formatarDDMM(t.coberto_ate)}` : 'sem data';
  if (t.tipo === 'rotina') {
    const r = t.repeticao || {};
    const quando = r.tipo === 'diario' ? 'todo dia' : r.tipo === 'uteis' ? 'dias úteis'
      : r.tipo === 'semana' ? (r.dias || []).map(d => DIAS[d]).join(', ') : r.tipo === 'mes' ? `dia ${r.dia}` : '';
    return [quando, t.horario_sugerido].filter(Boolean).join(' · ');
  }
  if (t.concluida_em) return 'concluída';
  return t.prazo ? `prazo ${formatarDDMM(t.prazo)}` : 'sem prazo';
}

function campo(rotulo, entrada) {
  return el('label', {}, rotulo, entrada);
}

function formulario(estado, acoes, redesenhar) {
  const t = { tipo: 'avulsa', prioridade: 'media', ativa: true, avisar_dias_antes: 1, ...editando };
  const erro = el('p', { class: 'erro', role: 'alert' });
  const ent = {
    nome: el('input', { type: 'text', value: t.nome || '', required: true }),
    tipo: el('select', {}, Object.entries(TIPOS).map(([v, n]) => el('option', { value: v, selected: t.tipo === v }, n))),
    categoria_id: el('select', {}, el('option', { value: '' }, 'Sem categoria'),
      estado.categorias.map(c => el('option', { value: c.id, selected: t.categoria_id === c.id }, c.nome))),
    prioridade: el('select', {}, [['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']]
      .map(([v, n]) => el('option', { value: v, selected: t.prioridade === v }, n))),
    codigo: el('input', { type: 'text', value: t.codigo || '', placeholder: 'ex.: banners-palpite', autocapitalize: 'off' }),
    observacao: el('textarea', { rows: 2 }, t.observacao || ''),
    coberto_ate: el('input', { type: 'date', value: t.coberto_ate || '' }),
    avisar_dias_antes: el('input', { type: 'number', min: 0, max: 30, value: t.avisar_dias_antes ?? 1 }),
    limitada_por: el('select', {}, el('option', { value: '' }, 'Nenhuma'),
      estado.tarefas.filter(x => x.tipo === 'cobertura' && x.id !== t.id)
        .map(x => el('option', { value: x.id, selected: t.limitada_por === x.id }, x.nome))),
    horario_sugerido: el('input', { type: 'time', value: t.horario_sugerido || '' }),
    prazo: el('input', { type: 'date', value: t.prazo || '' }),
    lembrete: el('input', { type: 'time', value: t.lembrete || '' }),
    diaMes: el('input', { type: 'number', min: 1, max: 31, value: t.repeticao?.dia || 1 }),
  };
  const rep = t.repeticao || { tipo: 'diario' };
  const radios = [['diario', 'Todo dia'], ['uteis', 'Dias úteis'], ['semana', 'Dias da semana'], ['mes', 'Dia do mês']]
    .map(([v, n]) => el('label', { class: 'opcao' }, el('input', { type: 'radio', name: 'repeticao', value: v, checked: rep.tipo === v }), n));
  const caixasDias = DIAS.map((n, i) => el('label', {}, el('input', { type: 'checkbox', value: i, checked: (rep.dias || []).includes(i) }), n));

  const blocos = {
    cobertura: el('div', { class: 'formulario-bloco' },
      campo('Coberto até', ent.coberto_ate), campo('Avisar quantos dias antes', ent.avisar_dias_antes),
      campo('Limitada por', ent.limitada_por)),
    rotina: el('div', { class: 'formulario-bloco' },
      el('fieldset', {}, el('legend', {}, 'Repetição'), radios,
        el('div', { class: 'dias-semana' }, caixasDias), campo('Dia do mês', ent.diaMes)),
      campo('Horário sugerido', ent.horario_sugerido)),
    avulsa: el('div', { class: 'formulario-bloco' }, campo('Prazo', ent.prazo), campo('Lembrete', ent.lembrete)),
  };
  const mostrarBloco = () => Object.entries(blocos).forEach(([tipo, b]) => { b.hidden = tipo !== ent.tipo.value; });
  ent.tipo.addEventListener('change', mostrarBloco);
  mostrarBloco();

  async function salvar(e) {
    e.preventDefault();
    erro.textContent = '';
    const tipo = ent.tipo.value;
    const nome = ent.nome.value.trim();
    const codigo = ent.codigo.value.trim();
    if (!nome) { erro.textContent = 'Dê um nome à tarefa.'; return; }
    if (codigo && !/^[a-z0-9-]+$/.test(codigo)) { erro.textContent = 'O código só aceita letras minúsculas, números e hífen.'; return; }
    const dados = {
      id: t.id, nome, tipo, codigo: codigo || null, ativa: t.ativa,
      categoria_id: ent.categoria_id.value || null, prioridade: ent.prioridade.value,
      observacao: ent.observacao.value.trim() || null,
      coberto_ate: null, avisar_dias_antes: 1, limitada_por: null,
      repeticao: null, horario_sugerido: null, prazo: null, lembrete: null,
    };
    if (tipo === 'cobertura') {
      Object.assign(dados, { coberto_ate: ent.coberto_ate.value || null,
        avisar_dias_antes: Math.max(0, Number(ent.avisar_dias_antes.value) || 0), limitada_por: ent.limitada_por.value || null });
    } else if (tipo === 'rotina') {
      const r = radios.map(l => l.querySelector('input')).find(i => i.checked)?.value || 'diario';
      const dias = caixasDias.map(l => l.querySelector('input')).filter(i => i.checked).map(i => Number(i.value));
      if (r === 'semana' && dias.length === 0) { erro.textContent = 'Escolha pelo menos um dia da semana.'; return; }
      const diaMes = Math.min(31, Math.max(1, Number(ent.diaMes.value) || 1));
      dados.repeticao = r === 'semana' ? { tipo: r, dias } : r === 'mes' ? { tipo: r, dia: diaMes } : { tipo: r };
      dados.horario_sugerido = ent.horario_sugerido.value || null;
    } else {
      Object.assign(dados, { prazo: ent.prazo.value || null, lembrete: ent.lembrete.value || null });
    }
    try {
      editando = null;
      await acoes.salvarTarefa(dados);
    } catch (falha) {
      editando = t;
      erro.textContent = falha?.code === '23505'
        ? `Já existe uma tarefa com o código ${codigo}`
        : `Não deu certo: ${falha?.message || falha}`;
    }
  }

  const botoes = el('div', { class: 'botoes' },
    el('button', { type: 'submit', disabled: !acoes.online }, 'Salvar'),
    el('button', { type: 'button', class: 'secundario', onclick: () => { editando = null; redesenhar(); } }, 'Cancelar'),
    t.id ? el('button', { type: 'button', class: 'secundario', disabled: !acoes.online,
      onclick: () => { editando = null; acoes.salvarTarefa({ id: t.id, ativa: !t.ativa }).catch(f => acoes.aviso(`Não deu certo: ${f.message}`)); } },
      t.ativa ? 'Pausar' : 'Reativar') : null,
    t.id ? el('button', { type: 'button', class: 'perigo', disabled: !acoes.online,
      onclick: () => { if (confirm(`Apagar “${t.nome}”?`)) { editando = null; acoes.apagarTarefa(t.id); } } }, 'Apagar') : null);

  return el('form', { class: 'formulario', onsubmit: salvar },
    el('h2', {}, t.id ? 'Editar tarefa' : 'Nova tarefa'),
    campo('Nome', ent.nome), campo('Tipo', ent.tipo), campo('Categoria', ent.categoria_id), campo('Prioridade', ent.prioridade),
    blocos.cobertura, blocos.rotina, blocos.avulsa,
    campo('Observação', ent.observacao), campo('Código (para automação, opcional)', ent.codigo),
    erro, botoes);
}

function categorias(estado, acoes) {
  const linha = (c) => {
    const nome = el('input', { type: 'text', value: c.nome || '', placeholder: 'Nova categoria', 'aria-label': 'Nome da categoria' });
    const cor = el('input', { type: 'color', value: c.cor || '#0ea5e9', 'aria-label': 'Cor' });
    const salvar = () => nome.value.trim() && acoes.salvarCategoria({ id: c.id, nome: nome.value.trim(), cor: cor.value });
    return el('li', { class: 'item categoria' }, cor, nome,
      c.id
        ? el('button', { type: 'button', class: 'perigo', disabled: !acoes.online,
            onclick: () => confirm(`Apagar a categoria “${c.nome}”?`) && acoes.apagarCategoria(c.id) }, 'Apagar')
        : el('button', { type: 'button', disabled: !acoes.online, onclick: salvar }, 'Adicionar'),
      c.id ? (cor.addEventListener('change', salvar), nome.addEventListener('change', salvar), null) : null);
  };
  return [el('h2', { class: 'secao-titulo' }, 'Categorias'),
    el('ul', { class: 'lista' }, estado.categorias.map(linha), linha({}))];
}

export function desenhar(raiz, estado, acoes) {
  const redesenhar = () => { raiz.replaceChildren(); desenhar(raiz, estado, acoes); };
  if (editando) {
    raiz.append(formulario(estado, acoes, redesenhar));
    return;
  }
  const filtros = el('div', { class: 'filtros' },
    el('select', { 'aria-label': 'Filtrar por categoria', onchange: (e) => { filtro.categoria = e.target.value; redesenhar(); } },
      el('option', { value: '' }, 'Todas as categorias'),
      estado.categorias.map(c => el('option', { value: c.id, selected: filtro.categoria === c.id }, c.nome))),
    el('select', { 'aria-label': 'Filtrar por tipo', onchange: (e) => { filtro.tipo = e.target.value; redesenhar(); } },
      el('option', { value: '' }, 'Todos os tipos'),
      Object.entries(TIPOS).map(([v, n]) => el('option', { value: v, selected: filtro.tipo === v }, n))));

  const lista = estado.tarefas
    .filter(t => (!filtro.categoria || t.categoria_id === filtro.categoria) && (!filtro.tipo || t.tipo === filtro.tipo));

  raiz.append(
    el('div', { class: 'botoes' }, el('button', { type: 'button', disabled: !acoes.online,
      onclick: () => { editando = {}; redesenhar(); } }, '+ Nova tarefa')),
    el('div', { style: { height: '12px' } }),
    filtros,
    lista.length === 0 ? el('p', { class: 'vazio' }, 'Nenhuma tarefa com esse filtro.') :
      el('ul', { class: 'lista' }, lista.map(t => el('li', {
        class: `item item-tarefa${t.ativa ? '' : ' pausada'}`, tabindex: 0,
        onclick: () => { if (acoes.online) { editando = t; redesenhar(); } },
        onkeydown: (e) => { if (e.key === 'Enter' && acoes.online) { editando = t; redesenhar(); } },
      }, el('div', { class: 'item-corpo' },
        el('div', { class: 'item-linha' }, bolinha(t, estado), el('span', { class: 'item-texto' }, t.nome), seloPrioridade(t),
          t.ativa ? null : el('span', { class: 'selo selo-pausada' }, 'pausada')),
        el('div', { class: 'item-obs' }, `${TIPOS[t.tipo]} · ${resumo(t)}`))))),
    ...categorias(estado, acoes));
}
