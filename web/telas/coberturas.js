// Aba "Coberturas": até quando cada cobertura está garantida.
import { el } from '../dom.js';
import { statusCobertura, formatarDDMM, textoLimite } from '../regras.js';
import { bolinha, seloPrioridade, campoCobertura } from './comum.js';

function restante(status) {
  if (status.diasRestantes === null) return 'sem data';
  if (status.diasRestantes < 0) return 'acabou';
  if (status.diasRestantes === 0) return 'acaba hoje';
  return status.diasRestantes === 1 ? '1 dia' : `${status.diasRestantes} dias`;
}

export function desenhar(raiz, estado, acoes) {
  const porId = new Map(estado.tarefas.map(t => [t.id, t]));
  const linhas = estado.tarefas
    .filter(t => t.tipo === 'cobertura' && t.ativa)
    .map(t => ({ tarefa: t, status: statusCobertura(t, porId, estado.hoje) }))
    .sort((a, b) => (a.status.diasRestantes ?? -Infinity) - (b.status.diasRestantes ?? -Infinity));

  if (linhas.length === 0) {
    raiz.append(el('p', { class: 'vazio' }, 'Nenhuma cobertura. Crie uma na aba Tarefas.'));
    return;
  }
  raiz.append(el('ul', { class: 'lista' }, linhas.map(({ tarefa, status }) => {
    const cor = status.estado === 'atrasada' ? 'atrasada' : (status.estado === 'acabando' || status.alcancouLimite) ? 'acabando' : 'ok';
    const proporcao = status.diasRestantes === null ? 1 : Math.max(0, Math.min(status.diasRestantes, 14)) / 14;
    const limitante = tarefa.limitada_por ? porId.get(tarefa.limitada_por) : null;
    const limite = textoLimite(status);
    return el('li', { class: 'item' }, el('div', { class: 'item-corpo cobertura' },
      el('div', { class: 'item-linha' }, bolinha(tarefa, estado), el('strong', { class: 'item-texto' }, tarefa.nome), seloPrioridade(tarefa)),
      el('div', { class: 'cobertura-info' },
        el('span', {}, tarefa.coberto_ate ? `até ${formatarDDMM(tarefa.coberto_ate)}` : 'sem data de cobertura'),
        el('span', {}, restante(status))),
      el('div', { class: 'barra', role: 'img', 'aria-label': restante(status) },
        el('span', { class: `barra-${cor}`, style: { width: `${Math.max(proporcao * 100, cor === 'ok' ? 4 : 100)}%` } })),
      limitante ? el('div', { class: 'item-obs' }, `limitada por ${limitante.nome}`) : null,
      limite ? el('div', { class: 'item-limite' }, '↳ ' + limite) : null,
      campoCobertura(tarefa, acoes)));
  })));
}
