// Guarda a casca do app para abrir sem internet. Os dados vêm do Supabase (nunca interceptado).
const CACHE = 'organizador-v6';
const CASCA = ['./', 'index.html', 'estilo.css', 'app.js', 'config.js', 'dom.js', 'dados.js', 'regras.js',
  'telas/comum.js', 'telas/hoje.js', 'telas/coberturas.js', 'telas/tarefas.js', 'telas/feitas.js',
  'manifest.webmanifest', 'icone-192.png', 'icone-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const nossa = url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net';
  if (e.request.method !== 'GET' || !nossa) return;
  e.respondWith(
    fetch(e.request)
      .then(resposta => {
        const copia = resposta.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return resposta;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
