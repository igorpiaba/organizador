# Organizador diário — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App pessoal de tarefas (cobertura, rotina, avulsa) no iPhone e no Mac, com avisos no Telegram que não dependem do Mac.

**Architecture:** PWA estática no GitHub Pages (pasta `web/`) que lê e escreve no Supabase com a chave pública + login por link mágico e RLS. Um módulo de regras puro (`web/regras.js`) decide o que vence hoje e é usado pelo app e pelo script de avisos em Node, que roda no GitHub Actions às 8h e às 17h (BRT) e manda a mensagem ao Telegram. Um CLI em Python (`cli/tarefas.py`) deixa as skills do Claude atualizarem tarefas pelo código.

**Tech Stack:** HTML/CSS/JS sem build (ES modules), `@supabase/supabase-js@2.45.4` via `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm`, Node 24 (`node --test`, `fetch` nativo, sem dependências npm), Python 3 só com biblioteca padrão (`unittest`, `urllib`), Supabase (Postgres + Auth), GitHub Actions + Pages, Telegram Bot API.

**Spec:** `docs/superpowers/specs/2026-10-11-organizador-design.md`

## Global Constraints

- Todo o texto do app e das mensagens é em português do Brasil.
- Datas internas são strings ISO `AAAA-MM-DD`. "Hoje" é sempre calculado no fuso `America/Sao_Paulo`. Na tela e nas mensagens, as datas aparecem como `DD/MM`.
- Tipos de tarefa: `cobertura`, `rotina`, `avulsa`. Prioridades: `alta`, `media`, `baixa`.
- Cobertura acabando: `coberto_ate - avisar_dias_antes <= hoje <= coberto_ate`. Atrasada: `hoje > coberto_ate`. `avisar_dias_antes` tem padrão 1.
- Alcançou o limite: `coberto_ate >= coberto_ate da tarefa em limitada_por`.
- Rotina não feita não acumula. Rotina com `dia X do mês` cai no último dia do mês quando ele não tem o dia X.
- Cron em UTC: `0 11 * * *` (manhã, 8h BRT) e `0 20 * * *` (tarde, 17h BRT). Às 17h, sem nada pendente, não envia mensagem.
- Envio ao Telegram: até 3 tentativas. Se todas falharem, o job termina com erro.
- Toda rodada de aviso grava uma linha em `heartbeat`. Uma vez por mês, um commit automático em `.github/batimento.txt`.
- Segredos: nunca em código, log ou chat.
  - **GitHub:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
  - **Mac:** Keychain, serviço `organizador-supabase`, contas `url` e `service_key`.
- A chave pública (anon) do Supabase pode ficar em `web/config.js`, porque a proteção vem do RLS.
- Sem dependências npm. O `package.json` serve só para `"type": "module"` e para o script `test`.
- O Igor é iniciante em terminal: todo passo manual dele vem como instrução clique a clique, e ele nunca cola chave no chat.

## Review Focus

1. **Cobertura sem data** (`coberto_ate` vazio, ex.: tarefa recém-criada): deve aparecer como atrasada, com o texto "sem data de cobertura". Não pode quebrar a tela nem o aviso. Teste na Task 2 e na Task 4.
2. **Automático encolhendo a cobertura:** a skill marca uma data **menor** que a atual (ex.: agendou só um jogo avulso). O CLI não sobrescreve sem `--forcar` e avisa. Teste na Task 7.
3. **Virada do dia no fuso:** às 23h30 de São Paulo já é dia seguinte em UTC, e "hoje" tem que continuar sendo o dia de SP. Teste na Task 1.
4. **Tarefa pausada ou limitante pausada:** tarefa com `ativa = false` some do "Hoje" e do aviso. Se a limitante estiver pausada, o alerta de limite não dispara. Teste na Task 3.
5. **Rodada da tarde sem pendência e Telegram fora do ar:** sem pendência, nenhuma chamada ao Telegram, mas o heartbeat é gravado. Com Telegram falhando, são exatamente 3 tentativas e depois erro. Teste na Task 5.

---

## Estrutura de arquivos

```
organizador/
  package.json                     # {"type":"module","scripts":{"test":"node --test"}}
  web/
    index.html  estilo.css  app.js # casca, login, abas, offline
    config.js                      # SUPABASE_URL e SUPABASE_ANON_KEY (públicos)
    regras.js                      # lógica pura de datas e vencimento (app + Node)
    dados.js                       # todas as chamadas ao Supabase do app
    telas/hoje.js  telas/coberturas.js  telas/tarefas.js
    manifest.webmanifest  sw.js  icone-192.png  icone-512.png
  avisos/
    mensagem.js                    # monta o texto do Telegram (puro)
    tentativas.js                  # repetir função assíncrona N vezes
    enviar.js                      # principal(): Supabase -> regras -> Telegram -> heartbeat
  tests/  regras.test.js  mensagem.test.js  enviar.test.js
  supabase/  schema.sql  seed.sql
  cli/  tarefas.py  test_tarefas.py
  .github/workflows/  avisos.yml  pages.yml
  .github/batimento.txt
```

---

### Task 1: Base do projeto + datas e rotinas em `regras.js`

**Files:**
- Create: `package.json`, `web/regras.js`, `tests/regras.test.js`, `.gitignore` (`node_modules/`, `.DS_Store`, `__pycache__/`)

