"""
engine/agent_crew.py
─────────────────────────────────────────────────────────────────────────────
Agent Crew — Sistema Multi-Agente de Xiimalab

4 agentes especializados que colaboran para detectar oportunidades:

  1. HackathonScout    → Explora active_hackathons, aplica filtros de calidad
  2. ProjectAnalyzer   → Lee user_projects, genera embeddings de cada proyecto
  3. MatchOracle       → Cruza proyectos × hackatones con similitud coseno
  4. OpportunityWriter → Redacta insights legibles y los guarda en agent_insights

Flujo de colaboración:
  run_crew() → Scout → Analyzer → Oracle → Writer → DB
                                                     ↓
                                               /api/agents/insights (FastAPI)
                                                     ↓
                                               /projects (Frontend)

Ejecución:
  python agent_crew.py               ← corre una vez y termina
  python agent_crew.py --loop 3600   ← loop cada 1h
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

import asyncpg
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────
DATABASE_URL   = os.environ.get("DATABASE_URL", "postgresql://xiima:secret@db:5432/xiimalab")
ML_MODEL       = os.environ.get("ML_MODEL", "all-MiniLM-L6-v2")
TOP_MATCHES    = int(os.environ.get("AGENT_TOP_MATCHES", "3"))
MIN_SCORE      = int(os.environ.get("AGENT_MIN_SCORE", "40"))   # % mínimo para generar insight
INSIGHT_TTL    = int(os.environ.get("AGENT_INSIGHT_TTL_DAYS", "14"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
log = logging.getLogger("xiima.agent_crew")


# ── Estructuras de datos compartidas entre agentes ────────────────
@dataclass
class HackathonItem:
    id:          str
    title:       str
    source:      str
    source_url:  Optional[str]
    prize_pool:  int
    tags:        list[str]
    deadline:    str
    embedding:   Optional[list[float]] = None
    match_score: int = 0


@dataclass
class ProjectItem:
    id:          str
    title:       str
    description: str
    status:      str
    stack:       list[str]
    embedding:   Optional[list[float]] = None


@dataclass
class MatchResult:
    project:       ProjectItem
    hackathon:     HackathonItem
    match_pct:     int
    reasoning:     str


@dataclass
class CrewContext:
    """Contexto compartido que pasa entre agentes."""
    run_id:      str
    hackathons:  list[HackathonItem]  = field(default_factory=list)
    projects:    list[ProjectItem]    = field(default_factory=list)
    matches:     list[MatchResult]    = field(default_factory=list)
    insights_created: int             = 0


# ══════════════════════════════════════════════════════════════════
# Agente 1 — HackathonScout
# ══════════════════════════════════════════════════════════════════
class HackathonScout:
    """
    Responsabilidad: cargar las hackatones activas de la DB.
    Filtra las cerradas, prioriza las de alto prize_pool.
    """
    name = "HackathonScout"

    async def run(self, conn: asyncpg.Connection, ctx: CrewContext) -> None:
        log.info(f"[{self.name}] Explorando active_hackathons...")

        rows = await conn.fetch(
            """
            SELECT id, title, source, source_url, prize_pool, tags,
                   deadline, embedding, match_score
            FROM active_hackathons
            WHERE (
                deadline = ''
                OR deadline IS NULL
                OR deadline::timestamptz >= NOW() - INTERVAL '1 day'
            )
            ORDER BY prize_pool DESC, last_seen_at DESC
            LIMIT 200
            """
        )

        items = []
        for r in rows:
            tags = r["tags"] or []
            if isinstance(tags, str):
                try:
                    tags = json.loads(tags)
                except Exception:
                    tags = []

            emb = None
            if r["embedding"]:
                try:
                    emb = [float(x) for x in str(r["embedding"]).strip("[]").split(",")]
                except Exception:
                    pass

            items.append(HackathonItem(
                id=r["id"], title=r["title"], source=r["source"],
                source_url=r["source_url"], prize_pool=r["prize_pool"] or 0,
                tags=tags, deadline=r["deadline"] or "",
                embedding=emb, match_score=r["match_score"] or 0,
            ))

        ctx.hackathons = items
        log.info(f"[{self.name}] {len(items)} hackatones cargadas ✓")


# ══════════════════════════════════════════════════════════════════
# Agente 2 — ProjectAnalyzer
# ══════════════════════════════════════════════════════════════════
class ProjectAnalyzer:
    """
    Responsabilidad: cargar proyectos del usuario y generar
    embeddings semánticos de cada uno si no existen.
    """
    name = "ProjectAnalyzer"
    _model = None

    def _get_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(ML_MODEL)
                log.info(f"[{self.name}] Modelo '{ML_MODEL}' cargado")
            except ImportError:
                log.warning(f"[{self.name}] sentence-transformers no disponible — usando similitud por tags")
        return self._model

    def _project_to_text(self, p: ProjectItem) -> str:
        stack = ", ".join(p.stack) if p.stack else ""
        return (
            f"{p.title} — {p.description} | "
            f"Tecnologías: {stack} | "
            f"Estado: {p.status}"
        )

    async def run(self, conn: asyncpg.Connection, ctx: CrewContext) -> None:
        log.info(f"[{self.name}] Analizando proyectos...")

        rows = await conn.fetch(
            "SELECT id, title, description, status, stack, project_embedding "
            "FROM user_projects WHERE status != 'archived' ORDER BY created_at"
        )

        model = self._get_model()
        projects = []

        for r in rows:
            stack = r["stack"] or []
            if isinstance(stack, str):
                try:
                    stack = json.loads(stack)
                except Exception:
                    stack = []

            emb = None
            if r["project_embedding"]:
                try:
                    emb = [float(x) for x in str(r["project_embedding"]).strip("[]").split(",")]
                except Exception:
                    pass

            p = ProjectItem(
                id=r["id"], title=r["title"], description=r["description"],
                status=r["status"], stack=stack, embedding=emb,
            )

            # Generar embedding si falta
            if emb is None and model is not None:
                text = self._project_to_text(p)
                vec  = model.encode(text, normalize_embeddings=True).tolist()
                p.embedding = vec
                vec_str = "[" + ",".join(f"{v:.8f}" for v in vec) + "]"
                await conn.execute(
                    "UPDATE user_projects SET project_embedding = $1 WHERE id = $2",
                    vec_str, p.id,
                )
                log.info(f"[{self.name}] Embedding generado para '{p.title}'")

            projects.append(p)

        ctx.projects = projects
        log.info(f"[{self.name}] {len(projects)} proyectos analizados ✓")


# ══════════════════════════════════════════════════════════════════
# Agente 3 — MatchOracle
# ══════════════════════════════════════════════════════════════════
class MatchOracle:
    """
    Responsabilidad: cruzar proyectos × hackatones.
    Usa similitud coseno si hay embeddings, fallback por tags si no.
    """
    name = "MatchOracle"

    def _cosine(self, a: list[float], b: list[float]) -> float:
        import math
        dot  = sum(x * y for x, y in zip(a, b))
        na   = math.sqrt(sum(x * x for x in a))
        nb   = math.sqrt(sum(x * x for x in b))
        if na == 0 or nb == 0:
            return 0.0
        return dot / (na * nb)

    def _tag_overlap_score(self, project: ProjectItem, hack: HackathonItem) -> int:
        """Fallback: % de tags del proyecto que aparecen en la hackatón."""
        p_tags = {t.lower() for t in project.stack}
        h_tags = {t.lower() for t in hack.tags}
        if not p_tags:
            return 30
        overlap = len(p_tags & h_tags)
        return min(30 + int(overlap / len(p_tags) * 70), 100)

    def _build_reasoning(
        self, project: ProjectItem, hack: HackathonItem, score: int
    ) -> str:
        p_tags = {t.lower() for t in project.stack}
        h_tags = {t.lower() for t in hack.tags}
        common = list(p_tags & h_tags)

        lines = []
        if common:
            lines.append(f"Tecnologías compartidas: {', '.join(common[:5])}")
        if hack.prize_pool > 0:
            lines.append(f"Premio disponible: ${hack.prize_pool:,}")
        if score >= 80:
            lines.append("Afinidad muy alta — el stack del proyecto cubre la mayoría de requisitos.")
        elif score >= 60:
            lines.append("Buena afinidad — hay coincidencias significativas de stack.")
        else:
            lines.append("Afinidad moderada — considera adaptar la propuesta.")

        deadline = hack.deadline
        if deadline:
            try:
                dt   = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
                days = (dt - datetime.now(timezone.utc)).days
                if 0 <= days <= 7:
                    lines.append(f"⏰ ¡Cierra en {days} días!")
                elif days > 0:
                    lines.append(f"Tiempo disponible: {days} días.")
            except Exception:
                pass

        return " ".join(lines)

    async def run(self, conn: asyncpg.Connection, ctx: CrewContext) -> None:
        log.info(f"[{self.name}] Calculando matches proyecto × hackatón...")

        matches: list[MatchResult] = []

        for project in ctx.projects:
            scored: list[tuple[int, HackathonItem]] = []

            for hack in ctx.hackathons:
                if project.embedding and hack.embedding:
                    score = int(self._cosine(project.embedding, hack.embedding) * 100)
                else:
                    score = self._tag_overlap_score(project, hack)

                if score >= MIN_SCORE:
                    scored.append((score, hack))

            # Top-N por proyecto
            scored.sort(key=lambda x: x[0], reverse=True)
            for score, hack in scored[:TOP_MATCHES]:
                reasoning = self._build_reasoning(project, hack, score)
                matches.append(MatchResult(
                    project=project,
                    hackathon=hack,
                    match_pct=score,
                    reasoning=reasoning,
                ))
                log.info(
                    f"[{self.name}] ✓ '{project.title}' × '{hack.title[:40]}' → {score}%"
                )

        ctx.matches = matches
        log.info(f"[{self.name}] {len(matches)} matches encontrados ✓")


# ══════════════════════════════════════════════════════════════════
# Agente 4 — OpportunityWriter
# ══════════════════════════════════════════════════════════════════
class OpportunityWriter:
    """
    Responsabilidad: convertir matches en insights legibles
    y persistirlos en agent_insights.
    Evita duplicados: no inserta si el mismo (project_id, hackathon_id)
    ya tiene un insight 'new' o 'read' reciente.
    """
    name = "OpportunityWriter"

    async def run(self, conn: asyncpg.Connection, ctx: CrewContext) -> None:
        log.info(f"[{self.name}] Escribiendo {len(ctx.matches)} oportunidades...")

        inserted = 0
        expires  = datetime.now(timezone.utc) + timedelta(days=INSIGHT_TTL)

        for m in ctx.matches:
            # Verificar duplicado reciente
            existing = await conn.fetchval(
                """
                SELECT id FROM agent_insights
                WHERE project_id   = $1
                  AND hackathon_id = $2
                  AND status       IN ('new', 'read')
                  AND created_at   >= NOW() - INTERVAL '7 days'
                """,
                m.project.id, m.hackathon.id,
            )
            if existing:
                log.debug(
                    f"[{self.name}] Duplicado omitido: "
                    f"{m.project.title} × {m.hackathon.title[:30]}"
                )
                continue

            # Generar título del insight
            title = (
                f"💡 {m.project.title} encaja con «{m.hackathon.title[:50]}»"
                if m.match_pct >= 70
                else f"🎯 Oportunidad para {m.project.title}: «{m.hackathon.title[:50]}»"
            )

            summary = (
                f"{m.project.title} ({m.project.status}) tiene un {m.match_pct}% de afinidad "
                f"con la hackatón **{m.hackathon.title}** "
                f"(fuente: {m.hackathon.source.capitalize()}, "
                f"premio: ${m.hackathon.prize_pool:,}). "
                f"{m.reasoning}"
            )

            metadata = {
                "run_id":       ctx.run_id,
                "project_stack": m.project.stack[:5],
                "hack_tags":    m.hackathon.tags[:5],
                "prize_pool":   m.hackathon.prize_pool,
                "source":       m.hackathon.source,
                "deadline":     m.hackathon.deadline,
            }

            await conn.execute(
                """
                INSERT INTO agent_insights (
                    agent_name, insight_type, project_id, hackathon_id,
                    title, summary, reasoning, action_url,
                    relevance_score, match_pct, agent_metadata, expires_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                """,
                self.name, "opportunity",
                m.project.id, m.hackathon.id,
                title, summary, m.reasoning,
                m.hackathon.source_url,
                m.match_pct, m.match_pct,
                json.dumps(metadata), expires,
            )
            inserted += 1

        ctx.insights_created = inserted
        log.info(f"[{self.name}] {inserted} insights guardados ✓")


# ══════════════════════════════════════════════════════════════════
# Orquestador — run_crew()
# ══════════════════════════════════════════════════════════════════
async def run_crew(triggered_by: str = "api") -> dict:
    """
    Ejecuta el Agent Crew completo:
    Scout → Analyzer → Oracle → Writer

    Returns: resumen de la ejecución
    """
    run_id = str(uuid.uuid4())[:8]
    log.info("=" * 65)
    log.info(f"  Agent Crew — run_id={run_id}  triggered_by={triggered_by}")
    log.info("=" * 65)

    conn = await asyncpg.connect(DATABASE_URL)

    # Registrar inicio de run
    try:
        await conn.execute(
            """
            INSERT INTO agent_runs (run_id, status, triggered_by, agents_invoked)
            VALUES ($1, 'running', $2, $3)
            """,
            run_id, triggered_by,
            json.dumps([a.name for a in [HackathonScout(), ProjectAnalyzer(),
                                         MatchOracle(), OpportunityWriter()]]),
        )
    except asyncpg.UndefinedTableError:
        log.warning("Tabla agent_runs no existe — ejecuta la migración 003")

    ctx = CrewContext(run_id=run_id)
    error_log = None

    try:
        agents = [
            HackathonScout(),
            ProjectAnalyzer(),
            MatchOracle(),
            OpportunityWriter(),
        ]
        for agent in agents:
            await agent.run(conn, ctx)

        # Marcar run como completado
        try:
            await conn.execute(
                """
                UPDATE agent_runs SET status='completed',
                    finished_at=NOW(), insights_created=$1
                WHERE run_id=$2
                """,
                ctx.insights_created, run_id,
            )
        except asyncpg.UndefinedTableError:
            pass

        log.info("=" * 65)
        log.info(f"  ✅ Crew completado — {ctx.insights_created} insights nuevos")
        log.info(f"  Proyectos: {len(ctx.projects)}  Hackatones: {len(ctx.hackathons)}")
        log.info(f"  Matches:   {len(ctx.matches)}")
        log.info("=" * 65)

        return {
            "run_id":           run_id,
            "status":           "completed",
            "projects":         len(ctx.projects),
            "hackathons":       len(ctx.hackathons),
            "matches":          len(ctx.matches),
            "insights_created": ctx.insights_created,
        }

    except Exception as exc:
        error_log = str(exc)
        log.exception(f"Agent Crew falló: {exc}")
        try:
            await conn.execute(
                "UPDATE agent_runs SET status='failed', finished_at=NOW(), error_log=$1 WHERE run_id=$2",
                error_log, run_id,
            )
        except Exception:
            pass
        return {"run_id": run_id, "status": "failed", "error": error_log}

    finally:
        await conn.close()


# ── FastAPI router (opcional) ─────────────────────────────────────
def create_router():
    from fastapi import APIRouter
    from fastapi.responses import JSONResponse

    router = APIRouter()

    @router.post("/run")
    async def trigger_crew():
        """Dispara el Agent Crew manualmente."""
        result = await run_crew(triggered_by="api")
        return JSONResponse(result)

    @router.get("/insights")
    async def get_insights(
        status: str = "new",
        project_id: str | None = None,
        limit: int = 20,
    ):
        """Devuelve insights del Agent Crew al frontend."""
        conn = await asyncpg.connect(DATABASE_URL)
        try:
            q = """
                SELECT ai.id, ai.agent_name, ai.insight_type,
                       ai.project_id, ai.hackathon_id,
                       ai.title, ai.summary, ai.reasoning,
                       ai.action_url, ai.relevance_score, ai.match_pct,
                       ai.status, ai.agent_metadata,
                       ai.created_at,
                       up.title AS project_title,
                       ah.title AS hackathon_title,
                       ah.source AS hackathon_source
                FROM agent_insights ai
                LEFT JOIN user_projects    up ON up.id = ai.project_id
                LEFT JOIN active_hackathons ah ON ah.id = ai.hackathon_id
                WHERE ai.status = $1
                  AND (ai.expires_at IS NULL OR ai.expires_at > NOW())
            """
            params: list = [status]
            if project_id:
                q += f" AND ai.project_id = ${len(params)+1}"
                params.append(project_id)
            q += f" ORDER BY ai.relevance_score DESC LIMIT ${len(params)+1}"
            params.append(limit)

            rows = await conn.fetch(q, *params)
            return [dict(r) for r in rows]
        finally:
            await conn.close()

    @router.patch("/insights/{insight_id}/read")
    async def mark_read(insight_id: int):
        conn = await asyncpg.connect(DATABASE_URL)
        try:
            await conn.execute(
                "UPDATE agent_insights SET status='read' WHERE id=$1", insight_id
            )
            return {"ok": True}
        finally:
            await conn.close()

    @router.get("/runs")
    async def list_runs(limit: int = 10):
        conn = await asyncpg.connect(DATABASE_URL)
        try:
            rows = await conn.fetch(
                "SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT $1", limit
            )
            return [dict(r) for r in rows]
        finally:
            await conn.close()

    return router


# ── Entry point ───────────────────────────────────────────────────
async def main():
    parser = argparse.ArgumentParser(description="Xiimalab Agent Crew")
    parser.add_argument("--loop", type=int, default=0,
                        help="Intervalo en segundos (0 = una sola vez)")
    parser.add_argument("--triggered-by", default="cli")
    args = parser.parse_args()

    if args.loop > 0:
        log.info(f"Modo loop activo — intervalo: {args.loop}s")
        while True:
            await run_crew(triggered_by=args.triggered_by)
            log.info(f"Próxima ejecución en {args.loop}s...")
            await asyncio.sleep(args.loop)
    else:
        result = await run_crew(triggered_by=args.triggered_by)
        sys.exit(0 if result["status"] == "completed" else 1)


if __name__ == "__main__":
    asyncio.run(main())
