-- Organizador: tabelas, regras de acesso (RLS) e permissões.
-- Rodar uma vez no SQL Editor do Supabase.

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  cor text not null
);

create table if not exists tarefas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('cobertura', 'rotina', 'avulsa')),
  categoria_id uuid references categorias on delete set null,
  prioridade text not null default 'media' check (prioridade in ('alta', 'media', 'baixa')),
  observacao text,
  ativa boolean not null default true,
  codigo text,
  coberto_ate date,
  avisar_dias_antes int not null default 1 check (avisar_dias_antes >= 0),
  limitada_por uuid references tarefas on delete set null,
  repeticao jsonb,
  horario_sugerido text,
  prazo date,
  lembrete text,
  concluida_em timestamptz,
  criada_em timestamptz not null default now(),
  unique (user_id, codigo)
);

create table if not exists conclusoes (
  tarefa_id uuid references tarefas on delete cascade,
  dia date,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  feita_em timestamptz not null default now(),
  primary key (tarefa_id, dia)
);

create table if not exists historico_cobertura (
  id bigint generated always as identity primary key,
  tarefa_id uuid references tarefas on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  de date,
  para date not null,
  origem text not null check (origem in ('app', 'automatico')),
  em timestamptz not null default now()
);

create table if not exists heartbeat (
  id bigint generated always as identity primary key,
  rodada text,
  em timestamptz not null default now()
);

alter table categorias enable row level security;
alter table tarefas enable row level security;
alter table conclusoes enable row level security;
alter table historico_cobertura enable row level security;
alter table heartbeat enable row level security;  -- sem policy: só a chave de serviço acessa

create policy "dono" on categorias for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dono" on tarefas for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dono" on conclusoes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dono" on historico_cobertura for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
