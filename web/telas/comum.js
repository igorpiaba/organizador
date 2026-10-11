// Peças de tela usadas por mais de uma aba.
import { el } from '../dom.js';

export function bolinha(tarefa, estado) {
  const cat = estado.categorias.find(c => c.id === tarefa.categoria_id);
  return el('span', { class: 'bolinha', style: { background: cat?.cor || 'var(--neutro)' }, title: cat?.nome || 'Sem categoria' });
}

export function seloPrioridade(tarefa) {
  return tarefa.prioridade === 'alta' ? el('span', { class: 'selo selo-alta' }, 'alta') : null;
}

export function campoCobertura(tarefa, acoes) {
  return el('label', { class: 'campo-cobertura' },
    el('span', {}, 'Coberto até'),
    el('input', {
      type: 'date', value: tarefa.coberto_ate || '', disabled: !acoes.online,
      onchange: (e) => e.target.value && acoes.atualizarCobertura(tarefa, e.target.value),
    }));
}
