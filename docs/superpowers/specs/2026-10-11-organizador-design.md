# Organizador diário — design

Data: 11/10/2026
Status: aguardando revisão do Igor

## Objetivo

Um app pessoal de tarefas para o dia a dia do Igor (time de sportsbook), usado no iPhone e no Mac. Ao abrir o dia, ele vê o que precisa fazer sem ter que lembrar de nada, e é avisado no Telegram antes de uma cobertura acabar (ex.: nunca ficar sem banner).

Critério de sucesso: nenhuma cobertura de banner acaba sem aviso prévio, e a lista "Hoje" mostra tudo o que pede ação naquele dia.

Fora do escopo: uso pelo time, compartilhamento, anexos, subtarefas e integração com calendário.

## Tipos de tarefa

Campos comuns a toda tarefa: nome, categoria (com cor), prioridade (alta, média ou baixa), observação, ativa (sim/não) e código opcional (texto único, ex.: `banners-palpite`), usado pela integração automática.

### Cobertura
- Campos: `coberto_ate` (data) e `avisar_dias_antes` (inteiro, padrão 1).
- **Acabando:** `coberto_ate - avisar_dias_antes <= hoje <= coberto_ate`.
- **Atrasada:** `hoje > coberto_ate`. Vai para o topo em vermelho e é avisada todo dia até ser atualizada.
- Campo opcional `limitada_por` (outra tarefa de cobertura). Quando `coberto_ate >= coberto_ate da limitante`, gera o alerta **"alcançou o limite"**. Exemplo: agendado alcançou as imagens prontas, então é hora de gerar as próximas imagens.
- Ao atualizar a cobertura, guarda o histórico (data anterior, nova data, quem atualizou: app ou automático).

### Rotina
- Regra de repetição: todo dia, dias úteis (seg–sex), dias da semana escolhidos, ou dia X do mês. Se o mês não tiver o dia X, vale o último dia do mês.
- Cada ocorrência é marcada como feita por dia (tabela de conclusões).
- Rotina não feita **não acumula**: no dia seguinte aparece só a ocorrência nova. Ontem não vira atrasada.

### Avulsa
- Campos: `prazo` (data) e `lembrete` (horário opcional, avisado na rodada de aviso seguinte a esse horário).
- Concluída uma vez, sai da lista. Com o prazo vencido, aparece como atrasada até ser concluída ou apagada.

### Categorias
Lista editável no app, com nome e cor. Categorias iniciais: Palpite, PIXGOL, Vaidebet, Betpix, BPX geral, Pessoal.

## Telas (GitHub Pages)

App de página única e instalável (PWA), com ícone e tela cheia quando adicionado à tela inicial do iPhone, e responsivo no Mac.

1. **Hoje**, nesta ordem:
   1. Atrasadas (coberturas e avulsas).
   2. Coberturas acabando ou que alcançaram o limite.
   3. Rotinas do dia.
   4. Avulsas que vencem hoje.

   Dentro de cada grupo, ordena por prioridade. Cada item tem uma ação rápida: "feito" (rotina e avulsa) ou "coberto até…" (cobertura, abre um seletor de data).
2. **Coberturas:** uma linha por cobertura, com "coberto até", dias restantes e uma barra colorida (verde, amarelo ou vermelho). Mostra o vínculo "limitada por" quando existir.
3. **Tarefas:** lista de todas, com filtro por categoria e tipo. Criar, editar, pausar e apagar.

Sem internet, o app mostra o último estado carregado com o selo "offline" e bloqueia as alterações.

## Arquitetura

| Peça | Onde roda | Função |
|---|---|---|
| App web | GitHub Pages (repo `organizador`) | Telas; lê e escreve no Supabase com a chave pública + login |
| Banco | Supabase (plano grátis) | Tabelas `categorias`, `tarefas`, `conclusoes`, `historico_cobertura`, `heartbeat` |
| Avisos | GitHub Actions (agendado) | Lê o estado, calcula o dia e manda para o Telegram |
| Integração | Mac (`tarefas.py`) | Comando que as skills chamam para marcar tarefas pelo código |

### Regras de vencimento: um módulo só
A lógica "o que vence hoje / acabando / atrasada / limite" fica num único módulo JavaScript, sem dependências, usado tanto pelo app quanto pelo script do Actions (Node). É a parte testada com casos fixos.

Todas as datas são calculadas no fuso `America/Sao_Paulo`.

### Login e segurança
- Login por link mágico do Supabase, só com o e-mail do Igor. O cadastro de novos usuários fica desligado.
- RLS (segurança por linha) em todas as tabelas: só o usuário dono lê e escreve. Por isso o repositório pode ser público, já que a chave pública sozinha não dá acesso.
- O Actions e o `tarefas.py` usam a chave de serviço do Supabase:
  - **no GitHub:** como segredo do repositório;
  - **no Mac:** no Keychain (serviço `organizador-supabase`).