**Interfaces:**
- Produces (em `web/regras.js`):
  - `hojeSP(agora: Date = new Date()): string`, que retorna o ISO do dia em America/Sao_Paulo (usar `Intl.DateTimeFormat('en-CA', {timeZone})`)
  - `somarDias(iso: string, n: number): string`, com aritmética em UTC
  - `diasEntre(de: string, ate: string): number`, que retorna `ate - de` em dias
  - `formatarDDMM(iso: string): string`, que retorna `'22/10'`
  - `diaDaSemana(iso: string): number` (0 = domingo)
  - `rotinaVenceEm(repeticao: object, iso: string): boolean`, com `repeticao` em um destes formatos: `{tipo:'diario'}`, `{tipo:'uteis'}`, `{tipo:'semana', dias:[1,4]}`, `{tipo:'mes', dia:31}`

- [ ] **Step 1: Escrever os testes que falham**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hojeSP, somarDias, diasEntre, formatarDDMM, rotinaVenceEm } from '../web/regras.js';

test('hojeSP usa o fuso de São Paulo', () => {
  assert.equal(hojeSP(new Date('2026-10-12T02:30:00Z')), '2026-10-11'); // 23h30 em SP
  assert.equal(hojeSP(new Date('2026-10-12T03:00:00Z')), '2026-10-12');
});
test('somarDias vira mês e ano', () => {
  assert.equal(somarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(somarDias('2026-10-22', -1), '2026-10-21');
});
test('diasEntre', () => {
  assert.equal(diasEntre('2026-10-11', '2026-10-22'), 11);
  assert.equal(diasEntre('2026-10-22', '2026-10-21'), -1);
});
test('formatarDDMM', () => assert.equal(formatarDDMM('2026-10-05'), '05/10'));
test('rotina diaria e dias úteis', () => {
  assert.equal(rotinaVenceEm({tipo:'diario'}, '2026-10-11'), true);       // domingo
  assert.equal(rotinaVenceEm({tipo:'uteis'}, '2026-10-11'), false);       // domingo
  assert.equal(rotinaVenceEm({tipo:'uteis'}, '2026-10-10'), false);       // sábado
  assert.equal(rotinaVenceEm({tipo:'uteis'}, '2026-10-12'), true);        // segunda
});
test('rotina por dias da semana', () => {
  assert.equal(rotinaVenceEm({tipo:'semana', dias:[1,4]}, '2026-10-12'), true);  // seg
  assert.equal(rotinaVenceEm({tipo:'semana', dias:[1,4]}, '2026-10-13'), false); // ter
});
test('rotina mensal cai no último dia quando o mês é curto', () => {
  assert.equal(rotinaVenceEm({tipo:'mes', dia:31}, '2026-10-31'), true);
  assert.equal(rotinaVenceEm({tipo:'mes', dia:31}, '2026-11-30'), true);
  assert.equal(rotinaVenceEm({tipo:'mes', dia:31}, '2026-11-29'), false);
  assert.equal(rotinaVenceEm({tipo:'mes', dia:30}, '2027-02-28'), true);
  assert.equal(rotinaVenceEm({tipo:'mes', dia:15}, '2026-11-15'), true);
});
```

- [ ] **Step 2:** Rodar `npm test`. Esperado: FAIL, porque o módulo `web/regras.js` não existe.
- [ ] **Step 3:** Implementar as funções em `web/regras.js` como ES module, sem dependências e sem `Date` local: só `Date.UTC` e `Intl`.
- [ ] **Step 4:** Rodar `npm test`. Esperado: todos PASS.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "regras: datas e rotinas"`.

---

### Task 2: Status de cobertura em `regras.js`

**Files:**
- Modify: `web/regras.js`, `tests/regras.test.js`

**Interfaces:**
- Consumes: `diasEntre`, `somarDias` (Task 1)
- Produces: `statusCobertura(tarefa, porId: Map<string, tarefa>, hoje: string): {estado: 'ok'|'acabando'|'atrasada', diasRestantes: number|null, alcancouLimite: boolean, limitante: tarefa|null}`
  - `tarefa` usa os nomes de coluna do banco: `id, nome, coberto_ate, avisar_dias_antes, limitada_por, ativa`.
  - `coberto_ate` nulo resulta em `{estado:'atrasada', diasRestantes:null}`.
  - `alcancouLimite` só é verdadeiro quando a limitante existe, está `ativa`, tem `coberto_ate` e `tarefa.coberto_ate >= limitante.coberto_ate`.

- [ ] **Step 1: Testes que falham**

```js
const img = {id:'i', nome:'Banners: imagens prontas', coberto_ate:'2026-10-22', avisar_dias_antes:1, limitada_por:null, ativa:true};
const pal = (ate, extra={}) => ({id:'p', nome:'Banners agendados: Palpite', coberto_ate:ate, avisar_dias_antes:1, limitada_por:'i', ativa:true, ...extra});
const mapa = (...ts) => new Map(ts.map(t => [t.id, t]));

test('cobertura ok, acabando, no limite exato e vencida', () => {
  assert.equal(statusCobertura(img, mapa(img), '2026-10-20').estado, 'ok');
  assert.deepEqual(statusCobertura(img, mapa(img), '2026-10-21'), {estado:'acabando', diasRestantes:1, alcancouLimite:false, limitante:null});
  assert.equal(statusCobertura(img, mapa(img), '2026-10-22').estado, 'acabando');
  assert.equal(statusCobertura(img, mapa(img), '2026-10-23').estado, 'atrasada');
  assert.equal(statusCobertura(img, mapa(img), '2026-10-23').diasRestantes, -1);
});
test('antecedência de N dias', () => {
  const t = {...img, avisar_dias_antes:3};
  assert.equal(statusCobertura(t, mapa(t), '2026-10-18').estado, 'ok');
  assert.equal(statusCobertura(t, mapa(t), '2026-10-19').estado, 'acabando');
});
test('alcançou o limite', () => {
  assert.equal(statusCobertura(pal('2026-10-19'), mapa(img), '2026-10-11').alcancouLimite, false);
  const s = statusCobertura(pal('2026-10-22'), mapa(img), '2026-10-11');
  assert.equal(s.alcancouLimite, true);
  assert.equal(s.limitante.id, 'i');
});
test('limitante pausada não dispara limite', () => {
  const pausada = {...img, ativa:false};
  assert.equal(statusCobertura(pal('2026-10-22'), mapa(pausada), '2026-10-11').alcancouLimite, false);
});
test('cobertura sem data é atrasada', () => {
  assert.deepEqual(statusCobertura({...img, coberto_ate:null}, mapa(), '2026-10-11'),
    {estado:'atrasada', diasRestantes:null, alcancouLimite:false, limitante:null});
});
```

- [ ] **Step 2:** Rodar `npm test`. Esperado: FAIL (`statusCobertura` não está exportada).
- [ ] **Step 3:** Implementar `statusCobertura` em `web/regras.js`.
- [ ] **Step 4:** Rodar `npm test`. Esperado: PASS.
- [ ] **Step 5:** Commit: `"regras: status de cobertura"`.

---

### Task 3: `montarDia` — o que aparece em "Hoje"

**Files:**
- Modify: `web/regras.js`, `tests/regras.test.js`

**Interfaces:**
- Consumes: `rotinaVenceEm`, `statusCobertura`
- Produces: `montarDia(tarefas: tarefa[], conclusoes: {tarefa_id, dia}[], hoje: string): Dia`

```
Dia = {
  hoje,
  atrasadas:  (ItemCobertura | ItemAvulsa)[]  (coberturas atrasadas + avulsas com prazo < hoje)
  coberturas: ItemCobertura[]  (estado 'acabando' ou alcancouLimite, e não atrasada)
  rotinas:    {tarefa, feita: boolean}[]   (rotinas que vencem hoje)
  avulsas:    {tarefa}[]       (prazo == hoje, depois sem prazo)
}
ItemCobertura = {tarefa, status}   // status = retorno de statusCobertura
ItemAvulsa    = {tarefa}
```

- Entram só tarefas com `ativa = true`. Mesmo assim, a `porId` usada em `statusCobertura` é montada com **todas** as tarefas.
- Avulsa com `concluida_em` preenchido não aparece.
- **Ordem:**
  - em cada grupo: prioridade `alta` > `media` > `baixa`, e depois `nome`;
  - em `rotinas`: primeiro `horario_sugerido` (`'08:00'`, com vazio por último), depois prioridade, depois nome.

- [ ] **Step 1: Testes que falham**, com uma lista fixa de tarefas para `hoje = '2026-10-21'` (quarta):
  - `montarDia` coloca `banners-pixgol` (coberto até `2026-10-19`) em `atrasadas`, `banners-palpite` (até `2026-10-22`) em `coberturas` e `banners-imagens` (até `2026-10-30`) em nenhum grupo;
  - a rotina `dashboard-palpite` (`{tipo:'diario'}`, `horario_sugerido:'08:00'`) vem antes de outra rotina diária sem horário com prioridade `alta`;
  - com `conclusoes = [{tarefa_id: <dashboard-palpite>, dia:'2026-10-21'}]`, ela aparece com `feita: true`; a conclusão de `'2026-10-20'` não conta;
  - uma rotina `{tipo:'uteis'}` não aparece em `montarDia(..., '2026-10-25')` (domingo);
  - a avulsa com `prazo:'2026-10-20'` vai para `atrasadas`, a com `prazo:'2026-10-21'` vai para `avulsas`, a sem prazo também vai para `avulsas` (depois da com prazo), e a com `concluida_em` não aparece;
  - uma tarefa com `ativa:false` não aparece em nenhum grupo;
  - a cobertura ainda dentro do prazo (`'2026-10-30'`) mas com `alcancouLimite` aparece em `coberturas`.
- [ ] **Step 2:** Rodar `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `montarDia`.
- [ ] **Step 4:** Rodar `npm test`. Esperado: PASS.
- [ ] **Step 5:** Commit: `"regras: montarDia"`.

---

### Task 4: Mensagem do Telegram (`avisos/mensagem.js`)

**Files:**
- Create: `avisos/mensagem.js`, `tests/mensagem.test.js`

**Interfaces:**
- Consumes: `Dia` (Task 3), `formatarDDMM`, `diaDaSemana`
- Produces: `montarMensagem(dia: Dia, rodada: 'manha'|'tarde'): string|null`, em texto puro, sem `parse_mode`.

**Texto exato:**
- **Cabeçalhos:**
  - manhã: `☀️ Bom dia! Hoje, 21/10 (qua)`. Nomes dos dias: `dom seg ter qua qui sex sáb`.
  - tarde: `🌆 Pendente hoje, 21/10 (qua)`.
- **Seções**, nesta ordem, cada uma com o título seguido de `(n)` e omitida quando vazia:
  - `🔴 Atrasadas`
  - `🟡 Coberturas`
  - `🔁 Rotinas`
  - `📌 Avulsas`
- **Linhas de item**, sempre começando com `• `:
  - cobertura atrasada: `• {nome} — acabou em {DD/MM}`; sem data: `• {nome} — sem data de cobertura`
  - avulsa atrasada: `• {nome} — prazo era {DD/MM}`
  - cobertura acabando:
    - `• {nome} — acaba hoje ({DD/MM})`
    - `• {nome} — acaba amanhã ({DD/MM})`
    - `• {nome} — acaba em {n} dias ({DD/MM})`
  - limite, em linha extra logo abaixo do item de qualquer grupo: `  ↳ alcançou “{nome da limitante}” ({DD/MM}): hora de preparar as próximas`
  - rotina: `• {HH:MM} {nome}`, ou `• {nome}` sem horário. Na manhã, rotina feita ganha `✅ ` no lugar de `• `.
  - avulsa: `• {nome}`, ou `• {nome} (lembrete {HH:MM})` quando tem `lembrete`. Assim o lembrete sai na rodada das 8h e, se ainda estiver pendente, na das 17h.
- **Corpo:**
  - as seções são separadas por uma linha em branco;
  - **manhã** com tudo vazio: o cabeçalho + `\n\nNada pendente hoje. 🎉`;
  - **tarde**: omite as rotinas feitas e retorna `null` quando não sobra nenhum item.

- [ ] **Step 1: Testes que falham:**
  - a mensagem da manhã com o `Dia` da Task 3 é igual, por `assert.equal`, a uma string literal completa escrita no teste, cobrindo atrasada, acabando amanhã, linha de limite, rotina com horário e avulsa;
  - acabando hoje / amanhã / em 3 dias;
  - cobertura sem data;
  - tarde com tudo feito retorna `null`;
  - tarde com uma rotina pendente lista só ela;
  - manhã vazia retorna `'☀️ Bom dia! Hoje, 25/10 (dom)\n\nNada pendente hoje. 🎉'`.
- [ ] **Step 2:** Rodar `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `montarMensagem`.
- [ ] **Step 4:** Rodar `npm test`. Esperado: PASS.
- [ ] **Step 5:** Commit: `"avisos: mensagem do Telegram"`.

---

### Task 5: Script de envio + workflow de avisos

**Files:**
- Create: `avisos/tentativas.js`, `avisos/enviar.js`, `tests/enviar.test.js`, `.github/workflows/avisos.yml`, `.github/batimento.txt` (uma linha com a data)

**Interfaces:**
- Consumes: `hojeSP`, `montarDia`, `montarMensagem`
- Produces:
  - `comTentativas(fn: () => Promise<T>, {tentativas = 3, esperaMs = 2000} = {}): Promise<T>`, que repete quando `fn` lança erro e, depois da última tentativa, lança o último erro.
  - `principal({rodada: 'manha'|'tarde'|'teste', env, fetch, agora: Date, esperaMs?}): Promise<{enviada: boolean}>`. Sequência:
    1. `GET {SUPABASE_URL}/rest/v1/tarefas?select=*`
    2. `GET .../conclusoes?select=tarefa_id,dia&dia=eq.{hoje}`, com os headers `apikey` e `Authorization: Bearer {SUPABASE_SERVICE_KEY}`
    3. `montarDia`, depois `montarMensagem`. A rodada `teste` usa a mensagem da manhã precedida de `✅ Teste do organizador: tudo conectado.\n\n`.
    4. Se houver texto: `POST https://api.telegram.org/bot{TOKEN}/sendMessage` com `{chat_id, text}`, dentro de `comTentativas`. Resposta não-ok conta como erro.
    5. Sempre: `POST .../heartbeat` com `{rodada}`.
  - Executado diretamente (`node avisos/enviar.js --rodada manha`), lê `process.env` e termina com código 1 em caso de erro, imprimindo só a mensagem, sem segredos.

- [ ] **Step 1: Testes que falham** (`tests/enviar.test.js`, com `fetch` falso que grava as chamadas e devolve respostas fixas, e `esperaMs: 0`):
  - `comTentativas` com função que falha 2 vezes e acerta na 3ª devolve o valor, com 3 chamadas;
  - função que sempre falha rejeita depois de exatamente 3 chamadas;
  - `principal` com rodada `tarde` e tudo feito: nenhuma chamada a `api.telegram.org`, uma chamada a `/rest/v1/heartbeat`, e `{enviada:false}`;
  - `principal` com rodada `manha`: o corpo enviado ao Telegram tem `chat_id` igual a `env.TELEGRAM_CHAT_ID`, e o texto começa com `☀️ Bom dia!`;
  - Telegram respondendo 500 sempre: `principal` rejeita depois de 3 POSTs ao Telegram;
  - `agora = new Date('2026-10-22T02:30:00Z')` consulta `dia=eq.2026-10-21`.
- [ ] **Step 2:** Rodar `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `avisos/tentativas.js` e `avisos/enviar.js`.
- [ ] **Step 4:** Rodar `npm test`. Esperado: PASS.
- [ ] **Step 5: Criar `.github/workflows/avisos.yml`:**
  - **Gatilhos:**
    - `schedule`: `0 11 * * *`, `0 20 * * *` e `0 12 1 * *`;
    - `workflow_dispatch`, com input `rodada` (choice: `teste`, `manha`, `tarde`, padrão `teste`).
  - **Job `avisos`:**
    - roda quando não é o cron mensal;
    - `ubuntu-latest`, `actions/checkout@v4`, `actions/setup-node@v4` com `node-version: 24`;
    - a rodada vem de `github.event.inputs.rodada`, ou do cron: `0 11 * * *` é `manha` e `0 20 * * *` é `tarde`;
    - comando: `node avisos/enviar.js --rodada $RODADA`, com os 4 segredos em `env`.
  - **Job `batimento`:**
    - roda só no cron `0 12 1 * *`;
    - `permissions: contents: write`;
    - grava `date -u +%F` em `.github/batimento.txt` e faz commit e push como `github-actions[bot]`, com a mensagem `"batimento mensal"`.
- [ ] **Step 6:** Commit: `"avisos: envio, tentativas e workflow"`.

---

### Task 6: Banco no Supabase (schema, RLS, seed) — com o Igor

**Files:**
- Create: `supabase/schema.sql`, `supabase/seed.sql`, `docs/configuracao.md` (passo a passo do Igor, incluindo as etapas desta task e das Tasks 7 e 10)

**Interfaces:**
- Produces: as tabelas abaixo. Os nomes de coluna são a interface do app, do script de avisos e do CLI.

```
categorias(id uuid pk default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
           nome text not null, cor text not null)
tarefas(id uuid pk default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
        nome text not null, tipo text not null check (tipo in ('cobertura','rotina','avulsa')),
        categoria_id uuid references categorias on delete set null,
        prioridade text not null default 'media' check (prioridade in ('alta','media','baixa')),
        observacao text, ativa boolean not null default true, codigo text,
        coberto_ate date, avisar_dias_antes int not null default 1 check (avisar_dias_antes >= 0),
        limitada_por uuid references tarefas on delete set null,
        repeticao jsonb, horario_sugerido text,            -- 'HH:MM'
        prazo date, lembrete text, concluida_em timestamptz,
        criada_em timestamptz not null default now(),
        unique (user_id, codigo))
conclusoes(tarefa_id uuid references tarefas on delete cascade, dia date, user_id uuid not null default auth.uid() references auth.users on delete cascade,
           feita_em timestamptz not null default now(), primary key (tarefa_id, dia))
historico_cobertura(id bigint generated always as identity primary key, tarefa_id uuid references tarefas on delete cascade,
           user_id uuid not null default auth.uid() references auth.users on delete cascade,
           de date, para date not null, origem text not null check (origem in ('app','automatico')), em timestamptz not null default now())
heartbeat(id bigint generated always as identity primary key, rodada text, em timestamptz not null default now())
```

- **RLS:**
  - ligado em todas as tabelas;
  - nas 4 primeiras, uma policy `for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())`;
  - `heartbeat` fica sem policy, acessível só pela chave de serviço.
- **`seed.sql`:**
  - pega o usuário com `(select id from auth.users order by created_at limit 1)`;
  - cria as categorias Palpite `#16a34a`, PIXGOL `#7c3aed` e Pessoal `#0ea5e9`;
  - cria as 5 tarefas da spec com os valores exatos dela: as coberturas de Palpite e PIXGOL com `limitada_por` apontando para `banners-imagens`; as rotinas com `repeticao {"tipo":"diario"}`, `horario_sugerido '08:00'`, prioridade `alta` e categoria da marca; as coberturas de banners com a categoria da marca e `banners-imagens` em Palpite;
  - pode rodar de novo sem duplicar (`on conflict (user_id, codigo) do nothing`; categorias: `where not exists`).

