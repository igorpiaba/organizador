// Aba "Hoje": o que pede ação no dia.
import { el } from '../dom.js';
import { montarDia, textoItem, textoLimite } from '../regras.js';
import { bolinha, seloPrioridade, campoCobertura } from './comum.js';

const GRUPOS = [
  ['atrasadas', 'Atrasadas'],
  ['coberturas', 'Coberturas acabando'],
  ['rotinas', 'Rotinas de hoje'],
  ['avulsas', 'Avulsas'],
];

function item(it, dia, estado, acoes) {
  const { tarefa } = it;
  const limite = textoLimite(it.status);
  const controle = tarefa.tipo === 'cobertura'
    ? campoCobertura(tarefa, acoes)
    : el('input', {
        type: 'checkbox', class: 'check', checked: Boolean(it.feita), disabled: !acoes.online,
        'aria-label': `Marcar ${tarefa.nome} como feita`,
        onchange: (e) => (e.target.checked ? acoes.marcarFeito : acoes.desmarcarFeito)(tarefa, dia.hoje),
      });
  return el('li', { class: `item${it.feita ? ' feita' : ''}${tarefa.tipo === 'cobertura' ? ' item-cobertura' : ''}` },
    tarefa.tipo === 'cobertura' ? null : controle,
    el('div', { class: 'item-corpo' },
      el('div', { class: 'item-linha' }, bolinha(tarefa, estado),
        el('span', { class: 'item-texto' }, textoItem({ ...it, hoje: dia.hoje })), seloPrioridade(tarefa)),
      limite ? el('div', { class: 'item-limite' }, '↳ ' + limite) : null,
      tarefa.observacao ? el('div', { class: 'item-obs' }, tarefa.observacao) : null,
      tarefa.tipo === 'cobertura' ? controle : null));
}

export function desenhar(raiz, estado, acoes) {
  const dia = montarDia(estado.tarefas, estado.conclusoes, estado.dia);
  const grupos = GRUPOS.filter(([chave]) => dia[chave].length > 0);
  const ehHoje = estado.dia === estado.hoje;
  if (grupos.length === 0) {
    raiz.append(el('p', { class: 'vazio' }, ehHoje ? 'Nada pendente hoje. 🎉' : 'Nada para este dia.'));
    return;
  }
  for (const [chave, tituloBase] of grupos) {
    const titulo = chave === 'rotinas' && !ehHoje ? 'Rotinas do dia' : tituloBase;
    raiz.append(el('section', { class: `grupo grupo-${chave}` },
      el('h2', {}, titulo, el('span', { class: 'contagem' }, String(dia[chave].length))),
      el('ul', { class: 'lista' }, dia[chave].map(it => item(it, dia, estado, acoes)))));
  }
}
