-- ============================================================
-- KYLO AGRIC SOLUTION
-- SUPABASE DATABASE
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

do $$
begin
  create type public.user_role as enum ('customer', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.order_status as enum (
    'pending',
    'confirmed',
    'processing',
    'ready',
    'out_for_delivery',
    'completed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum (
    'pending',
    'paid',
    'failed',
    'cancelled',
    'refunded'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.enquiry_status as enum (
    'new',
    'contacted',
    'quoted',
    'closed'
  );
exception
  when duplicate_object then null;
end $$;


-- ============================================================
-- PROFILES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;


-- ============================================================
-- CATEGORIES
-- ============================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;


-- ============================================================
-- PRODUCTS
-- ============================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),

  category_id uuid references public.categories(id)
    on delete set null,

  name text not null,
  slug text not null unique,

  short_description text,
  description text,

  price numeric(12,2),
  unit text default 'each',

  stock_quantity numeric(12,2) default 0,

  image_url text,

  quote_only boolean not null default false,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_price_check
    check (price is null or price >= 0),

  constraint products_stock_check
    check (stock_quantity >= 0)
);

alter table public.products enable row level security;


-- ============================================================
-- ENQUIRIES
-- ============================================================

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references auth.users(id)
    on delete set null,

  name text not null,
  phone text not null,
  email text,

  product text,
  quantity text,
  location text,
  message text,

  status public.enquiry_status not null default 'new',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.enquiries enable row level security;


-- ============================================================
-- ORDERS
-- ============================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id)
    on delete restrict,

  customer_name text not null,
  customer_phone text not null,
  customer_email text,

  fulfilment_method text not null
    check (
      fulfilment_method in (
        'delivery',
        'collection'
      )
    ),

  delivery_address text,

  payment_method text not null,

  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,

  status public.order_status not null default 'pending',

  payment_status public.payment_status not null default 'pending',

  paynow_reference text,
  paynow_poll_url text,

  customer_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_amount_check
    check (
      subtotal >= 0
      and delivery_fee >= 0
      and total >= 0
    )
);

alter table public.orders enable row level security;


-- ============================================================
-- ORDER ITEMS
-- ============================================================

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null references public.orders(id)
    on delete cascade,

  product_id uuid not null references public.products(id)
    on delete restrict,

  product_name text not null,

  quantity numeric(12,2) not null,

  unit_price numeric(12,2) not null,

  line_total numeric(12,2) not null,

  created_at timestamptz not null default now(),

  constraint order_items_quantity_check
    check (quantity > 0),

  constraint order_items_price_check
    check (unit_price >= 0),

  constraint order_items_total_check
    check (line_total >= 0)
);

alter table public.order_items enable row level security;


-- ============================================================
-- KNOWLEDGE HUB
-- ============================================================

create table if not exists public.knowledge_posts (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  slug text not null unique,

  excerpt text,
  content text,

  image_url text,

  category text,
  author text,

  is_published boolean not null default false,

  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_posts enable row level security;


-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_products_category
on public.products(category_id);

create index if not exists idx_products_active
on public.products(is_active);

create index if not exists idx_orders_user
on public.orders(user_id);

create index if not exists idx_orders_status
on public.orders(status);

create index if not exists idx_order_items_order
on public.order_items(order_id);

create index if not exists idx_enquiries_status
on public.enquiries(status);

create index if not exists idx_knowledge_published
on public.knowledge_posts(is_published);


-- ============================================================
-- PROFILE CREATION TRIGGER
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  insert into public.profiles (
    id,
    full_name,
    phone,
    role
  )

  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      ''
    ),
    coalesce(
      new.raw_user_meta_data ->> 'phone',
      ''
    ),
    'customer'
  )

  on conflict (id) do nothing;

  return new;

end;
$$;


drop trigger if exists on_auth_user_created
on auth.users;


create trigger on_auth_user_created

after insert on auth.users

for each row

