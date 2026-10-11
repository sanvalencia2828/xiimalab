"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
    Check, Copy, Download, FolderKanban, Github, Hexagon, Layers, Lightbulb, Linkedin, Loader2,
    Map as MapIcon, Pencil, Sparkles, Trophy, Twitter, Wallet, type LucideIcon,
} from "lucide-react";
import { getSkillInsightsAction } from "@/app/actions/skills";
import { IdeasSection } from "@/components/ideas/IdeasSection";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { useProfile } from "@/hooks/useProfile";
import { useSolanaAddress } from "@/hooks/useSolanaAddress";
import { IDEAS } from "@/lib/ideas/data";
import { isTrackActive, trackProgress } from "@/lib/learning/progress";
import { TRACKS } from "@/lib/learning/tracks";
import { initials, normalizeUrl, PROFILE_LINKS, type Profile, type ProfileLinkKey } from "@/lib/profile/data";
import { buildProfileMarkdown, type ExportSkill } from "@/lib/profile/markdown";
import { PROJECTS } from "@/lib/projects/data";
import { abbreviateAddress } from "@/lib/wallets/address";
import { useWallet } from "@/lib/WalletContext";

// Devpost, DoraHacks y Devfolio no tienen icono de marca en lucide: se usan iconos genéricos
const LINK_ICONS: Record<ProfileLinkKey, LucideIcon> = {
    github: Github,
    linkedin: Linkedin,
    x: Twitter,
    devpost: Trophy,
    dorahacks: Hexagon,
    devfolio: Layers,
};

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

const fieldClass =
    "w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50";

// ── Cabecera ────────────────────────────────────────────────────────────────
function Avatar({ profile }: { profile: Profile }) {
    const [broken, setBroken] = useState(false);
    useEffect(() => setBroken(false), [profile.avatarUrl]);
    const letters = initials(profile.name);

    return (
        <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-border flex items-center justify-center overflow-hidden shrink-0">
            {profile.avatarUrl && !broken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} />
            ) : (
                <span className="text-xl font-bold text-slate-200">{letters || "?"}</span>
            )}
        </div>
    );
}