- Nenhuma chave aparece em código, log ou chat.

### Avisos (Telegram)
- Bot: @DronhaBot (já existe). Destino: **chat novo e exclusivo do organizador**, separado do canal do monitor-bets.
- **8h (BRT):** resumo do dia com as contagens e a lista de atrasadas, coberturas acabando e o que alcançou o limite, além das rotinas e avulsas de hoje.
- **17h (BRT):** só o que continua pendente hoje. Se não houver nada pendente, não manda mensagem.
- Cron em UTC: `0 11 * * *` e `0 20 * * *` (o Brasil não tem horário de verão). O GitHub pode atrasar a execução em até cerca de 30 minutos, o que é aceitável.
- **Para não parar sozinho:**
  - toda rodada grava uma linha em `heartbeat`, o que mantém o Supabase ativo;
  - uma vez por mês o workflow faz um commit automático num arquivo de batimento, para o GitHub não desligar o agendamento por inatividade.
- **Falha:** cada envio é tentado até 3 vezes. Se ainda assim falhar, o job fica vermelho e o GitHub manda e-mail ao Igor. Os avisos só leem o estado, então atraso ou duplicidade não corrompem nada.

### Integração automática (`tarefas.py`)
- Uso:
  - `tarefas.py cobertura <codigo> --ate DD/MM`
  - `tarefas.py feito <codigo> [--dia DD/MM]`
  - `tarefas.py ver <codigo>`
- Fica em `~/projetos/organizador/cli/` e roda com Python, só com biblioteca padrão (chamada REST ao Supabase).
- Skills que passam a chamar o comando no fim:

  | Skill | Ação no organizador |
  |---|---|
  | banners-home-sportsbook | `banners-imagens` ao gerar e conferir as fotos; `banners-palpite` / `banners-pixgol` ao agendar |
  | fechar-dia-dashboard-bpx | `fechar-dia-bpx` |
  | tagueamento-diario-bpx | `tagueamento-bpx` |
  | acompanhamento-reativacao-bpx | `reativacao-bpx` |
  | criar-multiplas-widget-bpx | `multiplas-widget` |

- Se o comando falhar, a skill não para: ela termina o trabalho e avisa "não consegui atualizar o organizador, marque manualmente".

## Tarefas iniciais (seed)

| Nome | Tipo | Código | Regra |
|---|---|---|---|
| Banners: imagens prontas | cobertura | `banners-imagens` | avisa 1 dia antes; coberto até 22/10/2026 |
| Banners agendados: Palpite | cobertura | `banners-palpite` | avisa 1 dia antes; limitada por `banners-imagens`; coberto até 19/10/2026 |
| Banners agendados: PIXGOL | cobertura | `banners-pixgol` | avisa 1 dia antes; limitada por `banners-imagens`; coberto até 19/10/2026 |
| Tagueamento diário BPX | rotina | `tagueamento-bpx` | dias úteis |
| Fechar dia dashboard BPX | rotina | `fechar-dia-bpx` | todo dia |
| Acompanhamento reativação | rotina | `reativacao-bpx` | dias úteis |
| Múltiplas do widget | rotina | `multiplas-widget` | todo dia |

As datas e regras das rotinas são um ponto de partida. O Igor ajusta pelo app.

## Testes

- **Módulo de regras:** testes com data fixa (`node --test`) cobrindo:
  - dia útil e fim de semana;
  - dia 31 em mês de 30 dias;
  - virada de mês e de ano;
  - cobertura no limite exato (hoje = `coberto_ate`);
  - cobertura vencida;
  - antecedência de N dias;
  - "alcançou o limite";
  - rotina já concluída hoje;
  - avulsa vencida.
- **Montagem da mensagem do Telegram:** testada com estados fixos, incluindo o caso "nada pendente" às 17h, que não envia.
- **`tarefas.py`:** teste contra um Supabase de verdade numa tarefa de teste, apagada no fim.
- **Antes de ligar o agendamento:**
  - rodada manual do workflow, com uma mensagem de teste no chat novo;
  - login no app pelo iPhone e pelo Mac.

## Configuração única (o Igor faz, com passo a passo do Claude)

1. ✅ Conta no Supabase criada.
2. ✅ Chat novo no Telegram com o bot.
3. Repositório `organizador` no GitHub e segredos do repositório: URL e chave de serviço do Supabase, token do bot e id do chat. O token do bot sai direto do Keychain para o GitHub por comando, sem passar pelo chat.
4. Ligar o GitHub Pages.
5. No iPhone: abrir o link no Safari → Compartilhar → "Adicionar à Tela de Início" → fazer login pelo link mágico.
