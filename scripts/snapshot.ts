/**
 * scripts/snapshot.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Guarda en Supabase una foto de las convocatorias abiertas: hackatones del
 * agregador en vivo y bounties de Superteam. Upsert por id en
 * hackathon_snapshots y bounty_snapshots; first_seen_at se conserva y
 * last_seen_at se actualiza.
 *
 *   npm run snapshot              guarda en Supabase
 *   npm run snapshot -- --dry-run consulta las fuentes y cuenta, sin guardar
 *
 * Variables (GitHub Actions las recibe como secretos; en local, de .env):
 *   SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY — solo aquí y en el job; nunca en el cliente
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSuperteamBounties } from "@/lib/bounties/superteam";
import { getLiveHackathons } from "@/lib/hackathons/live";
import { bountyRow, hackathonRow, type SnapshotRow, uniqueById } from "@/lib/snapshot/rows";

const BATCH_SIZE = 500;
const dryRun = process.argv.includes("--dry-run");

function supabaseClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || url.includes("<") || !key) {
        throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_URL es el valor de ejemplo).");
    }
    return createClient(url, key, { auth: { persistSession: false } });
}

/** Upsert por lotes. Devuelve cuántas filas eran nuevas (first_seen_at de esta ejecución). */
async function save(client: SupabaseClient, table: string, rows: SnapshotRow[], startedAt: string): Promise<number> {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const { error } = await client.from(table).upsert(rows.slice(i, i + BATCH_SIZE), { onConflict: "id" });
        if (error) throw new Error(`${table}: ${error.message}`);
    }
    const { count, error } = await client
        .from(table)
        .select("id", { count: "exact", head: true })
        .gte("first_seen_at", startedAt);
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
}

async function main(): Promise<void> {
    const startedAt = new Date().toISOString();

    // force: sin la caché de Next, que no existe fuera del servidor
    const [live, superteam] = await Promise.all([getLiveHackathons({ force: true }), getSuperteamBounties({ force: true })]);
    const hackathons = uniqueById(live.hackathons.map((h) => hackathonRow(h, startedAt)));
    const bounties = uniqueById(superteam.bounties.map((b) => bountyRow(b, startedAt)));

    for (const [name, status] of Object.entries(live.sources)) {
        console.log(`  ${name}: ${status.ok ? `${status.count} abiertas` : `falló (${status.error})`}`);
    }
    console.log(`  superteam: ${superteam.sources.superteam.ok ? `${superteam.bounties.length} abiertos` : `falló (${superteam.sources.superteam.error})`}`);

    if (dryRun) {
        console.log(`[dry-run] Se guardarían ${hackathons.length} filas en hackathon_snapshots y ${bounties.length} en bounty_snapshots.`);
        return;
    }

    const client = supabaseClient();
    // Una fuente que no responde no borra nada: sus filas simplemente no se actualizan en esta ejecución
    if (hackathons.length > 0) {
        const added = await save(client, "hackathon_snapshots", hackathons, startedAt);
        console.log(`hackathon_snapshots: ${hackathons.length} filas guardadas (${added} nuevas).`);
    }
    if (bounties.length > 0) {
        const added = await save(client, "bounty_snapshots", bounties, startedAt);
        console.log(`bounty_snapshots: ${bounties.length} filas guardadas (${added} nuevas).`);
    }
    if (hackathons.length === 0 || bounties.length === 0) {
        throw new Error("Alguna fuente no devolvió convocatorias: revisa el detalle de arriba.");
    }
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
