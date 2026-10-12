// Aba "Coberturas": até quando cada cobertura está garantida.
import { el } from '../dom.js';
import { statusCobertura, textoLimite } from '../regras.js';
import { etiqueta, chipCobertura, textoStatusCobertura } from './comum.js';

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
  raiz.append(el('h2', { class: 'grupo-titulo' }, el('span', {}, 'Coberturas', el('span', { class: 'n' }, String(linhas.length))), el('span', {}, 'fim')),
    el('ul', { class: 'lista' }, linhas.map(({ tarefa, status }) => {
      const cor = status.estado === 'atrasada' ? 'atrasada' : (status.estado === 'acabando' || status.alcancouLimite) ? 'acabando' : 'ok';
      const proporcao = status.diasRestantes === null || status.diasRestantes < 0 ? 1 : Math.min(status.diasRestantes, 14) / 14;
      const limitante = tarefa.limitada_por ? porId.get(tarefa.limitada_por) : null;
      const limite = textoLimite(status);
      const tom = cor === 'atrasada' ? 'perigo' : cor === 'ok' ? 'ok' : '';
      return el('li', { class: `linha${tarefa.prioridade === 'alta' ? ' alta' : ''}` },
        el('div', { class: 'linha-corpo' },
          el('div', { class: 'nome' }, tarefa.nome),
          el('div', { class: `sub ${cor === 'atrasada' ? 'perigo' : cor === 'acabando' ? 'alerta' : ''}` }, textoStatusCobertura(status)),
          limitante ? el('div', { class: 'sub' }, `limitada por ${limitante.nome}`) : null,
          limite ? el('div', { class: 'sub alerta' }, '↳ ' + limite) : null,
          el('div', { class: 'barra', role: 'img', 'aria-label': textoStatusCobertura(status) },
            el('span', { class: `barra-${cor}`, style: { width: `${Math.max(proporcao * 100, 4)}%` } }))),
        el('div', { class: 'linha-dir' }, etiqueta(tarefa, estado), chipCobertura(tarefa, acoes, tom)));
    })));
}
