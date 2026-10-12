// Aba "Hoje": placar, faixa de dias e o que pede ação no dia escolhido.
import { el } from '../dom.js';
import { montarDia, placarDia, diasComFimDeCobertura, textoLimite, formatarDDMM, somarDias, diasEntre,
  diaDaSemana, LIMITE_PASSADO, LIMITE_FUTURO } from '../regras.js';
import { etiqueta, chipCobertura, textoStatusCobertura } from './comum.js';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const GRUPOS = [
  ['atrasadas', 'Atrasadas', ''],
  ['coberturas', 'Vencendo', 'fim'],
  ['rotinas', 'Rotinas', 'hora'],
  ['avulsas', 'Avulsas', ''],
];

function placar(dia, estado) {
  const p = placarDia(dia, estado.tarefas);
  const celula = (classe, valor, rotulo, zero) => el('div', { class: `${classe}${zero ? ' zero' : ''}` }, el('b', {}, valor), el('span', {}, rotulo));
  return el('div', { class: 'placar', role: 'group', 'aria-label': 'Placar do dia' },
    celula('r', String(p.atrasadas), 'Atrasadas', p.atrasadas === 0),
    celula('y', String(p.vencendo), 'Vencendo', p.vencendo === 0),
    celula('g', `${p.feitas}/${p.total}`, 'Feitas', p.total === 0));
}

function faixa(estado, acoes) {
  const fins = diasComFimDeCobertura(estado.tarefas);
  const inicio = somarDias(estado.dia, -1);
  return el('div', { class: 'faixa' }, Array.from({ length: 7 }, (_, i) => {
    const d = somarDias(inicio, i);
    const n = diasEntre(estado.hoje, d);
    const classes = [d === estado.dia && 'atual', d === estado.hoje && 'hoje', fins.has(d) && 'fim'].filter(Boolean).join(' ');
    return el('button', { type: 'button', class: classes, disabled: n < -LIMITE_PASSADO || n > LIMITE_FUTURO,
      'aria-label': `${DIAS[diaDaSemana(d)]} ${formatarDDMM(d)}${fins.has(d) ? ', fim de cobertura' : ''}`,
      'aria-current': d === estado.dia ? 'date' : null, onclick: () => acoes.irParaDia(d) },
    DIAS[diaDaSemana(d)], el('b', {}, d.slice(8)));
  }));
}

function caixa(tarefa, feita, dia, acoes) {
  return el('input', {
    type: 'checkbox', class: 'check', checked: feita, disabled: !acoes.online, 'aria-label': `Marcar ${tarefa.nome} como feita`,
    onchange: (e) => (e.target.checked ? acoes.marcarFeito : acoes.desmarcarFeito)(tarefa, dia),
  });
}

function linha(item, dia, estado, acoes) {
  const { tarefa } = item;
  const subs = [];
  let esquerda = null;
  let direita;

  if (tarefa.tipo === 'cobertura') {
    const s = item.status;
    subs.push(el('div', { class: `sub ${s.estado === 'atrasada' ? 'perigo' : 'alerta'}` }, textoStatusCobertura(s)));
    const limite = textoLimite(s);
    if (limite) subs.push(el('div', { class: 'sub alerta' }, '↳ ' + limite));
    direita = [etiqueta(tarefa, estado), chipCobertura(tarefa, acoes, s.estado === 'atrasada' ? 'perigo' : '')];
  } else if (tarefa.tipo === 'rotina') {
    esquerda = caixa(tarefa, item.feita, dia.hoje, acoes);
    direita = [etiqueta(tarefa, estado), tarefa.horario_sugerido ? el('span', { class: 'hora' }, tarefa.horario_sugerido) : null];
  } else {
    esquerda = caixa(tarefa, false, dia.hoje, acoes);
    if (tarefa.prazo && tarefa.prazo < dia.hoje) subs.push(el('div', { class: 'sub perigo' }, `prazo era ${formatarDDMM(tarefa.prazo)}`));
    direita = [etiqueta(tarefa, estado), tarefa.lembrete ? el('span', { class: 'hora' }, tarefa.lembrete) : null];
  }
  if (tarefa.observacao) subs.push(el('div', { class: 'sub' }, tarefa.observacao));

  const classes = ['linha', item.feita && 'feita', tarefa.prioridade === 'alta' && 'alta'].filter(Boolean).join(' ');
  return el('li', { class: classes }, esquerda,
    el('div', { class: 'linha-corpo' }, el('div', { class: 'nome' }, tarefa.nome), subs),
    el('div', { class: 'linha-dir' }, direita));
}

export function desenhar(raiz, estado, acoes) {
  const dia = montarDia(estado.tarefas, estado.conclusoes, estado.dia);
  raiz.append(placar(dia, estado), faixa(estado, acoes));

  const grupos = GRUPOS.filter(([chave]) => dia[chave].length > 0);
  if (grupos.length === 0) {
    raiz.append(el('p', { class: 'vazio' }, estado.dia === estado.hoje ? 'Nada pendente hoje. 🎉' : 'Nada para este dia.'));
    return;
  }
  for (const [chave, titulo, coluna] of grupos) {
    raiz.append(el('section', { class: `grupo grupo-${chave}` },
      el('h2', { class: 'grupo-titulo' }, el('span', {}, titulo, el('span', { class: 'n' }, String(dia[chave].length))), el('span', {}, coluna)),
      el('ul', { class: 'lista' }, dia[chave].map(item => linha(item, dia, estado, acoes)))));
  }
}