function ProfileHeader({ profile, onEdit }: { profile: Profile; onEdit: () => void }) {
    const links = PROFILE_LINKS.filter(({ key }) => profile.links[key]);

    return (
        <section className="card-premium p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                    <Avatar profile={profile} />
                    <div className="min-w-0">
                        <h1 className={`text-2xl font-bold ${profile.name ? "text-white" : "text-slate-500"}`}>
                            {profile.name || "Añade tu nombre"}
                        </h1>
                        <p className={`text-sm mt-1 ${profile.bio ? "text-slate-300" : "text-slate-500"}`}>
                            {profile.bio || "Añade una bio corta: a qué te dedicas y qué estás construyendo."}
                        </p>
                    </div>
                </div>
                <button type="button" onClick={onEdit} className="btn-ghost shrink-0">
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
                {links.length === 0 ? (
                    <p className="text-xs text-slate-500">Añade tus enlaces (GitHub, LinkedIn, X, Devpost, DoraHacks, Devfolio).</p>
                ) : (
                    links.map(({ key, label }) => {
                        const Icon = LINK_ICONS[key];
                        return (
                            <a
                                key={key}
                                href={profile.links[key]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 rounded-md border border-slate-600/30 bg-slate-700/30 hover:border-accent/50 hover:text-accent transition-colors"
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {label}
                            </a>
                        );
                    })
                )}
            </div>
        </section>
    );
}

// ── Formulario ──────────────────────────────────────────────────────────────
function ProfileForm({ profile, onSave, onCancel }: { profile: Profile; onSave: (next: Profile) => void; onCancel: () => void }) {
    const [form, setForm] = useState<Profile>(profile);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const nextErrors: Record<string, string> = {};
        const url = (field: string, value: string) => {
            const normalized = normalizeUrl(value);
            if (value.trim() && !normalized) nextErrors[field] = "No es una URL válida";
            return normalized;
        };
        const links = Object.fromEntries(
            PROFILE_LINKS.map(({ key }) => [key, url(key, form.links[key])]),
        ) as Record<ProfileLinkKey, string>;
        const avatarUrl = url("avatarUrl", form.avatarUrl);

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;
        onSave({ name: form.name, bio: form.bio, avatarUrl, links });
    };

    const error = (field: string) => errors[field] && <p className="text-xs text-red-400 mt-1">{errors[field]}</p>;

    return (
        <form onSubmit={submit} className="card-premium p-5 space-y-4" noValidate>
            <h1 className="text-lg font-bold text-white">Editar perfil</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                    <span className="text-xs text-muted-text">Nombre</span>
                    <input
                        type="text"
                        value={form.name}
                        maxLength={80}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Añade tu nombre"
                        className={`${fieldClass} mt-1`}
                    />
                </label>
                <label className="block">
                    <span className="text-xs text-muted-text">Foto (URL, opcional)</span>
                    <input
                        type="url"
                        value={form.avatarUrl}
                        onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                        placeholder="https://… — sin foto se muestran tus iniciales"
                        className={`${fieldClass} mt-1`}
                    />
                    {error("avatarUrl")}
                </label>
            </div>

            <label className="block">
                <span className="text-xs text-muted-text">Bio</span>
                <textarea
                    value={form.bio}
                    maxLength={300}
                    rows={2}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="A qué te dedicas y qué estás construyendo"
                    className={`${fieldClass} mt-1 resize-none`}
                />
            </label>

            <div>
                <p className="section-label mb-2">Enlaces (opcionales)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PROFILE_LINKS.map(({ key, label, placeholder }) => (
                        <label key={key} className="block">
                            <span className="text-xs text-muted-text">{label}</span>
                            <input
                                type="url"
                                value={form.links[key]}
                                onChange={(e) => setForm({ ...form, links: { ...form.links, [key]: e.target.value } })}
                                placeholder={placeholder}
                                className={`${fieldClass} mt-1`}
                            />
                            {error(key)}
                        </label>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={onCancel} className="btn-ghost">Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
            </div>
        </form>
    );
}

// ── Wallets ─────────────────────────────────────────────────────────────────
function CopyButton({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* portapapeles no disponible */ }
    };
    return (
        <button type="button" onClick={copy} aria-label={label} title={label} className="p-1.5 rounded-md text-muted-text hover:text-accent hover:bg-white/5">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
}

function WalletRow({
    network, purpose, address,
}: { network: string; purpose: string; address: string | null }) {
    return (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
            <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200">{network}</p>
                <p className="text-xs text-muted-text">{purpose}</p>
            </div>
            {address ? (
                <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-mono text-slate-200" title={address}>{abbreviateAddress(address)}</span>
                    <CopyButton value={address} label={`Copiar dirección de ${network}`} />
                </div>
            ) : (
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-500">No conectada</span>
                    <Link href="/settings" className="btn-ghost">Conectar</Link>
                </div>
            )}
        </div>
    );
}

/** Estado de las wallets; se vinculan y desvinculan en Configuración. */
function WalletsSection() {
    const { publicKey, isLoaded } = useWallet();
    const solana = useSolanaAddress();

    return (
        <section className="card-premium p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-accent" />
                    Wallets
                </h2>
                <Link href="/settings" className="text-xs text-muted-text hover:text-accent">Gestionar en Configuración</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <WalletRow
                    network="Stellar"
                    purpose="Escrow educativo"
                    address={isLoaded ? publicKey : null}
                />
                <WalletRow
                    network="Solana"
                    purpose="Opcional, para bounties"
                    address={solana.address}
                />
            </div>
        </section>
    );
}

// ── Página ──────────────────────────────────────────────────────────────────
/** undefined = calculando · null = no se pudo calcular */
type DemonstratedSkills = ExportSkill[] | null | undefined;

export default function ProfilePage() {
    const { profile, loaded, save } = useProfile();
    const { state, loaded: progressLoaded } = useLearningProgress();
    const { publicKey } = useWallet();
    const { address: solanaAddress } = useSolanaAddress();
    const [editing, setEditing] = useState(false);
    const [skills, setSkills] = useState<DemonstratedSkills>(undefined);

    // Skills demostradas: las que usa algún proyecto, calculadas en el servidor (lib/skills/insights.ts)
    useEffect(() => {
        if (!progressLoaded) return;
        let cancelled = false;
        getSkillInsightsAction(state)
            .then((insights) => {
                if (cancelled) return;
                setSkills(insights.skills.filter((s) => s.projects.length > 0).map((s) => ({ label: s.label, projects: s.projects })));
            })
            .catch(() => { if (!cancelled) setSkills(null); });
        return () => { cancelled = true; };
    }, [progressLoaded, state]);

    if (!loaded) {
        return (
            <div className="min-h-screen flex items-center justify-center" role="status">
                <Loader2 className="w-10 h-10 text-accent animate-spin" />
            </div>
        );
    }

    const activeTracks = TRACKS.filter((track) => isTrackActive(track, state));
    const openIdeas = IDEAS.filter((idea) => idea.status !== "convertida" && idea.status !== "descartada");

    const summary: { label: string; value: string; description: string; href: string; icon: LucideIcon }[] = [
        { label: "Proyectos", value: String(PROJECTS.length), description: "En tu portafolio", href: "/projects", icon: FolderKanban },
        {
            label: "Skills demostradas",
            value: skills === undefined ? "…" : skills === null ? "—" : String(skills.length),
            description: skills === null ? "No se pudieron calcular" : "Con evidencia en tus proyectos",
            href: "/skills?tab=mercado",
            icon: Sparkles,
        },
        {
            label: "Tracks activos",
            value: progressLoaded ? String(activeTracks.length) : "…",
            description: progressLoaded && activeTracks.length === 0 ? "Elige uno en el roadmap" : "Elegidos o con hitos hechos",
            href: "/roadmap",
            icon: MapIcon,
        },
        { label: "Ideas en exploración", value: String(openIdeas.length), description: "Sin convertir ni descartar", href: "#ideas", icon: Lightbulb },
    ];

    const exportMarkdown = () => {
        const markdown = buildProfileMarkdown({
            profile,
            stellarAddress: publicKey,
            solanaAddress,
            projects: PROJECTS,
            skills: skills ?? null,
            tracks: activeTracks.map((track) => ({ title: track.title, ...trackProgress(track, state.done) })),
            date: new Date(),
        });
        const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "xiimalab-perfil.md";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen p-6 pt-20 md:pt-6">
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-6xl mx-auto space-y-6">
                <motion.div variants={itemVariants}>
                    {editing ? (
                        <ProfileForm
                            profile={profile}
                            onSave={(next) => { save(next); setEditing(false); }}
                            onCancel={() => setEditing(false)}
                        />
                    ) : (
                        <ProfileHeader profile={profile} onEdit={() => setEditing(true)} />
                    )}
                </motion.div>

                <motion.div variants={itemVariants}>
                    <WalletsSection />
                </motion.div>

                {/* Resumen */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {summary.map(({ label, value, description, href, icon: Icon }) => (
                        <motion.div key={label} variants={itemVariants}>
                            <Link href={href} className="card-premium p-5 block h-full hover:!border-accent/30">
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon className="w-4 h-4 text-accent" />
                                    <span className="text-xs text-muted-text font-medium">{label}</span>
                                </div>
                                <p className="text-2xl font-bold text-slate-200 font-mono">{value}</p>
                                <p className="text-xs text-muted-text mt-1">{description}</p>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                <motion.div variants={itemVariants}>
                    <IdeasSection />
                </motion.div>

                {/* Exportar */}
                <motion.div variants={itemVariants}>
                    <section className="card-premium p-5 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-white">Exportar</h2>
                            <p className="text-xs text-muted-text mt-1">
                                Nombre, bio, enlaces, proyectos con stack y demo, skills demostradas y tracks con su avance.
                            </p>
                        </div>
                        <button type="button" onClick={exportMarkdown} disabled={skills === undefined || !progressLoaded} className="btn-primary disabled:opacity-50">
                            <Download className="w-4 h-4" />
                            Exportar perfil (Markdown)
                        </button>
                    </section>
                </motion.div>
            </motion.div>
        </div>
    );
}
