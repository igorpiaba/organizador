// Aba "Feitas": o que foi concluído nos últimos 30 dias.
import { el } from '../dom.js';
import { montarFeitas, rotuloDia, formatarDDMM, diaDaSemana, diasEntre } from '../regras.js';
import { bolinha } from './comum.js';

const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function tituloDia(dia, hoje) {
  const n = diasEntre(hoje, dia);
  if (n >= -1 && n <= 1) return `${rotuloDia(dia, hoje)}, ${formatarDDMM(dia)}`;
  return `${NOMES_DIA[diaDaSemana(dia)]}, ${formatarDDMM(dia)}`;
}

function linha(item, estado, acoes) {
  const { tarefa } = item;
  if (item.tipo === 'cobertura') {
    const texto = `${tarefa.nome}: ${item.de ? `de ${formatarDDMM(item.de)} ` : ''}para ${formatarDDMM(item.para)}`;
    return el('li', { class: 'item' },
      el('span', { class: 'icone-feita', 'aria-hidden': 'true' }, '📅'),
      el('div', { class: 'item-corpo' }, el('div', { class: 'item-linha' }, bolinha(tarefa, estado),
        el('span', { class: 'item-texto' }, texto),
        item.origem === 'automatico' ? el('span', { class: 'selo selo-pausada' }, 'automático') : null)));
  }
  const desfazer = () => acoes.desmarcarFeito(tarefa, item.dia);
  return el('li', { class: 'item' },
    el('span', { class: 'icone-feita', 'aria-hidden': 'true' }, '✅'),
    el('div', { class: 'item-corpo' }, el('div', { class: 'item-linha' }, bolinha(tarefa, estado),
      el('span', { class: 'item-texto' }, tarefa.nome))),
    el('button', { type: 'button', class: 'secundario botao-pequeno', disabled: !acoes.online,
      'aria-label': `Desfazer ${tarefa.nome} (${formatarDDMM(item.dia)})`, onclick: desfazer }, 'Desfazer'));
}

export function desenhar(raiz, estado, acoes) {
  const { dias, ultimos7 } = montarFeitas(estado.tarefas, estado.conclusoes, estado.historico || [], estado.hoje);
  raiz.append(el('p', { class: 'resumo-feitas' },
    el('strong', {}, String(ultimos7)), ultimos7 === 1 ? ' tarefa feita nos últimos 7 dias' : ' tarefas feitas nos últimos 7 dias'));
  if (dias.length === 0) {
    raiz.append(el('p', { class: 'vazio' }, 'Nada concluído nos últimos 30 dias.'));
    return;
  }
  for (const { dia, itens } of dias) {
    raiz.append(el('section', { class: 'grupo' },
      el('h2', {}, tituloDia(dia, estado.hoje), el('span', { class: 'contagem' }, String(itens.length))),
      el('ul', { class: 'lista' }, itens.map(item => linha(item, estado, acoes)))));
  }
}
