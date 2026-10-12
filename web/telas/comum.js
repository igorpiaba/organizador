// Peças de tela usadas por mais de uma aba.
import { el } from '../dom.js';
import { formatarDDMM } from '../regras.js';

const SVG = 'http://www.w3.org/2000/svg';

// Peixe em traço (mesmo desenho do ícone), na cor de destaque do tema.
export function peixe(largura = 22) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', largura);
  svg.setAttribute('height', Math.round(largura * 0.62));
  svg.setAttribute('viewBox', '0 0 260 160');
  svg.setAttribute('aria-hidden', 'true');
  const caminho = document.createElementNS(SVG, 'path');
  caminho.setAttribute('d', 'M60 80 Q100 20 170 20 Q230 25 255 80 Q230 135 170 140 Q100 140 60 80 Z M60 80 Q40 40 5 25 Q15 60 35 80 Q15 100 5 135 Q40 120 60 80Z');
  caminho.setAttribute('fill', 'none');
  caminho.setAttribute('stroke', 'currentColor');
  caminho.setAttribute('stroke-width', '16');
  caminho.setAttribute('stroke-linejoin', 'round');
  svg.append(caminho);
  return svg;
}

// Etiqueta com o nome da categoria (PALPITE, PIXGOL...) na cor dela.
export function etiqueta(tarefa, estado) {
  const cat = estado.categorias.find(c => c.id === tarefa.categoria_id);
  return cat ? el('span', { class: 'tag', style: { '--cor': cat.cor } }, cat.nome) : null;
}

// Data de fim como "odd": tocar abre o seletor de data e atualiza a cobertura.
export function chipCobertura(tarefa, acoes, tom = '') {
  return el('label', { class: `chip ${tom}${acoes.online ? '' : ' desligado'}`, title: 'Mudar "coberto até"' },
    tarefa.coberto_ate ? formatarDDMM(tarefa.coberto_ate) : 'SEM DATA',
    el('input', {
      type: 'date', value: tarefa.coberto_ate || '', disabled: !acoes.online, 'aria-label': `Coberto até, ${tarefa.nome}`,
      onchange: (e) => e.target.value && acoes.atualizarCobertura(tarefa, e.target.value),
    }));
}

export function textoStatusCobertura(status) {
  if (status.diasRestantes === null) return 'sem data de cobertura';
  const n = status.diasRestantes;
  if (n < 0) return n === -1 ? 'acabou ontem' : `acabou há ${-n} dias`;
  if (n === 0) return 'acaba hoje';
  if (n === 1) return 'acaba amanhã';
  return `faltam ${n} dias`;
}