- [ ] **Step 1:** Escrever `schema.sql` e `seed.sql`. Validar a sintaxe colando os dois num Postgres local, se houver. Se não houver, a validação é o Step 3.
- [ ] **Step 2:** Escrever `docs/configuracao.md`, parte "Banco", clique a clique para o Igor:
  1. Supabase → New project (região São Paulo), anotar a senha num gerenciador.
  2. SQL Editor → colar `schema.sql` → Run.
  3. Authentication → Users → "Add user" → "Send invitation" para `o e-mail do Igor`, e aceitar o convite pelo e-mail.
  4. Authentication → Sign In / Providers → desligar "Allow new users to sign up".
  5. Authentication → URL Configuration: Site URL `https://igorpiaba.github.io/organizador/`; Redirect URLs com esse endereço e `http://localhost:8000/`.
  6. SQL Editor → colar `seed.sql` → Run.
  7. No **Terminal dele**, não no chat, gravar no Keychain com `security add-generic-password -s organizador-supabase -a url -w` e `-a service_key -w`. O comando pede o valor sem mostrar na tela. Os valores estão em Project Settings → API.
  8. Mandar ao Claude **só** o Project URL e a chave `anon`/publishable, que são públicos.
- [ ] **Step 3:** Pedir ao Igor para fazer os passos 1 a 8 e **esperar** a confirmação.
- [ ] **Step 4: Verificação** (o Claude roda; a chave sai do Keychain direto para o `curl`, sem aparecer):

