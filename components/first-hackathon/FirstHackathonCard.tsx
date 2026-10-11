"use client";

import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";
import { currentStep, type FirstHackathonState, PLAN_DAYS } from "@/lib/first-hackathon/plan";
import { describeClosing } from "@/lib/hackathons/format";

/** La tarjeta se muestra a quien no tiene ninguna hackatón marcada o tiene el plan a medias; desaparece al enviarla. */
export function showFirstHackathonCard(plan: FirstHackathonState, hasMarkedHackathon: boolean): boolean {
    if (plan.submittedAt) return false;
    return plan.hackathon !== null || !hasMarkedHackathon;
}

/** Tarjeta del dashboard hacia /first-hackathon. */
export function FirstHackathonCard({ plan }: { plan: FirstHackathonState }) {
    const step = currentStep(plan);

    return (
        <section className="card-premium p-5 border-accent/30 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
                <span className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
                    <Rocket className="w-4 h-4 text-accent" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-200">Modo primera hackatón</h2>
                    {plan.hackathon ? (
                        <p className="text-xs text-muted-text mt-0.5" suppressHydrationWarning>
                            {plan.hackathon.title} · {describeClosing(plan.hackathon.deadline).label}
                            {step ? ` · Siguiente paso: ${step.title}` : ""}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-text mt-0.5">
                            Aún no has marcado ninguna hackatón. Elige una para empezar y envíala en {PLAN_DAYS} días, un paso por día.
                        </p>
                    )}
                </div>
            </div>
            <Link href="/first-hackathon" className="btn-primary shrink-0">
                {plan.hackathon ? "Continuar el plan" : "Empezar"}
                <ArrowRight className="w-4 h-4" />
            </Link>
        </section>
    );
}
