// Aba "Feitas": avulsas concluídas e coberturas atualizadas nos últimos 30 dias (rotinas ficam de fora).
import { el } from '../dom.js';
import { montarFeitas, rotuloDia, formatarDDMM, diaDaSemana, diasEntre } from '../regras.js';
import { etiqueta } from './comum.js';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function tituloDia(dia, hoje) {
  const n = diasEntre(hoje, dia);
  return n >= -1 && n <= 1 ? `${rotuloDia(dia, hoje)} · ${formatarDDMM(dia)}` : `${DIAS[diaDaSemana(dia)]} · ${formatarDDMM(dia)}`;
}

function linha(item, estado, acoes) {
  const { tarefa } = item;
  if (item.tipo === 'cobertura') {
    return el('li', { class: 'linha' },
      el('span', { class: 'marca-cobertura', 'aria-hidden': 'true' }, '→'),
      el('div', { class: 'linha-corpo' }, el('div', { class: 'nome' }, tarefa.nome),
        el('div', { class: 'sub' }, `${item.de ? `de ${formatarDDMM(item.de)} ` : ''}para ${formatarDDMM(item.para)}`)),
      el('div', { class: 'linha-dir' }, etiqueta(tarefa, estado), item.origem === 'automatico' ? el('span', { class: 'selo-auto' }, 'AUTO') : null));
  }
  return el('li', { class: 'linha' },
    el('span', { class: 'marca-feita', 'aria-hidden': 'true' }, '✓'),
    el('div', { class: 'linha-corpo' }, el('div', { class: 'nome' }, tarefa.nome)),
    el('div', { class: 'linha-dir' }, etiqueta(tarefa, estado),
      el('button', { type: 'button', class: 'secundario botao-pequeno', disabled: !acoes.online,
        'aria-label': `Desfazer ${tarefa.nome} (${formatarDDMM(item.dia)})`, onclick: () => acoes.desmarcarFeito(tarefa, item.dia) }, 'Desfazer')));
}

export function desenhar(raiz, estado, acoes) {
  const { dias, ultimos7 } = montarFeitas(estado.tarefas, estado.historico || [], estado.hoje);
  raiz.append(el('div', { class: 'placar placar-unico' },
    el('div', { class: `g${ultimos7 === 0 ? ' zero' : ''}` }, el('b', {}, String(ultimos7)), el('span', {}, 'Feitas nos últimos 7 dias'))));
  if (dias.length === 0) {
    raiz.append(el('p', { class: 'vazio' }, 'Nada concluído nos últimos 30 dias.'));
    return;
  }
  for (const { dia, itens } of dias) {
    raiz.append(el('section', {},
      el('h2', { class: 'grupo-titulo' }, el('span', {}, tituloDia(dia, estado.hoje), el('span', { class: 'n' }, String(itens.length))), el('span', {})),
      el('ul', { class: 'lista' }, itens.map(item => linha(item, estado, acoes)))));
  }
}