```bash
URL=$(security find-generic-password -s organizador-supabase -a url -w)
curl -s "$URL/rest/v1/tarefas?select=codigo,coberto_ate" \
  -H "apikey: $(security find-generic-password -s organizador-supabase -a service_key -w)" \
  -H "Authorization: Bearer $(security find-generic-password -s organizador-supabase -a service_key -w)"
```

  Esperado: 5 linhas, `banners-imagens` 2026-10-22, `banners-palpite`/`banners-pixgol` 2026-10-19, `dashboard-palpite`/`dashboard-pixgol` null. Repetir o mesmo `curl` usando a chave **anon** nos dois headers deve retornar `[]`, o que confirma que o RLS está ativo.
- [ ] **Step 5:** Commit: `"supabase: schema, RLS, seed e guia de configuração"`.

---

### Task 7: CLI `cli/tarefas.py`

**Files:**
- Create: `cli/tarefas.py`, `cli/test_tarefas.py`

**Interfaces:**
- Consumes: as tabelas da Task 6 e o Keychain `organizador-supabase` (`url`, `service_key`), lidos com `subprocess.run(['security','find-generic-password','-s','organizador-supabase','-a',conta,'-w'])`.
- Produces:
  - **Comandos:**
    - `tarefas.py cobertura <codigo> --ate DD/MM[/AAAA] [--forcar]`
    - `tarefas.py feito <codigo> [--dia DD/MM[/AAAA]]`
    - `tarefas.py ver <codigo>`
  - **Funções puras, testáveis:**
    - `interpretar_data(texto: str, hoje: date) -> date`: `DD/MM/AAAA` exato. `DD/MM` usa o ano de `hoje` e, se cair mais de 90 dias antes de `hoje`, usa o ano seguinte. Formato inválido gera `ValueError` com a mensagem `data inválida: {texto} (use DD/MM)`.
    - `hoje_sp() -> date`, via `zoneinfo.ZoneInfo('America/Sao_Paulo')`.
  - **Comportamento:**
    - **`cobertura`:**
      - exige `tipo == 'cobertura'`;
      - se a nova data for menor que `coberto_ate` atual e não houver `--forcar`, não grava, imprime `cobertura atual ({DD/MM}) é maior que {DD/MM}; nada alterado (use --forcar)` e sai com código 0;
      - se gravar: faz `PATCH` em `tarefas` e `POST` em `historico_cobertura` com `origem 'automatico'` e `user_id` igual ao da tarefa, e imprime `{nome}: coberto até {DD/MM}`.
    - **`feito`:**
      - rotina: upsert em `conclusoes` (header `Prefer: resolution=merge-duplicates`), com o `user_id` da tarefa;
      - avulsa: `PATCH concluida_em = now`;
      - cobertura: erro `use "cobertura" para tarefas de cobertura`.
    - **`ver`:** imprime nome, tipo, `coberto_ate` ou status de hoje.
    - **Erros:** código não encontrado, rede ou Keychain imprimem em stderr `não consegui atualizar o organizador: {motivo}` e saem com código 1. Nunca imprimir a chave.

