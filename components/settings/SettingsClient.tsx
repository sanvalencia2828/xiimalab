"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import {
    AlertCircle, Check, CheckCircle2, Copy, Database, Download, ExternalLink, Loader2, Lock, Plug, ShieldCheck,
    Trash2, Wallet, XCircle,
} from "lucide-react";
import { getStellarAccountAction } from "@/app/actions/settings";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { useProfile } from "@/hooks/useProfile";
import { useSolanaAddress } from "@/hooks/useSolanaAddress";
import { IDEAS } from "@/lib/ideas/data";
import type { IntegrationStatus } from "@/lib/settings/integrations";
import { abbreviateAddress, isSolanaAddress, stellarExpertUrl } from "@/lib/wallets/address";
import type { StellarAccount } from "@/lib/wallets/horizon";
import { useWallet } from "@/lib/WalletContext";

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

const fieldClass =
    "w-full px-3 py-2 bg-slate-800/50 border rounded-lg text-slate-200 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50";
const linkClass = "inline-flex items-center gap-1.5 text-xs text-accent hover:underline";
const dangerClass =
    "inline-flex items-center gap-1.5 h-8 px-3 text-[13px] rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors";

// Datos que la app guarda en este navegador
const LOCAL_KEYS = [
    "xiimalab_profile",
    "xiimalab_learning_progress",
    "xiimalab_milestone_evidence",
    "xiimalab_hackathon_action",
    "xiimalab_solana_address",
    "xiimalab_notifications_read",
    "xiimalab_stellar_wallet",
    "user_profile",
    "user_skills",
    "stellar_pubkey",
];

// ── Piezas compartidas ──────────────────────────────────────────────────────
function Section({ title, description, icon, badge, children }: { title: string; description: string; icon: ReactNode; badge?: ReactNode; children: ReactNode }) {
    return (
        <motion.section variants={itemVariants} className="card-premium p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                        {icon}
                        {title}
                    </h2>
                    <p className="text-xs text-muted-text mt-1">{description}</p>
                </div>
                {badge}
            </div>
            {children}
        </motion.section>
    );
}

function LinkedBadge() {
    return <span className="shrink-0 px-2 py-0.5 text-[11px] rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Vinculada</span>;
}

function ReadOnlyNote() {
    return (
        <p className="flex items-start gap-2 text-xs text-muted-text">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            Solo lectura: vincular una clave pública no da acceso a tus fondos.
        </p>
    );
}

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
        <button type="button" onClick={copy} className="btn-ghost" aria-label={label}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copiada" : "Copiar"}
        </button>
    );
}

/** Dirección vinculada: abreviada, con copiar, ver en el explorador y desvincular. */
function LinkedAddress({ address, network, explorerUrl, explorerLabel, onUnlink }: {
    address: string; network: string; explorerUrl: string; explorerLabel: string; onUnlink: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border mb-3">
            <span className="text-sm font-mono text-slate-200" title={address}>{abbreviateAddress(address)}</span>
            <div className="flex flex-wrap items-center gap-2">
                <CopyButton value={address} label={`Copiar dirección de ${network}`} />
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {explorerLabel}
                </a>
                <button type="button" onClick={onUnlink} className={dangerClass}>
                    <Trash2 className="w-3.5 h-3.5" />
                    Desvincular
                </button>
            </div>
        </div>
    );
}

function FieldError({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p className="flex items-start gap-1.5 text-xs text-red-400 mt-1.5" role="alert">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {message}
        </p>
    );
}

// ── Wallet Stellar ──────────────────────────────────────────────────────────
type StellarValidator = typeof import("@/lib/wallets/stellar");