execute procedure public.handle_new_user();


-- ============================================================
-- ADMIN CHECK FUNCTION
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$

  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );

$$;


-- ============================================================
-- UPDATED_AT FUNCTION
-- ============================================================

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin

  new.updated_at = now();

  return new;

end;
$$;


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

drop trigger if exists profiles_updated_at
on public.profiles;

create trigger profiles_updated_at

before update on public.profiles

for each row

execute procedure public.update_updated_at();


drop trigger if exists products_updated_at
on public.products;

create trigger products_updated_at

before update on public.products

for each row

execute procedure public.update_updated_at();


drop trigger if exists orders_updated_at
on public.orders;

create trigger orders_updated_at

before update on public.orders

for each row

execute procedure public.update_updated_at();


drop trigger if exists enquiries_updated_at
on public.enquiries;

create trigger enquiries_updated_at

before update on public.enquiries

for each row

execute procedure public.update_updated_at();


drop trigger if exists knowledge_updated_at
on public.knowledge_posts;

create trigger knowledge_updated_at

before update on public.knowledge_posts

for each row

execute procedure public.update_updated_at();


-- ============================================================
-- PROFILE POLICIES
-- ============================================================

drop policy if exists
"Users can view own profile"
on public.profiles;

create policy
"Users can view own profile"

on public.profiles

for select

to authenticated

using (
  id = auth.uid()
  or public.is_admin()
);


-- IMPORTANT:
-- Customers cannot change their own role.

drop policy if exists
"Users can update own profile"
on public.profiles;

create policy
"Users can update own profile"

on public.profiles

for update

to authenticated

using (
  id = auth.uid()
)
with check (
  id = auth.uid()
  and role = (
    select role
    from public.profiles
    where id = auth.uid()
  )
);


drop policy if exists
"Admins manage profiles"
on public.profiles;

create policy
"Admins manage profiles"

on public.profiles

for all

to authenticated

using (
  public.is_admin()
)

with check (
  public.is_admin()
);


-- ============================================================
-- CATEGORY POLICIES
-- ============================================================

drop policy if exists
"Public can view active categories"
on public.categories;

create policy
"Public can view active categories"

on public.categories

for select

to anon, authenticated

using (
  is_active = true
);


drop policy if exists
"Admins manage categories"
on public.categories;

create policy
"Admins manage categories"

on public.categories

for all

to authenticated

using (
  public.is_admin()
)

with check (
  public.is_admin()
);


-- ============================================================
-- PRODUCT POLICIES
-- ============================================================

drop policy if exists
"Public can view active products"
on public.products;

create policy
"Public can view active products"

on public.products

for select

to anon, authenticated

using (
  is_active = true
);


drop policy if exists
"Admins manage products"
on public.products;

create policy
"Admins manage products"

on public.products

for all

to authenticated

using (
  public.is_admin()
)

with check (
  public.is_admin()
);


-- ============================================================
-- ENQUIRY POLICIES
-- ============================================================

drop policy if exists
"Anyone can submit enquiry"
on public.enquiries;

create policy
"Anyone can submit enquiry"

on public.enquiries

for insert

to anon, authenticated

with check (
  true
);


drop policy if exists
"Users can view own enquiries"
on public.enquiries;

create policy
"Users can view own enquiries"

on public.enquiries

for select

to authenticated

using (
  user_id = auth.uid()
  or public.is_admin()
);


drop policy if exists
"Admins manage enquiries"
on public.enquiries;

create policy
"Admins manage enquiries"

on public.enquiries

for all

to authenticated

using (
  public.is_admin()
)

with check (
  public.is_admin()
);


-- ============================================================
-- ORDER POLICIES
-- ============================================================

drop policy if exists
"Users can view own orders"
on public.orders;

create policy
"Users can view own orders"

on public.orders

for select

to authenticated

using (
  user_id = auth.uid()
  or public.is_admin()
);


drop policy if exists
"Users can create own orders"
on public.orders;

