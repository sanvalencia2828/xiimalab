/**
 * lib/projects/progress.ts — SERVER ONLY
 * ─────────────────────────────────────────────────────────────────────────────
 * Calcula el % de avance de un proyecto leyendo su repositorio de GitHub.
 *
 * Dos capas:
 *   1. Roadmap (si existe): ROADMAP.md / TODO.md / README con tareas
 *      "- [ ]" y "- [x]". Es la medida real del trabajo hecho.
 *   2. Preparación (siempre): señales objetivas de que el proyecto está
 *      "terminado y presentable" — README, instrucciones, demo en vivo,
 *      tests, CI, licencia, issues abiertos.
 *
 *   progreso = roadmap ? 70% roadmap + 30% preparación : 100% preparación
 *
 * Opcional: GITHUB_TOKEN en las variables de entorno sube el límite de la
 * API de GitHub de 60 a 5000 peticiones/hora.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ProgressCheck {
    id: string;
    label: string;      // lo que se evalúa
    todo: string;       // qué hacer si no se cumple
    weight: number;     // puntos sobre 100
    passed: boolean;
    partial?: number;   // 0..1 para criterios proporcionales
}

export interface RoadmapTask {
    text: string;
    done: boolean;
    file: string;
}

export interface ProjectProgress {
    repo: string;                      // "owner/name"
    percent: number;                   // 0..100
    complete: boolean;                 // percent >= COMPLETE_AT
    method: "roadmap" | "readiness";
    readiness: number;                 // 0..100
    roadmap: { done: number; total: number; file: string | null; pending: RoadmapTask[] };
    checks: ProgressCheck[];
    pending: string[];                 // lista unificada de "qué falta"
    last_push: string | null;
    days_since_push: number | null;
    error?: string;
    evaluated_at: string;
}

export const COMPLETE_AT = 90;
const REVALIDATE_S = 3600;
const TIMEOUT_MS = 8000;

// ── Datos crudos del repo (separados del cálculo para poder testearlo) ───────
export interface RepoSnapshot {
    repo: string;
    paths: string[];
    readme: string;
    roadmapFile: string | null;
    roadmapText: string;
    openIssues: number;
    hasLicense: boolean;
    pushedAt: string | null;
    liveUrl: string | null;
    liveOk: boolean | null;   // null = no hay URL que comprobar
}

const TEST_RE = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]+\.py$|_test\.(py|go)$/i;
const CI_RE = /^\.github\/workflows\/[^/]+\.ya?ml$|^\.gitlab-ci\.yml$|^\.circleci\//i;
const INSTALL_RE = /\b(npm (i|install|ci|run)|pnpm (i|install|dev)|yarn( install| dev)?|bun (install|dev|run)|pip install|poetry install|uv (sync|pip)|docker[- ]compose|uvicorn|python3? [\w/.-]+\.py|cargo (run|build)|go run)\b/i;
const TASK_RE = /^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/;

export function parseTasks(text: string, file: string): RoadmapTask[] {
    const out: RoadmapTask[] = [];
    for (const line of text.split(/\r?\n/)) {
        const m = line.match(TASK_RE);
        if (m) out.push({ done: m[1].toLowerCase() === "x", text: m[2].replace(/[*_`]/g, ""), file });
    }
    return out;
}

export function evaluate(s: RepoSnapshot): ProjectProgress {
    const readmeText = s.readme.replace(/<[^>]*>|!\[[^\]]*\]\([^)]*\)/g, "").trim();
    const hasTests = s.paths.some((p) => TEST_RE.test(p));
    const hasCI = s.paths.some((p) => CI_RE.test(p));

    const checks: ProgressCheck[] = [
        {
            id: "readme", weight: 15, passed: readmeText.length >= 500,
            label: "README con descripción del proyecto",
            todo: readmeText.length === 0 ? "Crear un README.md que explique qué hace el proyecto" : "Ampliar el README (qué hace, capturas, stack)",
        },
        {
            id: "install", weight: 10, passed: INSTALL_RE.test(s.readme),
            label: "Instrucciones para instalar y ejecutar",
            todo: "Añadir al README cómo instalarlo y correrlo (npm install / pip install / docker compose…)",
        },
        {
            id: "demo", weight: 25, passed: s.liveOk === true,
            label: "Demo en vivo publicada y respondiendo",
            todo: s.liveUrl ? `La demo (${s.liveUrl}) no responde: revisar el deploy` : "Publicar una demo (Vercel, GitHub Pages…) y añadir su URL",
        },
        {
            id: "tests", weight: 15, passed: hasTests,
            label: "Tests automatizados",
            todo: "Añadir tests (carpeta tests/ o archivos *.test.ts / test_*.py)",
        },
        {
            id: "ci", weight: 10, passed: hasCI,
            label: "Integración continua (GitHub Actions)",
            todo: "Crear un workflow en .github/workflows que corra build y tests",
        },
        {
            id: "license", weight: 5, passed: s.hasLicense,
            label: "Licencia",
            todo: "Añadir un archivo LICENSE (p. ej. MIT)",
        },
        {
            id: "issues", weight: 10, passed: s.openIssues === 0,
            label: "Sin issues abiertos",
            todo: `Cerrar o resolver ${s.openIssues} issue(s)/PR abiertos en GitHub`,
        },
    ];

    // Roadmap
    const tasks = s.roadmapFile ? parseTasks(s.roadmapText, s.roadmapFile) : [];
    const hasRoadmap = tasks.length >= 3;
    const done = tasks.filter((t) => t.done).length;
    checks.push({
        id: "roadmap", weight: 10, passed: hasRoadmap,
        label: "Roadmap con tareas (ROADMAP.md)",
        todo: "Crear ROADMAP.md con la lista de tareas en formato - [ ] / - [x]",
    });

    const readiness = Math.round(checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0));
    const roadmapPct = hasRoadmap ? (done / tasks.length) * 100 : 0;
    const percent = Math.round(hasRoadmap ? roadmapPct * 0.7 + readiness * 0.3 : readiness);

    const pendingTasks = hasRoadmap ? tasks.filter((t) => !t.done) : [];
    const pending = [
        ...pendingTasks.slice(0, 15).map((t) => t.text),
        ...checks.filter((c) => !c.passed).map((c) => c.todo),
    ];

    const days = s.pushedAt ? Math.floor((Date.now() - new Date(s.pushedAt).getTime()) / 86_400_000) : null;

    return {
        repo: s.repo,
        percent,
        complete: percent >= COMPLETE_AT && pendingTasks.length === 0,
        method: hasRoadmap ? "roadmap" : "readiness",
        readiness,
        roadmap: { done, total: hasRoadmap ? tasks.length : 0, file: hasRoadmap ? s.roadmapFile : null, pending: pendingTasks },
        checks,
        pending,
        last_push: s.pushedAt,
        days_since_push: days,
        evaluated_at: new Date().toISOString(),
    };
}

// ── Capa de red ─────────────────────────────────────────────────────────────
type Json = Record<string, unknown>;

function ghHeaders(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "xiimalab-progress" };
    const token = process.env.GITHUB_TOKEN;
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
}

async function gh(path: string): Promise<Json> {
    const res = await fetch(`https://api.github.com${path}`, {
        headers: ghHeaders(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: REVALIDATE_S },
    });
    if (res.status === 403 || res.status === 429) throw new Error("Límite de la API de GitHub alcanzado (configura GITHUB_TOKEN)");
    if (res.status === 404) throw new Error("Repositorio no encontrado o privado");
    if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
    return (await res.json()) as Json;
}

async function raw(repo: string, branch: string, path: string): Promise<string> {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${path}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: REVALIDATE_S },
    });
    return res.ok ? res.text() : "";
}

async function checkLive(url: string): Promise<boolean> {
    try {
        const res = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: AbortSignal.timeout(TIMEOUT_MS),
            next: { revalidate: REVALIDATE_S },
        });
        return res.status < 400;
    } catch {
        return false;
    }
}

export function repoFromUrl(url: string | undefined | null): string | null {
    const m = url?.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    return m ? `${m[1]}/${m[2].replace(/\.git$/, "")}` : null;
}

const ROADMAP_FILES = ["roadmap.md", "todo.md", "tasks.md", "docs/roadmap.md"];

export async function getRepoProgress(repo: string, liveUrl?: string | null): Promise<ProjectProgress> {
    try {
        const meta = await gh(`/repos/${repo}`);
        const branch = String(meta.default_branch ?? "main");
        const homepage = typeof meta.homepage === "string" && meta.homepage ? meta.homepage : null;
        const live = liveUrl || homepage;

        const [tree, liveOk] = await Promise.all([
            gh(`/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`),
            live ? checkLive(live) : Promise.resolve(null),
        ]);
        const paths = Array.isArray(tree.tree)
            ? (tree.tree as Json[]).filter((n) => n.type === "blob").map((n) => String(n.path))
            : [];
        const lower = new Map(paths.map((p) => [p.toLowerCase(), p]));

        const readmePath = paths.find((p) => /^readme(\.md|\.markdown|\.txt)?$/i.test(p));
        const roadmapPath = ROADMAP_FILES.map((f) => lower.get(f)).find(Boolean) ?? null;
        const [readme, roadmapText] = await Promise.all([
            readmePath ? raw(repo, branch, readmePath) : Promise.resolve(""),
            roadmapPath ? raw(repo, branch, roadmapPath) : Promise.resolve(""),
        ]);

        // Si no hay ROADMAP.md, se usan las tareas del README (si tiene ≥3)
        const useReadme = !roadmapPath && parseTasks(readme, readmePath ?? "README.md").length >= 3;

        return evaluate({
            repo,
            paths,
            readme,
            roadmapFile: roadmapPath ?? (useReadme ? readmePath ?? "README.md" : null),
            roadmapText: roadmapPath ? roadmapText : useReadme ? readme : "",
            openIssues: Number(meta.open_issues_count ?? 0),
            hasLicense: Boolean(meta.license) || paths.some((p) => /^licen[cs]e(\.\w+)?$/i.test(p)),
            pushedAt: typeof meta.pushed_at === "string" ? meta.pushed_at : null,
            liveUrl: live,
            liveOk,
        });
    } catch (err) {
        return {
            repo, percent: 0, complete: false, method: "readiness", readiness: 0,
            roadmap: { done: 0, total: 0, file: null, pending: [] },
            checks: [], pending: [], last_push: null, days_since_push: null,
            error: err instanceof Error ? err.message : String(err),
            evaluated_at: new Date().toISOString(),
        };
    }
}