- [ ] **Step 1: Testes que falham** (`unittest`):
  - `interpretar_data('22/10', date(2026,10,11)) == date(2026,10,22)`;
  - `interpretar_data('05/01', date(2026,12,20)) == date(2027,1,5)`;
  - `interpretar_data('30/09', date(2026,10,11)) == date(2026,9,30)`;
  - `interpretar_data('22/10/2027', date(2026,10,11)) == date(2027,10,22)`;
  - `interpretar_data('32/10', ...)` e `interpretar_data('amanhã', ...)` geram `ValueError`;
  - `decidir_cobertura(atual: date|None, nova: date, forcar: bool) -> bool`: `(None, d, False)` é True; `(22/10, 19/10, False)` é False; `(22/10, 19/10, True)` é True; `(19/10, 22/10, False)` é True.
- [ ] **Step 2:** Rodar `python3 -m unittest cli/test_tarefas.py -v`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `cli/tarefas.py` (argparse, urllib, sem dependências) e deixar o arquivo executável.
- [ ] **Step 4:** Rodar os testes. Esperado: PASS.
- [ ] **Step 5: Integração real.** Depende da Task 6.
  1. Criar via REST uma tarefa `teste-cli` (cobertura, `user_id` do Igor).
  2. Rodar `tarefas.py cobertura teste-cli --ate 25/10`. Esperado: `... coberto até 25/10`.
  3. Rodar `--ate 20/10`. Esperado: a mensagem "nada alterado".
  4. Rodar `ver teste-cli`. Esperado: mostra 25/10.
  5. Apagar a tarefa.
  6. Rodar `ver nao-existe`. Esperado: código 1 e a mensagem em stderr.
