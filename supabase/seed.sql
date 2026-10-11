-- Categorias e tarefas iniciais. Rodar depois de aceitar o convite (precisa do usuário criado).
-- Pode rodar de novo sem duplicar.

with u as (select id from auth.users order by created_at limit 1)
insert into categorias (user_id, nome, cor)
select u.id, c.nome, c.cor from u, (values
  ('Palpite', '#16a34a'), ('PIXGOL', '#7c3aed'), ('Pessoal', '#0ea5e9')
) as c(nome, cor)
where not exists (select 1 from categorias x where x.user_id = u.id and x.nome = c.nome);

with u as (select id from auth.users order by created_at limit 1),
     cat as (select c.nome, c.id from categorias c, u where c.user_id = u.id)
insert into tarefas (user_id, nome, tipo, categoria_id, prioridade, codigo, coberto_ate, avisar_dias_antes, repeticao, horario_sugerido)
select u.id, t.nome, t.tipo, (select id from cat where cat.nome = t.categoria), t.prioridade, t.codigo,
       t.coberto_ate::date, 1, t.repeticao::jsonb, t.horario
from u, (values
  ('Banners: imagens prontas',      'cobertura', 'Palpite', 'alta', 'banners-imagens',   '2026-10-22', null, null),
  ('Banners agendados: Palpite',    'cobertura', 'Palpite', 'alta', 'banners-palpite',   '2026-10-19', null, null),
  ('Banners agendados: PIXGOL',     'cobertura', 'PIXGOL',  'alta', 'banners-pixgol',    '2026-10-19', null, null),
  ('Fechar dia dashboard: Palpite', 'rotina',    'Palpite', 'alta', 'dashboard-palpite', null, '{"tipo":"diario"}', '08:00'),
  ('Fechar dia dashboard: PIXGOL',  'rotina',    'PIXGOL',  'alta', 'dashboard-pixgol',  null, '{"tipo":"diario"}', '08:00')
) as t(nome, tipo, categoria, prioridade, codigo, coberto_ate, repeticao, horario)
on conflict (user_id, codigo) do nothing;

update tarefas t set limitada_por = img.id
from tarefas img
where img.codigo = 'banners-imagens' and img.user_id = t.user_id
  and t.codigo in ('banners-palpite', 'banners-pixgol') and t.limitada_por is null;