function StellarWallet() {
    const { publicKey, isLoaded, connect, disconnect } = useWallet();
    const [input, setInput] = useState("");
    // El validador (StrKey del SDK de Stellar) se descarga al empezar a escribir, no con la página
    const [validator, setValidator] = useState<StellarValidator | null>(null);
    const [validatorFailed, setValidatorFailed] = useState(false);
    const key = input.trim();
    const valid = validator?.isStellarPublicKey(key) ?? false;
    const error = validatorFailed && key
        ? "No se pudo cargar el validador de claves. Recarga la página e inténtalo de nuevo."
        : validator?.stellarKeyError(key) ?? null;

    const loadValidator = () => {
        if (validator) return;
        import("@/lib/wallets/stellar")
            .then((module) => { setValidator(module); setValidatorFailed(false); })
            .catch(() => setValidatorFailed(true));
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!valid) return;
        connect(key);
        setInput("");
    };

    return (
        <Section
            title="Wallet Stellar"
            description="Tu clave pública de Stellar, para el escrow educativo."
            icon={<Wallet className="w-4 h-4 text-accent" />}
            badge={publicKey ? <LinkedBadge /> : undefined}
        >
            {!isLoaded ? null : publicKey ? (
                <LinkedAddress
                    address={publicKey}
                    network="Stellar"
                    explorerUrl={stellarExpertUrl(publicKey)}
                    explorerLabel="Ver en Stellar Expert (testnet)"
                    onUnlink={disconnect}
                />
            ) : (
                <form onSubmit={submit} className="mb-3" noValidate>
                    <label htmlFor="stellar-key" className="block text-xs text-muted-text mb-1">Clave pública (empieza por G, 56 caracteres)</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            id="stellar-key"
                            type="text"
                            value={input}
                            onFocus={loadValidator}
                            onChange={(e) => { setInput(e.target.value); loadValidator(); }}
                            placeholder="G…"
                            autoComplete="off"
                            spellCheck={false}
                            aria-invalid={Boolean(error)}
                            className={`${fieldClass} ${error ? "border-red-500/50" : "border-slate-700/50"}`}
                        />
                        <button type="submit" disabled={!valid} className="btn-primary shrink-0 justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                            Vincular
                        </button>
                    </div>
                    <FieldError message={error} />
                    <p className="text-xs text-muted-text mt-2">
                        ¿No tienes wallet?{" "}
                        <a href="https://www.freighter.app" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Freighter</a>
                        {" o "}
                        <a href="https://lobstr.co" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">LOBSTR</a>
                    </p>
                </form>
            )}
            <ReadOnlyNote />
        </Section>
    );
}