- [ ] **Step 6:** Commit: `"cli: tarefas.py"`.

---

### Task 8: App — casca, login, dados e aba "Hoje"

**Files:**
- Create: `web/index.html`, `web/estilo.css`, `web/app.js`, `web/config.js`, `web/dados.js`, `web/telas/hoje.js`, `web/manifest.webmanifest`, `web/sw.js`, `web/icone-192.png`, `web/icone-512.png`

**Interfaces:**
- Consumes: `regras.js` (`hojeSP`, `montarDia`, `statusCobertura`, `formatarDDMM`, `diasEntre`), as tabelas da Task 6 e a URL e a chave anon que o Igor mandou na Task 6.
- Produces (em `web/dados.js`, todas assíncronas e usando o cliente `supabase` criado com `config.js`):
  - `carregar(): Promise<{tarefas, categorias, conclusoes}>`, com as conclusões dos últimos 7 dias. Em caso de sucesso, salva uma cópia em `localStorage['organizador:estado']` dentro de try/catch.
  - `estadoSalvo(): {tarefas, categorias, conclusoes}|null`
  - `marcarFeito(tarefa, dia: string)` e `desmarcarFeito(tarefa, dia: string)`. Para rotina, insere ou apaga em `conclusoes`. Para avulsa, preenche ou limpa `concluida_em`.
  - `atualizarCobertura(tarefa, novaData: string)`, que faz o update de `coberto_ate` e insere no `historico_cobertura` com `origem 'app'`.
  - `salvarTarefa(tarefa)` (com `id`, update; sem `id`, insert), `apagarTarefa(id)`, `salvarCategoria(cat)`, `apagarCategoria(id)`.
- Produces (em `web/app.js`): `renderizar()`, que recarrega e redesenha a aba atual. Cada tela exporta `desenhar(raiz: HTMLElement, estado, acoes)`. `acoes` reúne as funções de `dados.js` envolvidas por `renderizar()`, além de `online: boolean`.

