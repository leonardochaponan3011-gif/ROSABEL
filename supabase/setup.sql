-- Rosabel: catálogo público y panel privado de Rosa Bertha Llontop Lluen.
-- Kamay: espacios individuales y catálogos independientes para otras artesanas.
-- Ejecuta este archivo en Supabase > SQL Editor después de crear el proyecto.

create schema if not exists private;

create table if not exists private.rosabel_owner_emails (
  email text primary key check (char_length(email) between 5 and 254)
);
revoke all on table private.rosabel_owner_emails from anon, authenticated;
alter table private.rosabel_owner_emails enable row level security;
drop policy if exists "Rosabel owner can read own allowlist entry" on private.rosabel_owner_emails;
create policy "Rosabel owner can read own allowlist entry"
on private.rosabel_owner_emails
for select
to public
using (lower(email) = lower((select auth.jwt() ->> 'email')));

create or replace function private.is_rosabel_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.rosabel_owner_emails
    where lower(email) = lower((select auth.jwt() ->> 'email'))
  );
$$;
revoke all on function private.is_rosabel_owner() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_rosabel_owner() to anon, authenticated;

create or replace function public.is_rosabel_owner_current()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_rosabel_owner();
$$;
revoke all on function public.is_rosabel_owner_current() from public, anon, authenticated;
grant execute on function public.is_rosabel_owner_current() to authenticated;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 2 and 100),
  price numeric(10, 2) not null check (price > 0),
  hours numeric(6, 2) not null default 1 check (hours > 0),
  artisan text not null default 'Rosa Bertha Llontop Lluen',
  origin text not null default 'Monsefú, Lambayeque',
  technique text not null check (char_length(technique) between 2 and 100),
  category text not null check (char_length(category) between 2 and 60),
  description text not null check (char_length(description) between 10 and 1200),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

drop policy if exists "Anyone can view published Rosabel products" on public.products;
create policy "Anyone can view published Rosabel products"
on public.products for select to anon, authenticated
using (
  published = true
  or (
    private.is_rosabel_owner()
    and owner_id = (select auth.uid())
  )
);

drop policy if exists "Only Rosa can publish Rosabel products" on public.products;
create policy "Only Rosa can publish Rosabel products"
on public.products for insert to authenticated
with check (
  private.is_rosabel_owner()
  and owner_id = (select auth.uid())
  and artisan = 'Rosa Bertha Llontop Lluen'
);

drop policy if exists "Only Rosa can edit Rosabel products" on public.products;
create policy "Only Rosa can edit Rosabel products"
on public.products for update to authenticated
using (
  private.is_rosabel_owner()
  and owner_id = (select auth.uid())
)
with check (
  private.is_rosabel_owner()
  and owner_id = (select auth.uid())
  and artisan = 'Rosa Bertha Llontop Lluen'
);

drop policy if exists "Only Rosa can remove Rosabel products" on public.products;
create policy "Only Rosa can remove Rosabel products"
on public.products for delete to authenticated
using (
  private.is_rosabel_owner()
  and owner_id = (select auth.uid())
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Only Rosa can upload Rosabel media" on storage.objects;
create policy "Only Rosa can upload Rosabel media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-media'
  and private.is_rosabel_owner()
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Only Rosa can update Rosabel media" on storage.objects;
create policy "Only Rosa can update Rosabel media"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-media'
  and private.is_rosabel_owner()
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'product-media'
  and private.is_rosabel_owner()
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Only Rosa can delete Rosabel media" on storage.objects;
create policy "Only Rosa can delete Rosabel media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-media'
  and private.is_rosabel_owner()
  and owner_id = (select auth.uid())::text
);

-- Añade el correo permitido antes de permitir que Rosa inicie sesión por enlace
-- de correo. Reemplaza ROSA_EMAIL_AQUI por el correo exacto de Rosa:
--
-- insert into private.rosabel_owner_emails (email)
-- values (lower('ROSA_EMAIL_AQUI'))
-- on conflict do nothing;

