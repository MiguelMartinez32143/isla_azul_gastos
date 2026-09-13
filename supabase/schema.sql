-- =============================================================
-- Gastos del Restaurante · Base de datos
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pega todo
-- este archivo → Run. Se puede ejecutar más de una vez sin problema.
-- =============================================================


-- ---------- Categorías ----------
create table if not exists public.categories (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 40),
  icon           text not null default '📦',
  color          text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  hint           text check (hint is null or char_length(hint) <= 80),
  monthly_budget numeric(14, 2) check (monthly_budget is null or monthly_budget >= 0),
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create unique index if not exists categories_user_name_key
  on public.categories (user_id, lower(name));


-- ---------- Proveedores ----------
create table if not exists public.suppliers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                text not null check (char_length(trim(name)) between 1 and 80),
  default_category_id uuid references public.categories (id) on delete set null,
  phone               text check (phone is null or char_length(phone) <= 30),
  notes               text check (notes is null or char_length(notes) <= 300),
  created_at          timestamptz not null default now()
);

create unique index if not exists suppliers_user_name_key
  on public.suppliers (user_id, lower(name));
create index if not exists suppliers_default_category_idx on public.suppliers (default_category_id);


-- ---------- Gastos ----------
create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  spent_on       date not null,
  amount         numeric(14, 2) not null check (amount > 0),
  category_id    uuid not null references public.categories (id) on delete restrict,
  supplier_id    uuid references public.suppliers (id) on delete set null,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'transfer', 'card')),
  description    text check (description is null or char_length(description) <= 200),
  receipt_path   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Quién hizo el gasto: 'petty_cash' = caja menor (cajero), 'manager' = jefe.
alter table public.expenses add column if not exists source text not null default 'petty_cash';
alter table public.expenses drop constraint if exists expenses_source_check;
alter table public.expenses add constraint expenses_source_check check (source in ('petty_cash', 'manager'));

create index if not exists expenses_user_date_idx on public.expenses (user_id, spent_on desc, created_at desc);
create index if not exists expenses_category_idx on public.expenses (category_id);
create index if not exists expenses_supplier_idx on public.expenses (supplier_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();


-- ---------- Gastos fijos (arriendo, servicios, nómina…) ----------
create table if not exists public.recurring_expenses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 60),
  amount         numeric(14, 2) check (amount is null or amount > 0),
  category_id    uuid not null references public.categories (id) on delete restrict,
  supplier_id    uuid references public.suppliers (id) on delete set null,
  payment_method text not null default 'transfer' check (payment_method in ('cash', 'transfer', 'card')),
  source         text not null default 'manager' check (source in ('petty_cash', 'manager')),
  due_day        smallint not null default 1 check (due_day between 1 and 31),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists recurring_expenses_user_idx on public.recurring_expenses (user_id);
create index if not exists recurring_expenses_category_idx on public.recurring_expenses (category_id);
create index if not exists recurring_expenses_supplier_idx on public.recurring_expenses (supplier_id);

-- Cada gasto puede venir de un gasto fijo; así se sabe cuáles ya se registraron en el mes.
alter table public.expenses add column if not exists recurring_id uuid;
alter table public.expenses drop constraint if exists expenses_recurring_id_fkey;
alter table public.expenses add constraint expenses_recurring_id_fkey
  foreign key (recurring_id) references public.recurring_expenses (id) on delete set null;
create index if not exists expenses_recurring_idx on public.expenses (recurring_id);


-- ---------- Seguridad: cada fila solo la ve y edita su dueño ----------
alter table public.categories         enable row level security;
alter table public.suppliers          enable row level security;
alter table public.expenses           enable row level security;
alter table public.recurring_expenses enable row level security;

drop policy if exists "Solo el dueño" on public.categories;
create policy "Solo el dueño" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Solo el dueño" on public.suppliers;
create policy "Solo el dueño" on public.suppliers
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Solo el dueño" on public.expenses;
create policy "Solo el dueño" on public.expenses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Solo el dueño" on public.recurring_expenses;
create policy "Solo el dueño" on public.recurring_expenses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.categories, public.suppliers, public.expenses, public.recurring_expenses from anon;
grant select, insert, update, delete
  on public.categories, public.suppliers, public.expenses, public.recurring_expenses
  to authenticated;


-- ---------- Fotos de facturas (Supabase Storage) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada usuario solo ve, sube y borra fotos dentro de su propia carpeta (su id).
drop policy if exists "Facturas: ver las propias" on storage.objects;
create policy "Facturas: ver las propias" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Facturas: subir a la carpeta propia" on storage.objects;
create policy "Facturas: subir a la carpeta propia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Facturas: borrar las propias" on storage.objects;
create policy "Facturas: borrar las propias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- ---------- Totales por categoría y origen en un rango de fechas [desde, hasta) ----------
drop function if exists public.category_totals(date, date);
create function public.category_totals(p_from date, p_to date)
returns table (category_id uuid, source text, total numeric, entries bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.category_id, e.source, sum(e.amount) as total, count(*) as entries
  from public.expenses e
  where e.spent_on >= p_from
    and e.spent_on < p_to
  group by e.category_id, e.source;
$$;

revoke execute on function public.category_totals(date, date) from public, anon;
grant execute on function public.category_totals(date, date) to authenticated;