create policy
"Users can create own orders"

on public.orders

for insert

to authenticated

with check (
  user_id = auth.uid()
);


drop policy if exists
"Admins manage orders"
on public.orders;

create policy
"Admins manage orders"

on public.orders

for all

to authenticated

using (
  public.is_admin()
)

with check (
  public.is_admin()
);


-- ============================================================
-- ORDER ITEM POLICIES
-- ============================================================

drop policy if exists
"Users can view own order items"
on public.order_items;

create policy
"Users can view own order items"

on public.order_items

for select

to authenticated

using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.user_id = auth.uid()
        or public.is_admin()
      )
  )
);


drop policy if exists
"Users can create own order items"
on public.order_items;

create policy
"Users can create own order items"

on public.order_items

for insert

to authenticated

with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);


drop policy if exists
"Admins manage order items"
on public.order_items;

create policy
"Admins manage order items"

on public.order_items

for all

to authenticated

using (
  public.is_admin()
)

with check (
  public.is_admin()
);


-- ============================================================
-- KNOWLEDGE HUB POLICIES
-- ============================================================

drop policy if exists
"Public can view published knowledge"
on public.knowledge_posts;

create policy
"Public can view published knowledge"

on public.knowledge_posts

for select

to anon, authenticated

using (
  is_published = true
);


drop policy if exists
"Admins manage knowledge"
on public.knowledge_posts;

create policy
"Admins manage knowledge"

on public.knowledge_posts

for all

to authenticated

using (
  public.is_admin()
)

with check (
  public.is_admin()
);


-- ============================================================
-- CATEGORY SEED DATA
-- ============================================================

insert into public.categories
(name, slug, description)

values

(
  'Crops',
  'crops',
  'Major field crops suitable for Zimbabwean agriculture.'
),

(
  'Horticulture',
  'horticulture',
  'Vegetables and horticultural crops.'
),

(
  'Fruits',
  'fruits',
  'Fruit production and supply.'
),

(
  'Poultry',
  'poultry',
  'Poultry, chicks, eggs and related products.'
),

(
  'Livestock',
  'livestock',
  'Cattle, goats, pigs and sheep.'
),

(
  'Agricultural Technology',
  'technology',
  'Irrigation, automation and agricultural technology.'
),

(
  'Agricultural Inputs',
  'inputs',
  'Seeds, feed and other agricultural inputs.'
)

on conflict (slug) do nothing;


-- ============================================================
-- PRODUCT SEED DATA
-- ============================================================

insert into public.products
(
  category_id,
  name,
  slug,
  short_description,
  description,
  price,
  unit,
  quote_only,
  is_active
)

select
  c.id,
  p.name,
  p.slug,
  p.short_description,
  p.description,
  p.price,
  p.unit,
  p.quote_only,
  true