// ── Escrow educativo ────────────────────────────────────────────────────────
function Escrow() {
    const { publicKey, isLoaded } = useWallet();
    const [account, setAccount] = useState<StellarAccount | null>(null);

    useEffect(() => {
        setAccount(null);
        if (!publicKey) return;
        let cancelled = false;
        getStellarAccountAction(publicKey)
            .then((next) => { if (!cancelled) setAccount(next); })
            .catch(() => { if (!cancelled) setAccount({ status: "error" }); });
        return () => { cancelled = true; };
    }, [publicKey]);

    const description = "Un depósito en XLM que se bloquea al empezar un reto y se libera a tu wallet cuando lo completas.";
    const icon = <Lock className="w-4 h-4 text-accent" />;

    if (!isLoaded) return null;
    if (!publicKey) {
        return (
            <Section title="Escrow educativo" description={description} icon={icon}>
                <p className="text-sm text-slate-300">Vincula tu wallet para usar el escrow.</p>
            </Section>
        );
    }

    const claimable = account && (account.status === "ok" || account.status === "unfunded") ? account.claimable : [];

    return (
        <Section title="Escrow educativo" description={description} icon={icon}>
            {!account ? (
                <p className="flex items-center gap-2 text-xs text-muted-text" role="status">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Consultando Horizon testnet…
                </p>
            ) : account.status === "error" || account.status === "invalid" ? (
                <p className="text-xs text-muted-text">No se pudo consultar Horizon testnet ahora mismo.</p>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div className="p-3 rounded-lg border border-border">
                            <p className="text-xs text-muted-text mb-1">Saldo en testnet</p>
                            <p className="text-lg font-mono font-bold text-slate-200">
                                {account.status === "ok" ? `${Number(account.xlm).toLocaleString("es-ES", { maximumFractionDigits: 2 })} XLM` : "—"}
                            </p>
                            {account.status === "unfunded" && (
                                <p className="text-xs text-muted-text mt-1">La cuenta todavía no existe en testnet: no ha recibido fondos.</p>
                            )}
                        </div>
                        <div className="p-3 rounded-lg border border-border">
                            <p className="text-xs text-muted-text mb-1">Saldos reclamables</p>
                            <p className="text-lg font-mono font-bold text-slate-200">{claimable.length}</p>
                            <p className="text-xs text-muted-text mt-1">
                                {claimable.length === 0 ? "Ningún escrow a tu nombre ahora mismo." : "Fondos en escrow a tu nombre."}
                            </p>
                        </div>
                    </div>
                    {claimable.length > 0 && (
                        <ul className="space-y-2 mb-4">
                            {claimable.map((balance) => (
                                <li key={balance.id} className="flex items-center justify-between gap-3 text-xs p-2.5 rounded-lg border border-border">
                                    <span className="font-mono text-muted-text" title={balance.id}>{abbreviateAddress(balance.id)}</span>
                                    <span className="font-mono text-slate-200">
                                        {Number(balance.amount).toLocaleString("es-ES", { maximumFractionDigits: 2 })} {balance.asset}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="text-[11px] text-muted-text">Datos leídos de Horizon testnet para tu cuenta vinculada.</p>
                </>
            )}
        </Section>
    );
}

// ── Wallet Solana ───────────────────────────────────────────────────────────
function SolanaWallet() {
    const { address, loaded, link, unlink } = useSolanaAddress();
    const [input, setInput] = useState("");
    const value = input.trim();
    const valid = isSolanaAddress(value);
    const error = value && !valid ? "No es una dirección de Solana válida: debe estar en base58 y tener entre 32 y 44 caracteres." : null;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (link(value)) setInput("");
    };

    return (
        <Section
            title="Wallet Solana"
            description="Opcional: tu dirección pública de Solana, para los bounties de Superteam."
            icon={<Wallet className="w-4 h-4 text-accent" />}
            badge={address ? <LinkedBadge /> : undefined}
        >
            {!loaded ? null : address ? (
                <LinkedAddress
                    address={address}
                    network="Solana"
                    explorerUrl={`https://solscan.io/account/${address}`}
                    explorerLabel="Ver en Solscan"
                    onUnlink={unlink}
                />
            ) : (
                <form onSubmit={submit} className="mb-3" noValidate>
                    <label htmlFor="solana-address" className="block text-xs text-muted-text mb-1">Dirección pública (base58, 32–44 caracteres)</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            id="solana-address"
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Tu dirección de Solana"
                            autoComplete="off"
                            spellCheck={false}
                            aria-invalid={Boolean(error)}
                            className={`${fieldClass} ${error ? "border-red-500/50" : "border-slate-700/50"}`}
                        />
                        <button type="submit" disabled={!valid} className="btn-primary shrink-0 justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                            Vincular
                        </button>
                    </div>
                    <FieldError message={error} />
                </form>
            )}
            <ReadOnlyNote />
        </Section>
    );
}

// ── Integraciones ───────────────────────────────────────────────────────────
function Integrations({ integrations }: { integrations: IntegrationStatus[] }) {
    return (
        <Section
            title="Integraciones"
            description="Estado de los servicios configurados en el servidor. Las claves no se muestran ni salen de él."
            icon={<Plug className="w-4 h-4 text-accent" />}
        >
            <ul className="divide-y divide-border">
                {integrations.map((integration) => (
                    <li key={integration.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200">{integration.name}</p>
                            <p className="text-xs text-muted-text mt-0.5">{integration.purpose}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs ${integration.configured ? "text-emerald-400" : "text-slate-500"}`}>
                            {integration.configured ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {integration.configured ? "Configurada" : "No configurada"}
                        </span>
                    </li>
                ))}
            </ul>
        </Section>
    );
}

// ── Datos ───────────────────────────────────────────────────────────────────
function Data() {
    const { profile } = useProfile();
    const { state } = useLearningProgress();
    const { publicKey, disconnect } = useWallet();
    const { address: solanaAddress } = useSolanaAddress();
    const [confirming, setConfirming] = useState(false);

    const exportData = () => {
        const data = {
            exportedAt: new Date().toISOString(),
            profile,
            learningProgress: state,
            ideas: IDEAS,
            wallets: { stellar: publicKey, solana: solanaAddress },
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "xiimalab-datos.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    const clearData = () => {
        disconnect(); // también borra la cookie de la wallet
        for (const key of LOCAL_KEYS) {
            try {
                localStorage.removeItem(key);
            } catch { /* almacenamiento bloqueado */ }
        }
        window.location.reload();
    };

    return (
        <Section
            title="Datos"
            description="Tu perfil, el avance de los tracks, tus skills y las wallets vinculadas se guardan en este navegador."
            icon={<Database className="w-4 h-4 text-accent" />}
        >
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={exportData} className="btn-ghost">
                    <Download className="w-3.5 h-3.5" />
                    Exportar mis datos
                </button>
                {!confirming && (
                    <button type="button" onClick={() => setConfirming(true)} className={dangerClass}>
                        <Trash2 className="w-3.5 h-3.5" />
                        Borrar datos locales
                    </button>
                )}
            </div>
            <p className="text-xs text-muted-text mt-2">La exportación es un JSON con tu perfil, el avance de los tracks, las ideas y las wallets vinculadas.</p>

            {confirming && (
                <div className="mt-4 p-4 rounded-lg border border-red-500/30 bg-red-500/5" role="alertdialog" aria-label="Confirmar borrado de datos locales">
                    <p className="text-sm text-slate-200 mb-1">¿Borrar todos los datos de este navegador?</p>
                    <p className="text-xs text-muted-text mb-3">
                        Se eliminan tu perfil, el avance de los tracks, tus skills y las wallets vinculadas. No se puede deshacer: exporta antes si quieres conservarlos.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={clearData} className={dangerClass}>Sí, borrar todo</button>
                        <button type="button" onClick={() => setConfirming(false)} className="btn-ghost">Cancelar</button>
                    </div>
                </div>
            )}
        </Section>
    );
}

export default function SettingsClient({ integrations }: { integrations: IntegrationStatus[] }) {
    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
            <StellarWallet />
            <Escrow />
            <SolanaWallet />
            <Integrations integrations={integrations} />
            <Data />
        </motion.div>
    );
}
