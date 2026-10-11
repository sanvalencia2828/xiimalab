"use client";

import { useState, type FormEvent } from "react";
import { BadgeCheck, ExternalLink, Plus, Trash2 } from "lucide-react";
import { SKILLS, skillLabel } from "@/lib/learning/skills";
import { isValidDate, verificationUrl, type Certification } from "@/lib/profile/certifications";

const fieldClass =
    "w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50";

const EMPTY_FORM = { provider: "", name: "", date: "", url: "", skills: [] as string[] };

function formatDate(day: string): string {
    return new Date(`${day}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function CertificationForm({ onAdd, onCancel }: { onAdd: (certification: Certification) => void; onCancel: () => void }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const toggleSkill = (skill: string) =>
        setForm((prev) => ({
            ...prev,
            skills: prev.skills.includes(skill) ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill],
        }));

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const url = verificationUrl(form.url);
        const next: Record<string, string> = {};
        if (!form.provider.trim()) next.provider = "Indica quién la emite";
        if (!form.name.trim()) next.name = "Indica el nombre de la certificación";
        if (!isValidDate(form.date)) next.date = "Indica la fecha en que la obtuviste";
        else if (form.date > new Date().toISOString().slice(0, 10)) next.date = "La fecha no puede ser futura";
        if (!url) next.url = "La URL de verificación es obligatoria y debe empezar por https://";
        if (form.skills.length === 0) next.skills = "Elige al menos una skill que acredite";
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        onAdd({
            id: `${Date.now()}`,
            provider: form.provider.trim(),
            name: form.name.trim(),
            date: form.date,
            url,
            skills: form.skills,
        });
    };

    const error = (field: string) => errors[field] && <p className="text-xs text-red-400 mt-1" role="alert">{errors[field]}</p>;

    return (
        <form onSubmit={submit} className="p-4 rounded-lg border border-border space-y-4" noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                    <span className="text-xs text-muted-text">Proveedor</span>
                    <input type="text" value={form.provider} maxLength={120} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Quién la emite" className={`${fieldClass} mt-1`} />
                    {error("provider")}
                </label>
                <label className="block">
                    <span className="text-xs text-muted-text">Nombre</span>
                    <input type="text" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre de la certificación" className={`${fieldClass} mt-1`} />
                    {error("name")}
                </label>
                <label className="block">
                    <span className="text-xs text-muted-text">Fecha de obtención</span>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${fieldClass} mt-1`} />
                    {error("date")}
                </label>
                <label className="block">
                    <span className="text-xs text-muted-text">URL de verificación (obligatoria, https)</span>
                    <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" className={`${fieldClass} mt-1`} />
                    {error("url")}
                </label>
            </div>

            <fieldset>
                <legend className="text-xs text-muted-text mb-2">Skills que acredita</legend>
                <div className="flex flex-wrap gap-1.5">
                    {SKILLS.map((skill) => {
                        const selected = form.skills.includes(skill);
                        return (
                            <button
                                key={skill}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => toggleSkill(skill)}
                                className={`px-2 py-0.5 text-xs rounded-md border transition-colors ${
                                    selected ? "bg-accent/15 text-accent border-accent/40" : "text-slate-400 border-border hover:text-slate-200"
                                }`}
                            >
                                {skillLabel(skill)}
                            </button>
                        );
                    })}
                </div>
                {error("skills")}
            </fieldset>

            <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={onCancel} className="btn-ghost">Cancelar</button>
                <button type="submit" className="btn-primary">Guardar certificación</button>
            </div>
        </form>
    );
}

/** Certificaciones de Mi Perfil: la evidencia más fuerte de una skill. */
export function CertificationsSection({ certifications, onChange }: { certifications: Certification[]; onChange: (next: Certification[]) => void }) {
    const [adding, setAdding] = useState(false);

    return (
        <section className="card-premium p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5 text-accent" />
                    Certificaciones
                </h2>
                {!adding && (
                    <button type="button" onClick={() => setAdding(true)} className="btn-ghost">
                        <Plus className="w-3.5 h-3.5" />
                        Añadir certificación
                    </button>
                )}
            </div>
            <p className="text-xs text-muted-text mb-4">
                Una certificación verificable deja sus skills como "Certificada", por encima de "Demostrada".
            </p>

            {certifications.length === 0 && !adding && (
                <p className="text-sm text-muted-text">Todavía no has añadido ninguna certificación.</p>
            )}

            {certifications.length > 0 && (
                <ul className="space-y-2 mb-4">
                    {certifications.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 p-3 rounded-lg border border-border">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-200">{c.name}</p>
                                <p className="text-xs text-muted-text">{c.provider} · {formatDate(c.date)}</p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {c.skills.map((skill) => (
                                        <span key={skill} className="px-2 py-0.5 bg-sky-500/10 text-sky-300 text-xs rounded-md border border-sky-500/20">
                                            {skillLabel(skill)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <a href={c.url} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Verificar
                                </a>
                                <button
                                    type="button"
                                    onClick={() => onChange(certifications.filter((other) => other.id !== c.id))}
                                    aria-label={`Quitar ${c.name}`}
                                    className="p-2 rounded-md text-muted-text hover:text-red-400 hover:bg-red-500/10"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {adding && (
                <CertificationForm
                    onAdd={(certification) => { onChange([...certifications, certification]); setAdding(false); }}
                    onCancel={() => setAdding(false)}
                />
            )}
        </section>
    );
}
