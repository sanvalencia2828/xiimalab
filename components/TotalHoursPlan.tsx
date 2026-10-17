/**
 * components/TotalHoursPlan.tsx — SERVER COMPONENT
 * Tarjeta "Plan de horas según TOTAL": cada vela D/W/M de la capitalización
 * total cripto vale 3 h; si la última vela cerró en positivo → estudiar,
 * si cerró en negativo → crear un proyecto.
 */
import Link from "next/link";
import { BookOpen, ExternalLink, Hammer, Minus } from "lucide-react";
import { HOURS_PER_CANDLE, type Decision, type HoursPlan, type Timeframe } from "@/lib/markets/candles";

const TV_CHART = "https://es.tradingview.com/symbols/CRYPTOCAP-TOTAL/";

const FRAME: Record<Timeframe, { name: string; closed: string; period: string }> = {
    D: { name: "Diaria", closed: "Vela de ayer", period: "Hoy" },
    W: { name: "Semanal", closed: "Vela de la semana pasada", period: "Esta semana" },
    M: { name: "Mensual", closed: "Vela del mes pasado", period: "Este mes" },
};

const DECISION: Record<Decision, { label: string; cls: string; href: string | null; cta: string }> = {
    estudiar: { label: "Estudiar", cls: "bg-success/15 text-success border-success/30", href: "/roadmap", cta: "Ir al roadmap" },
    proyecto: { label: "Crear un proyecto", cls: "bg-accent/10 text-accent border-accent/25", href: "/projects", cta: "Ir a proyectos" },
    neutral: { label: "Sin decisión", cls: "bg-slate-700/30 text-slate-400 border-slate-600/30", href: null, cta: "" },
};

function Icon({ d }: { d: Decision }) {
    if (d === "estudiar") return <BookOpen className="w-3.5 h-3.5" />;
    if (d === "proyecto") return <Hammer className="w-3.5 h-3.5" />;
    return <Minus className="w-3.5 h-3.5" />;
}

function pct(v: number): JSX.Element {
    const cls = v > 0 ? "text-success" : v < 0 ? "text-danger" : "text-slate-400";
    return <span className={`font-mono ${cls}`}>{v > 0 ? "+" : ""}{v.toFixed(2)}%</span>;
}

function trillions(v: number): string {
    return `$${(v / 1e12).toFixed(2)} T`;
}

export function TotalHoursPlan({ plan }: { plan: HoursPlan | null }) {
    return (
        <div className="card-premium p-5">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                    <p className="text-xs uppercase tracking-widest text-muted-text mb-1">Plan de horas según TOTAL</p>
                    <p className="text-sm text-slate-300">
                        Cada vela vale {HOURS_PER_CANDLE} h: si cerró en positivo, a estudiar; si cerró en negativo, a crear un proyecto.
                    </p>
                </div>
                <a
                    href={TV_CHART}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                >
                    CRYPTOCAP:TOTAL{plan?.marketCap ? ` · ${trillions(plan.marketCap)}` : ""}
                    <ExternalLink className="w-3 h-3" />
                </a>
            </div>

            {!plan ? (
                <p className="text-sm text-muted-text">Sin datos de TradingView en este momento. Vuelve a intentarlo en unos minutos.</p>
            ) : (
                <>
                    <div className="flex flex-wrap gap-2 mb-4 text-xs">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-success/15 text-success border-success/30">
                            <BookOpen className="w-3.5 h-3.5" /> {plan.study} h para estudiar
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-accent/10 text-accent border-accent/25">
                            <Hammer className="w-3.5 h-3.5" /> {plan.project} h para proyectos
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {plan.items.map((item) => {
                            const f = FRAME[item.timeframe];
                            const d = DECISION[item.decision];
                            const p = DECISION[item.preview];
                            return (
                                <div key={item.timeframe} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                                    <div className="flex items-baseline justify-between mb-2">
                                        <span className="text-sm font-semibold text-white">
                                            {item.timeframe} · {f.name}
                                        </span>
                                        <span className="text-xs text-muted-text">{f.period}</span>
                                    </div>
                                    <p className="text-xs text-muted-text mb-1">
                                        {f.closed}: {item.closed ? pct(item.closed.changePct) : <span>sin datos</span>}
                                    </p>
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${d.cls}`}>
                                        <Icon d={item.decision} />
                                        {item.hours > 0 ? `${item.hours} h · ` : ""}{d.label}
                                    </span>
                                    {d.href && (
                                        <Link href={d.href} className="block mt-2 text-xs text-accent hover:underline">
                                            {d.cta} →
                                        </Link>
                                    )}
                                    {item.current && (
                                        <p className="mt-3 pt-3 border-t border-white/[0.06] text-xs text-muted-text">
                                            Vela en curso {pct(item.current.changePct)} → si cerrara ahora: {p.label.toLowerCase()}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