from (
  values

  (
    'crops',
    'Maize',
    'maize',
    'Quality maize production and supply.',
    'Maize suitable for food, livestock feed and agricultural production.',
    null::numeric,
    'kg',
    true
  ),

  (
    'crops',
    'Soybeans',
    'soybeans',
    'Soybean production and supply.',
    'Soybeans for food processing, animal feed and commercial farming.',
    null::numeric,
    'kg',
    true
  ),

  (
    'crops',
    'Wheat',
    'wheat',
    'Wheat production and supply.',
    'Commercial wheat production and supply.',
    null::numeric,
    'kg',
    true
  ),

  (
    'crops',
    'Sorghum',
    'sorghum',
    'Sorghum production and supply.',
    'Sorghum suitable for food, livestock feed and commercial farming.',
    null::numeric,
    'kg',
    true
  ),

  (
    'crops',
    'Groundnuts',
    'groundnuts',
    'Groundnut production and supply.',
    'Groundnuts suitable for food markets and commercial production.',
    null::numeric,
    'kg',
    true
  ),

  (
    'crops',
    'Beans',
    'beans',
    'Bean production and supply.',
    'Beans suitable for food markets and commercial agriculture.',
    null::numeric,
    'kg',
    true
  ),

  (
    'horticulture',
    'Tomatoes',
    'tomatoes',
    'Fresh tomatoes for households and markets.',
    'Fresh quality tomatoes produced for local markets and commercial buyers.',
    null::numeric,
    'kg',
    true
  ),

  (
    'horticulture',
    'Leafy Vegetables',
    'leafy-vegetables',
    'Fresh leafy vegetables.',
    'A range of leafy vegetables suitable for fresh produce markets.',
    null::numeric,
    'kg',
    true
  ),

  (
    'horticulture',
    'Onions',
    'onions',
    'Commercial onion production.',
    'Onions for household, retail and commercial markets.',
    null::numeric,
    'kg',
    true
  ),

  (
    'horticulture',
    'Cabbage',
    'cabbage',
    'Fresh cabbage production.',
    'Fresh cabbage supplied for local and commercial markets.',
    null::numeric,
    'kg',
    true
  ),

  (
    'horticulture',
    'Carrots',
    'carrots',
    'Fresh carrots.',
    'Quality carrots for fresh produce markets.',
    null::numeric,
    'kg',
    true
  ),

  (
    'horticulture',
    'Potatoes',
    'potatoes',
    'Potato production and supply.',
    'Potatoes for food markets and commercial buyers.',
    null::numeric,
    'kg',
    true
  ),

  (
    'fruits',
    'Bananas',
    'bananas',
    'Fresh banana production.',
    'Fresh bananas for retail and wholesale markets.',
    null::numeric,
    'kg',
    true
  ),

  (
    'fruits',
    'Avocados',
    'avocados',
    'Fresh avocado production.',
    'Avocados for local markets and commercial buyers.',
    null::numeric,
    'kg',
    true
  ),

  (
    'fruits',
    'Watermelons',
    'watermelons',
    'Fresh watermelon production.',
    'Watermelons for fresh produce markets.',
    null::numeric,
    'each',
    true
  ),

  (
    'fruits',
    'Citrus',
    'citrus',
    'Citrus fruit production.',
    'Citrus production and supply for local markets.',
    null::numeric,
    'kg',
    true
  ),

  (
    'poultry',
    'Broiler Chickens',
    'broiler-chickens',
    'Broiler chickens for meat production.',
    'Commercial broiler production and supply.',
    null::numeric,
    'each',
    true
  ),

  (
    'poultry',
    'Day-Old Chicks',
    'day-old-chicks',
    'Day-old chicks for poultry farmers.',
    'Day-old chicks for commercial poultry production.',
    null::numeric,
    'each',
    true
  ),

  (
    'poultry',
    'Layer Chickens',
    'layer-chickens',
    'Layer chickens for egg production.',
    'Commercial layers for egg production.',
    null::numeric,
    'each',
    true
  ),

  (
    'poultry',
    'Table Eggs',
    'table-eggs',
    'Fresh table eggs.',
    'Fresh eggs supplied to households, retailers and businesses.',
    null::numeric,
    'tray',
    true
  ),

  (
    'livestock',
    'Cattle',
    'cattle',
    'Cattle for agricultural production.',
    'Cattle for breeding, farming and commercial livestock operations.',
    null::numeric,
    'each',
    true
  ),

  (
    'livestock',
    'Pigs',
    'pigs',
    'Pigs for commercial farming.',
    'Pigs for breeding and pork production.',
    null::numeric,
    'each',
    true
  ),

  (
    'livestock',
    'Goats',
    'goats',
    'Goats for farming.',
    'Goats for breeding and commercial livestock production.',
    null::numeric,
    'each',
    true
  ),

  (
    'livestock',
    'Sheep',
    'sheep',
    'Sheep for agricultural production.',
    'Sheep for breeding and commercial farming.',
    null::numeric,
    'each',
    true
  ),

  (
    'technology',
    'Irrigation Systems',
    'irrigation-systems',
    'Agricultural irrigation solutions.',
    'Irrigation systems for farms, gardens and commercial agriculture.',
    null::numeric,
    'project',
    true
  ),

  (
    'technology',
    'Agricultural Automation',
    'agricultural-automation',
    'Automation solutions for agricultural operations.',
    'Automation, monitoring and control solutions for agricultural applications.',
    null::numeric,
    'project',
    true
  ),

  (
    'technology',
    'Solar Farm Power Solutions',
    'solar-farm-power-solutions',
    'Solar energy solutions for agriculture.',
    'Solar-powered solutions for agricultural equipment and farm operations.',
    null::numeric,
    'project',
    true
  ),

  (
    'inputs',
    'Poultry Feed',
    'poultry-feed',
    'Feed for poultry production.',
    'Poultry feed for different production stages.',
    null::numeric,
    'bag',
    true
  ),

  (
    'inputs',
    'Seeds',
    'seeds',
    'Agricultural seeds.',
    'Selected agricultural seeds for crop production.',
    null::numeric,
    'pack',
    true
  )

) as p(
  category_slug,
  name,
  slug,
  short_description,
  description,
  price,
  unit,
  quote_only
)

