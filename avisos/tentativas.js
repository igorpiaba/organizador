// Repete uma função assíncrona até dar certo, no máximo `tentativas` vezes.
export async function comTentativas(fn, { tentativas = 3, esperaMs = 2000 } = {}) {
  let ultimoErro;
  for (let i = 1; i <= tentativas; i++) {
    try {
      return await fn();
    } catch (erro) {
      ultimoErro = erro;
      if (i < tentativas && esperaMs > 0) await new Promise(r => setTimeout(r, esperaMs));
    }
  }
  throw ultimoErro;
}