**Comportamento:**
- **Login:**
  - sem sessão, mostra um campo de e-mail e o botão "Entrar com link";
  - chama `supabase.auth.signInWithOtp({email, options:{emailRedirectTo: location.origin + location.pathname, shouldCreateUser:false}})` e mostra `Link enviado para {email}. Abra no mesmo aparelho.`;
  - a sessão fica persistida (padrão do supabase-js).
- **Abas:**
  - barra inferior fixa com **Hoje**, **Coberturas** e **Tarefas** (hash `#hoje`, `#coberturas`, `#tarefas`);
  - a aba Hoje é a padrão.
- **Tela Hoje:**
  - grupos na ordem de `montarDia`, com os títulos `Atrasadas`, `Coberturas acabando`, `Rotinas de hoje` e `Avulsas`;
  - cada item mostra a bolinha da cor da categoria, o nome e a prioridade, como selo só quando `alta`;
  - os textos de status são os mesmos da Task 4, sem o `• `;
  - rotina e avulsa: caixa de seleção (feito/desfeito);
  - cobertura: botão `Coberto até…` que abre `<input type="date">` e chama `atualizarCobertura`;
  - com tudo vazio: `Nada pendente hoje. 🎉`.
- **Offline:**
  - com `navigator.onLine === false` ou falha no `carregar()`, usa `estadoSalvo()`, mostra o selo `offline` no topo e desabilita todos os controles de alteração;
  - os eventos `online` e `offline` chamam `renderizar()`.
- **PWA:**
  - `manifest.webmanifest`: `name "Organizador"`, `short_name "Organizador"`, `display "standalone"`, `start_url "./"`, `theme_color "#111827"`, ícones de 192 e 512;
  - `index.html` tem `<meta name="apple-mobile-web-app-capable" content="yes">`, `<link rel="apple-touch-icon" href="icone-192.png">` e viewport com `viewport-fit=cover`;
  - `sw.js` faz cache, com nome versionado `organizador-v1`, dos arquivos da casca. Usa network-first para os arquivos do próprio site e não intercepta chamadas a `supabase.co`.
  - Ícones: fundo `#111827` com um ✓ branco. Gerar com qualquer método local (ex.: SVG + `qlmanage -t -s 512`, depois `sips -z 192 192`).
- **Visual:**
  - mobile-first, com margem lateral de 16px e alvo de toque ≥ 44px;
  - tema claro e escuro via `prefers-color-scheme`, com cores em variáveis CSS no `:root`;
  - fonte do sistema (`-apple-system`).

- [ ] **Step 1:** Implementar os arquivos acima.
- [ ] **Step 2:** Rodar `npm test`. Esperado: PASS, sem regressão nas regras.
- [ ] **Step 3: Verificação manual no Mac.**
  1. Subir o servidor com `python3 -m http.server 8000 --directory web` e abrir `http://localhost:8000/`.
  2. Login pelo link mágico (o Igor clica no e-mail).
  3. A tela Hoje mostra as 2 rotinas de dashboard primeiro, com 08:00.
  4. Marcar uma como feita, recarregar e conferir que continua marcada.
  5. DevTools → Network → Offline: aparece o selo `offline` e os controles ficam desabilitados.
  6. Desmarcar a rotina de teste no fim.
- [ ] **Step 4:** Commit: `"app: casca, login, dados e aba Hoje"`.

---

### Task 9: App — abas "Coberturas" e "Tarefas"

**Files:**
- Create: `web/telas/coberturas.js`, `web/telas/tarefas.js`
- Modify: `web/app.js` (registrar as telas), `web/estilo.css`

**Interfaces:**
- Consumes: `desenhar(raiz, estado, acoes)` e as funções de `dados.js` (Task 8), `statusCobertura`, `formatarDDMM`, `diasEntre`
- Produces: `desenhar` em cada tela nova.

**Comportamento:**
- **Coberturas:**
  - uma linha por cobertura ativa, ordenada por `diasRestantes`, com nulos primeiro;
  - cada linha mostra: nome, `até {DD/MM}`, `{n} dias` (ou `acabou`, ou `sem data`) e uma barra;
  - cor da barra: verde quando `ok`, amarelo quando `acabando` ou `alcancouLimite`, vermelho quando `atrasada`;
  - comprimento da barra: `min(diasRestantes, 14) / 14`;
  - quando há `limitada_por`, a linha mostra `limitada por {nome}`;
  - o botão `Coberto até…` é o mesmo da tela Hoje.
- **Tarefas:**
  - lista de todas as tarefas, com filtros de categoria e de tipo (`<select>`); as pausadas aparecem em cinza com o rótulo `pausada`;
  - botão `+ Nova tarefa` e toque numa tarefa abrem o formulário;
  - o formulário mostra os campos comuns e, conforme o `tipo`, os campos específicos:
    - **cobertura:** `coberto_ate`, `avisar_dias_antes` e `limitada_por` (select com as outras coberturas);
    - **rotina:** `repeticao` (rádio: Todo dia / Dias úteis / Dias da semana com 7 caixas Dom–Sáb / Dia do mês com número 1–31) e `horario_sugerido` (`<input type="time">`);
    - **avulsa:** `prazo` e `lembrete`;
  - ações: `Salvar`, `Pausar`/`Reativar` e `Apagar` (com `confirm('Apagar “{nome}”?')`);
  - **validação:**
    - nome é obrigatório;
    - Dias da semana exige ao menos 1 dia;
    - `codigo` só aceita `[a-z0-9-]`;
    - código repetido (erro de unique do Supabase) mostra `Já existe uma tarefa com o código {codigo}`;
  - seção `Categorias` no fim da aba: lista com nome e cor (`<input type="color">`), além de adicionar e apagar.

