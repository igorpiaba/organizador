// el('div', {class: 'x', onclick: fn}, 'texto', outroEl) — cria elementos sem innerHTML.
export function el(tag, atributos = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (chave.startsWith('on')) no.addEventListener(chave.slice(2), valor);
    else if (chave === 'style' && typeof valor === 'object') {
      for (const [prop, v] of Object.entries(valor)) {
        if (prop.startsWith('--')) no.style.setProperty(prop, v); else no.style[prop] = v;
      }
    }
    else if (chave in no && chave !== 'list') no[chave] = valor;
    else no.setAttribute(chave, valor === true ? '' : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    no.append(filho instanceof Node ? filho : String(filho));
  }
  return no;
}
