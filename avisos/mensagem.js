// Monta o texto do Telegram a partir do Dia calculado por montarDia.
import { formatarDDMM, diaDaSemana, textoItem, textoLimite } from '../web/regras.js';

const NOMES_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function linhas(itens, hoje, comMarca = false) {
  return itens.flatMap(item => {
    const marca = comMarca && item.feita ? '✅ ' : '• ';
    const saida = [marca + textoItem({ ...item, hoje })];
    const limite = textoLimite(item.status);
    if (limite) saida.push(`  ↳ ${limite}`);
    return saida;
  });
}

export function montarMensagem(dia, rodada) {
  const data = `${formatarDDMM(dia.hoje)} (${NOMES_DIA[diaDaSemana(dia.hoje)]})`;
  const tarde = rodada === 'tarde';
  const cabecalho = tarde ? `🌆 Pendente hoje, ${data}` : `☀️ Bom dia! Hoje, ${data}`;
  const rotinas = tarde ? dia.rotinas.filter(r => !r.feita) : dia.rotinas;

  const secoes = [
    ['🔴 Atrasadas', dia.atrasadas],
    ['🟡 Coberturas', dia.coberturas],
    ['🔁 Rotinas', rotinas],
    ['📌 Avulsas', dia.avulsas],
  ].filter(([, itens]) => itens.length > 0)
    .map(([titulo, itens]) => [`${titulo} (${itens.length})`, ...linhas(itens, dia.hoje, !tarde)].join('\n'));

  if (secoes.length === 0) return tarde ? null : `${cabecalho}\n\nNada pendente hoje. 🎉`;
  return [cabecalho, ...secoes].join('\n\n');
}
