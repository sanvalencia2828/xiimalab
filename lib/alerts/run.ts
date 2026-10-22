/**
 * lib/alerts/run.ts
 * Una pasada de alertas: precios -> estado -> avisos -> estado guardado.
 * El almacén y el envío se inyectan para poder probarlo sin red ni Supabase.
 *
 * Si un aviso falla, el estado de esa moneda no se guarda y se reintenta en la
 * siguiente ejecución. En dry-run no se envía nada ni se escribe nada.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RANGOS, WATCHED_ASSETS, type PriceRange, type WatchedAsset } from "./config";
import { evaluate, type AlertState, type PreviousState, type RangeSource } from "./evaluate";
import type { Quote } from "./cmc";

const TABLE = "price_alert_state";

export interface StoredState extends PreviousState {
    assetId: number;
    lastAlertedAt: string | null;
}

export interface StateRow {
    asset: WatchedAsset;
    state: AlertState;
    price: number;
    range: PriceRange;
    rangeSource: RangeSource;
    alertedAt: string | null;
}

export interface StateStore {
    load(): Promise<Map<number, StoredState>>;
    save(rows: StateRow[]): Promise<void>;
}

export interface RunDeps {
    quotes: Quote[];
    store: StateStore;
    send: (text: string) => Promise<unknown>;
    dryRun: boolean;
    now?: () => Date;
}

export interface AlertEvent {
    symbol: string;
    state: AlertState;
    price: number;
    range: PriceRange;
    sent: boolean;
}

export interface RunSummary {
    dryRun: boolean;
    checked: number;
    missing: string[];
    mismatched: string[];
    alerts: AlertEvent[];
    errors: string[];
}

const LABEL: Record<AlertState, string> = {
    dentro: "volvió al rango",
    bajo_minimo: "bajo el mínimo",
    sobre_maximo: "sobre el máximo",
};

function fmt(n: number): string {
    return n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toPrecision(4);
}

export function alertText(asset: WatchedAsset, state: AlertState, price: number, range: PriceRange): string {
    return `${asset.symbol} (${asset.category}) ${LABEL[state]}: $${fmt(price)}. Rango $${fmt(range.min)} – $${fmt(range.max)}.`;
}

export async function runAlerts({ quotes, store, send, dryRun, now = () => new Date() }: RunDeps): Promise<RunSummary> {
    const summary: RunSummary = { dryRun, checked: 0, missing: [], mismatched: [], alerts: [], errors: [] };
    const byId = new Map(quotes.map((q) => [q.id, q]));
    const previous = await store.load();
    const toSave: StateRow[] = [];

    for (const asset of WATCHED_ASSETS) {
        const quote = byId.get(asset.id);
        if (!quote) {
            summary.missing.push(asset.symbol);
            continue;
        }
        // Una moneda con otro símbolo (rebrand, ID mal puesto) no debe generar alertas
        if (quote.symbol !== asset.symbol) {
            summary.mismatched.push(`${asset.symbol}≠${quote.symbol}`);
            continue;
        }

        summary.checked++;
        const before = previous.get(asset.id) ?? null;
        const result = evaluate(quote.price, before, RANGOS[asset.symbol]);
        let alertedAt = before?.lastAlertedAt ?? null;

        if (result.notify) {
            const event: AlertEvent = { symbol: asset.symbol, state: result.state, price: quote.price, range: result.range, sent: false };
            if (!dryRun) {
                try {
                    await send(alertText(asset, result.state, quote.price, result.range));
                    event.sent = true;
                    alertedAt = now().toISOString();
                } catch (err) {
                    summary.errors.push(`${asset.symbol}: ${err instanceof Error ? err.message : "error al avisar"}`);
                    summary.alerts.push(event);
                    continue; // sin guardar: se reintenta en la siguiente ejecución
                }
            }
            summary.alerts.push(event);
        }

        toSave.push({ asset, state: result.state, price: quote.price, range: result.range, rangeSource: result.rangeSource, alertedAt });
    }

    if (!dryRun && toSave.length > 0) await store.save(toSave);
    return summary;
}

/** Cliente con la service role key, o null si faltan las variables. */
function serviceClient(): SupabaseClient | null {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || url.includes("<") || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

/** Almacén en Supabase, o null si no está configurado. */
export function supabaseStore(): StateStore | null {
    const client = serviceClient();
    if (!client) return null;
    return {
        async load() {
            const { data, error } = await client.from(TABLE).select("asset_id, state, range_min, range_max, range_source, last_alerted_at");
            if (error) throw new Error(`${TABLE}: ${error.message}`);
            const map = new Map<number, StoredState>();
            for (const r of data ?? []) {
                map.set(Number(r.asset_id), {
                    assetId: Number(r.asset_id),
                    state: r.state as AlertState,
                    range: { min: Number(r.range_min), max: Number(r.range_max) },
                    rangeSource: r.range_source as RangeSource,
                    lastAlertedAt: (r.last_alerted_at as string | null) ?? null,
                });
            }
            return map;
        },
        async save(rows) {
            const now = new Date().toISOString();
            const payload = rows.map((r) => ({
                asset_id: r.asset.id,
                symbol: r.asset.symbol,
                name: r.asset.name,
                category: r.asset.category,
                state: r.state,
                last_price: r.price,
                range_min: r.range.min,
                range_max: r.range.max,
                range_source: r.rangeSource,
                last_alerted_at: r.alertedAt,
                updated_at: now,
            }));
            const { error } = await client.from(TABLE).upsert(payload, { onConflict: "asset_id" });
            if (error) throw new Error(`${TABLE}: ${error.message}`);
        },
    };
}

/** Almacén vacío para dry-run sin Supabase: todo se evalúa como primera lectura. */
export const emptyStore: StateStore = {
    load: async () => new Map(),
    save: async () => undefined,
};
