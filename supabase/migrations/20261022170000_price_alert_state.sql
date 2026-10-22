-- Estado de las alertas de precio (app/api/cron/alertas-precio).
--
-- Las funciones de Vercel no guardan nada entre ejecuciones, así que aquí vive
-- el estado de cada moneda: dentro del rango, bajo el mínimo o sobre el máximo.
-- La ruta de API escribe con la service role key; la app solo lee, con la anon
-- key, para mostrar rangos y precios en Activos. Por eso RLS deja SELECT a todos
-- y ninguna escritura.
--
-- El rango automático (±10 % del primer precio leído) se guarda la primera vez
-- (range_source = 'auto') y no se recalcula. Un rango propio de RANGOS en
-- lib/alerts/config.ts lo sustituye (range_source = 'custom').

create table if not exists public.price_alert_state (
    -- ID de CoinMarketCap: los símbolos no son únicos
    asset_id         integer primary key,
    symbol           text not null,
    name             text not null,
    category         text not null check (category in ('AI', 'DEV CLOUD', 'BLOCKCHAIN')),
    state            text not null check (state in ('dentro', 'bajo_minimo', 'sobre_maximo')),
    last_price       numeric not null,
    range_min        numeric not null,
    range_max        numeric not null,
    range_source     text not null check (range_source in ('auto', 'custom')),
    last_alerted_at  timestamptz,
    updated_at       timestamptz not null default now()
);

alter table public.price_alert_state enable row level security;

drop policy if exists "price_alert_state_read" on public.price_alert_state;
create policy "price_alert_state_read" on public.price_alert_state
    for select to anon, authenticated using (true);