join public.categories c
on c.slug = p.category_slug

on conflict (slug) do nothing;


-- ============================================================
-- KNOWLEDGE HUB SEED CONTENT
-- ============================================================

insert into public.knowledge_posts
(
  title,
  slug,
  excerpt,
  content,
  category,
  author,
  is_published,
  published_at
)

values

(
  'Starting Poultry Farming in Zimbabwe',
  'starting-poultry-farming-zimbabwe',
  'Important considerations before starting a poultry project.',
  'Successful poultry production requires proper housing, quality feed, clean water, biosecurity, good record keeping and proper flock management.',
  'Poultry',
  'KYLO Agric Solution',
  true,
  now()
),

(
  'Basic Irrigation Principles',
  'basic-irrigation-principles',
  'Understanding irrigation for crop production.',
  'Efficient irrigation supplies crops with the water they require while reducing unnecessary water losses. Farmers should consider crop type, soil, weather and irrigation method.',
  'Irrigation',
  'KYLO Agric Solution',
  true,
  now()
),

(
  'Choosing the Right Agricultural Project',
  'choosing-agricultural-project',
  'Factors to consider when selecting an agricultural business.',
  'Consider market demand, available land, water, capital, labour, skills, production cycles and expected operating costs before starting an agricultural project.',
  'Agriculture',
  'KYLO Agric Solution',
  true,
  now()
)

on conflict (slug) do nothing;


-- ============================================================
-- GRANTS
-- ============================================================

revoke all
on table public.profiles
from anon;

grant select, update
on table public.profiles
to authenticated;


revoke all
on table public.categories
from anon, authenticated;

grant select
on table public.categories
to anon, authenticated;

grant insert, update, delete
on table public.categories
to authenticated;


revoke all
on table public.products
from anon, authenticated;

grant select
on table public.products
to anon, authenticated;

grant insert, update, delete
on table public.products
to authenticated;


revoke all
on table public.enquiries
from anon, authenticated;

grant insert
on table public.enquiries
to anon, authenticated;

grant select, update, delete
on table public.enquiries
to authenticated;


revoke all
on table public.orders
from anon, authenticated;

grant select, insert
on table public.orders
to authenticated;

grant update, delete
on table public.orders
to authenticated;


revoke all
on table public.order_items
from anon, authenticated;

grant select, insert
on table public.order_items
to authenticated;


revoke all
on table public.knowledge_posts
from anon, authenticated;

grant select
on table public.knowledge_posts
to anon, authenticated;

grant insert, update, delete
on table public.knowledge_posts
to authenticated;


-- ============================================================
-- COMPLETE
-- ============================================================