- [ ] **Step 1:** Implementar as duas telas.
- [ ] **Step 2: Verificação manual em `http://localhost:8000/`:**
  1. Criar uma avulsa "Teste" com prazo hoje e conferir que ela aparece em Hoje.
  2. Criar uma rotina "Teste rotina" de dias da semana com só o dia de hoje e conferir que aparece em Hoje.
  3. Na aba Coberturas, mudar `banners-palpite` para 22/10 e conferir que aparece a linha "limitada por Banners: imagens prontas" e a barra amarela (alcançou o limite).
  4. Voltar `banners-palpite` para 19/10.
  5. Tentar salvar uma tarefa com código `banners-imagens` e conferir a mensagem de duplicado.
  6. Apagar as tarefas de teste.
- [ ] **Step 3:** Commit: `"app: abas Coberturas e Tarefas"`.

---

### Task 10: Publicação (GitHub, segredos, Pages, primeiro aviso, iPhone) — com o Igor

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `docs/configuracao.md` (partes "Publicação" e "iPhone")

**Interfaces:**
- Consumes: tudo o que foi feito antes.

- [ ] **Step 1: Criar `pages.yml`:**
  - gatilhos: `push` em `main` e `workflow_dispatch`;
  - job `testes`: `npm test` com Node 24;
  - job `publicar`: `needs: testes`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` com `path: web` e `actions/deploy-pages@v4`;
  - permissões: `pages: write`, `id-token: write` e `contents: read`.
- [ ] **Step 2:** Commit e criação do repositório público: `gh repo create igorpiaba/organizador --public --source . --push`.
- [ ] **Step 3: Ligar o Pages** com `gh api -X POST repos/igorpiaba/organizador/pages -f build_type=workflow`, e esperar o `pages.yml` ficar verde (`gh run watch`).
- [ ] **Step 4: Gravar os segredos sem passar pelo chat:**
  - **Token do bot:** sai do Keychain do monitor-bets direto para o GitHub, com `security find-generic-password -s monitor-bets-telegram -w | gh secret set TELEGRAM_BOT_TOKEN`. Conferir antes o nome da conta no Keychain com `security find-generic-password -s monitor-bets-telegram`.
  - **URL e chave de serviço:** saem do Keychain do organizador com `security find-generic-password -s organizador-supabase -a url -w | gh secret set SUPABASE_URL` e o mesmo comando com `service_key` para `SUPABASE_SERVICE_KEY`.
  - **`TELEGRAM_CHAT_ID`:**
    1. Pedir ao Igor para mandar uma mensagem qualquer no chat novo.
    2. Ler o id com `getUpdates` usando o token do Keychain e mostrar ao Igor só o **nome** do chat, para ele confirmar. O id não é segredo.
    3. Gravar o id com `gh secret set TELEGRAM_CHAT_ID`.
- [ ] **Step 5: Teste do aviso.** Rodar `gh workflow run avisos.yml -f rodada=teste` e acompanhar com `gh run watch`. Esperado: job verde, e o Igor confirma que a mensagem `✅ Teste do organizador…` chegou no chat novo.
- [ ] **Step 6: Escrever "iPhone" em `docs/configuracao.md`** e mandar o passo a passo ao Igor:
  1. Abrir `https://igorpiaba.github.io/organizador/` **no Safari**.
  2. Botão Compartilhar (quadrado com seta) → "Adicionar à Tela de Início" → Adicionar.
  3. Abrir pelo ícone novo, digitar o e-mail e tocar em "Entrar com link".
  4. Abrir o e-mail **no próprio iPhone** e tocar no link.

  Esperado: o Igor confirma que vê a tela Hoje no iPhone, e no Mac pelo endereço do Pages.
- [ ] **Step 7:** Commit e push: `"publicação: Pages e guia"`.

---

### Task 11: Skill de banners atualiza o organizador

**Files:**
- Modify: `~/.claude/skills/banners-home-sportsbook/SKILL.md`. O arquivo fica fora do repositório. Ler o arquivo inteiro antes de editar.
- Modify: a memória `organizador-diario.md` (em `~/.claude/projects/.../memory/`)

**Interfaces:**
- Consumes: `cli/tarefas.py` (Task 7).

- [ ] **Step 1:** Acrescentar à skill uma seção final, **"Atualizar o organizador"**, com as regras:
  - **imagens:** depois de gerar e conferir as imagens, rodar `python3 ~/projetos/organizador/cli/tarefas.py cobertura banners-imagens --ate {último dia com imagem conferida}`;
  - **agendamentos:** depois de `executar` sem erro numa marca, rodar `... cobertura banners-palpite --ate {último dia com banner agendado}` (ou `banners-pixgol`). A data é o último dia em que a `agenda` da marca tem banner, não o último jogo da planilha;
  - **falhas:** se o comando sair com código ≠ 0, não interromper a skill e avisar no fim: `não consegui atualizar o organizador, marque manualmente`;
  - **"nada alterado":** quando o CLI responde isso, é porque a cobertura atual já é maior. Está certo, não precisa forçar.
- [ ] **Step 2:** Verificar rodando `python3 ~/projetos/organizador/cli/tarefas.py ver banners-palpite`. Esperado: mostra a cobertura atual, com código 0.
- [ ] **Step 3:** Atualizar a memória `organizador-diario.md` com os links do app e do repositório e com o fato de que a skill de banners já atualiza as coberturas.
- [ ] **Step 4:** Commit no repositório (só se algo mudou nele). A skill fica fora do git.
