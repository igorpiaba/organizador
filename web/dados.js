// Todas as chamadas do app ao Supabase.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { hojeSP, somarDias, LIMITE_PASSADO, LIMITE_FUTURO } from './regras.js';

export const configurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const supabase = configurado ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const CHAVE_LOCAL = 'organizador:estado';
const CAMPOS_TAREFA = ['nome', 'tipo', 'categoria_id', 'prioridade', 'observacao', 'ativa', 'codigo',
  'coberto_ate', 'avisar_dias_antes', 'limitada_por', 'repeticao', 'horario_sugerido', 'prazo', 'lembrete', 'concluida_em'];

function checar({ data, error }) {
  if (error) throw error;
  return data;
}

export async function carregar() {
  const hoje = hojeSP();
  const [tarefas, categorias, conclusoes] = (await Promise.all([
    supabase.from('tarefas').select('*').order('nome'),
    supabase.from('categorias').select('*').order('nome'),
    supabase.from('conclusoes').select('tarefa_id,dia').gte('dia', somarDias(hoje, -LIMITE_PASSADO)).lte('dia', somarDias(hoje, LIMITE_FUTURO)),
  ])).map(checar);
  const estado = { tarefas, categorias, conclusoes };
  try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(estado)); } catch { /* sem armazenamento: segue sem cópia */ }
  return estado;
}

export function estadoSalvo() {
  try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL)); } catch { return null; }
}

export async function marcarFeito(tarefa, dia) {
  if (tarefa.tipo === 'rotina') checar(await supabase.from('conclusoes').upsert({ tarefa_id: tarefa.id, dia }));
  else checar(await supabase.from('tarefas').update({ concluida_em: new Date().toISOString() }).eq('id', tarefa.id));
}

export async function desmarcarFeito(tarefa, dia) {
  if (tarefa.tipo === 'rotina') checar(await supabase.from('conclusoes').delete().eq('tarefa_id', tarefa.id).eq('dia', dia));
  else checar(await supabase.from('tarefas').update({ concluida_em: null }).eq('id', tarefa.id));
}

export async function atualizarCobertura(tarefa, novaData) {
  checar(await supabase.from('tarefas').update({ coberto_ate: novaData }).eq('id', tarefa.id));
  checar(await supabase.from('historico_cobertura').insert({
    tarefa_id: tarefa.id, de: tarefa.coberto_ate, para: novaData, origem: 'app',
  }));
}

export async function salvarTarefa(tarefa) {
  const campos = Object.fromEntries(CAMPOS_TAREFA.filter(c => c in tarefa).map(c => [c, tarefa[c]]));
  if (tarefa.id) checar(await supabase.from('tarefas').update(campos).eq('id', tarefa.id));
  else checar(await supabase.from('tarefas').insert(campos));
}

export async function apagarTarefa(id) {
  checar(await supabase.from('tarefas').delete().eq('id', id));
}

export async function salvarCategoria(cat) {
  const campos = { nome: cat.nome, cor: cat.cor };
  if (cat.id) checar(await supabase.from('categorias').update(campos).eq('id', cat.id));
  else checar(await supabase.from('categorias').insert(campos));
}

export async function apagarCategoria(id) {
  checar(await supabase.from('categorias').delete().eq('id', id));
}
