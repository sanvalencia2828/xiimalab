-- Snapshots de convocatorias abiertas (hackatones y bounties).
--
-- Un job (scripts/snapshot.ts, GitHub Actions cada 6 h) hace upsert por id con la
-- service role key. La app solo lee, con la anon key, para las notificaciones
-- de cierre; por eso RLS deja SELECT a todos y ninguna escritura.
--
-- first_seen_at se fija al insertar y no se vuelve a tocar; last_seen_at se
-- actualiza en cada ejecución en la que la convocatoria sigue abierta.

create table if not exists public.hackathon_snapshots (
    id              text primary key,
    source          text not null,
    title           text not null,
    deadline        date,
    -- Premio en USD comparable: null si está en otra moneda o no está verificado
    prize_usd       numeric,
    -- Importe tal como lo declara la fuente, en prize_currency
    prize_amount    numeric,
    prize_currency  text,
    tags            text[] not null default '{}',
    url             text,
    first_seen_at   timestamptz not null default now(),
    last_seen_at    timestamptz not null default now()
);

create table if not exists public.bounty_snapshots (
    id              text primary key,
    source          text not null,
    title           text not null,
    deadline        timestamptz,
    -- Recompensa en USD: solo si se paga en una stablecoin (USDC, USDG, USDT)
    prize_usd       numeric,
    prize_amount    numeric,
    prize_currency  text,
    tags            text[] not null default '{}',
    url             text,
    first_seen_at   timestamptz not null default now(),
    last_seen_at    timestamptz not null default now()
);

create index if not exists hackathon_snapshots_deadline_idx on public.hackathon_snapshots (deadline);
create index if not exists hackathon_snapshots_last_seen_idx on public.hackathon_snapshots (last_seen_at desc);
create index if not exists bounty_snapshots_deadline_idx on public.bounty_snapshots (deadline);
create index if not exists bounty_snapshots_last_seen_idx on public.bounty_snapshots (last_seen_at desc);

alter table public.hackathon_snapshots enable row level security;
alter table public.bounty_snapshots enable row level security;

drop policy if exists "hackathon_snapshots_read" on public.hackathon_snapshots;
create policy "hackathon_snapshots_read" on public.hackathon_snapshots
    for select to anon, authenticated using (true);

drop policy if exists "bounty_snapshots_read" on public.bounty_snapshots;
create policy "bounty_snapshots_read" on public.bounty_snapshots
    for select to anon, authenticated using (true);
