create table if not exists public.agenda_eventos (
  id text primary key,
  titulo text not null,
  tipo text not null check (tipo in ('comunicado', 'reuniao', 'evento')),
  data date not null,
  hora text,
  setor text not null,
  descricao text not null,
  autor text not null default 'Não informado',
  criado_em timestamptz not null default now()
);

alter table public.agenda_eventos
add column if not exists autor text not null default 'Não informado';

create table if not exists public.agenda_notas (
  setor text primary key,
  conteudo text not null default '',
  atualizado_em timestamptz not null default now()
);

alter table public.agenda_eventos enable row level security;
alter table public.agenda_notas enable row level security;

grant select, insert, update, delete
on public.agenda_eventos, public.agenda_notas
to anon, authenticated;

drop policy if exists "Acesso publico aos eventos" on public.agenda_eventos;
create policy "Acesso publico aos eventos"
on public.agenda_eventos
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Acesso publico as notas" on public.agenda_notas;
create policy "Acesso publico as notas"
on public.agenda_notas
for all
to anon, authenticated
using (true)
with check (true);