-- Directorio general: cada cuenta autenticada puede administrar solamente su propio perfil y catálogo.
create table if not exists public.artisan_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  slug text not null unique
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and slug not in ('rosabel', 'artesanas', 'espacio-artesana', 'espacio-admin')),
  shop_name text not null check (char_length(shop_name) between 2 and 100),
  artisan_name text not null check (char_length(artisan_name) between 2 and 100),
  story text not null check (char_length(story) between 20 and 1600),
  location text not null check (char_length(location) between 2 and 120),
  whatsapp text not null check (whatsapp ~ '^[0-9]{8,15}$'),
  photo_url text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artisan_products (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid not null references public.artisan_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  price numeric(10, 2) not null check (price > 0),
  hours numeric(6, 2) not null default 1 check (hours > 0),
  technique text not null check (char_length(technique) between 2 and 100),
  category text not null check (char_length(category) between 2 and 60),
  description text not null check (char_length(description) between 10 and 1200),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artisan_profiles_public_created_idx
  on public.artisan_profiles (published, created_at desc);
create index if not exists artisan_products_owner_created_idx
  on public.artisan_products (artisan_id, created_at desc);

alter table public.artisan_profiles enable row level security;
alter table public.artisan_products enable row level security;
grant select on public.artisan_profiles, public.artisan_products to anon, authenticated;
grant insert, update, delete on public.artisan_profiles, public.artisan_products to authenticated;

drop policy if exists "Public see artisan spaces and owners see own profile" on public.artisan_profiles;
create policy "Public see artisan spaces and owners see own profile"
on public.artisan_profiles for select to anon, authenticated
using (published = true or id = (select auth.uid()));

drop policy if exists "Artisans create own profile" on public.artisan_profiles;
create policy "Artisans create own profile"
on public.artisan_profiles for insert to authenticated
with check (id = (select auth.uid()));

drop policy if exists "Artisans update own profile" on public.artisan_profiles;
create policy "Artisans update own profile"
on public.artisan_profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "Artisans delete own profile" on public.artisan_profiles;
create policy "Artisans delete own profile"
on public.artisan_profiles for delete to authenticated
using (id = (select auth.uid()));

drop policy if exists "Public see products in published artisan spaces and owners see own" on public.artisan_products;
create policy "Public see products in published artisan spaces and owners see own"
on public.artisan_products for select to anon, authenticated
using (
  artisan_id = (select auth.uid())
  or (
    published = true
    and exists (
      select 1 from public.artisan_profiles p
      where p.id = artisan_products.artisan_id and p.published = true
    )
  )
);

drop policy if exists "Artisans create own products" on public.artisan_products;
create policy "Artisans create own products"
on public.artisan_products for insert to authenticated
with check (artisan_id = (select auth.uid()));

drop policy if exists "Artisans update own products" on public.artisan_products;
create policy "Artisans update own products"
on public.artisan_products for update to authenticated
using (artisan_id = (select auth.uid()))
with check (artisan_id = (select auth.uid()));

drop policy if exists "Artisans delete own products" on public.artisan_products;
create policy "Artisans delete own products"
on public.artisan_products for delete to authenticated
using (artisan_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artisan-media',
  'artisan-media',
  true,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Artisans can list own media" on storage.objects;
create policy "Artisans can list own media"
on storage.objects for select to authenticated
using (bucket_id = 'artisan-media' and owner_id = (select auth.uid())::text);

drop policy if exists "Artisans upload media to own folder" on storage.objects;
create policy "Artisans upload media to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'artisan-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Artisans update own media" on storage.objects;
create policy "Artisans update own media"
on storage.objects for update to authenticated
using (bucket_id = 'artisan-media' and owner_id = (select auth.uid())::text)
with check (
  bucket_id = 'artisan-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Artisans delete own media" on storage.objects;
create policy "Artisans delete own media"
on storage.objects for delete to authenticated
using (bucket_id = 'artisan-media' and owner_id = (select auth.uid())::text);
