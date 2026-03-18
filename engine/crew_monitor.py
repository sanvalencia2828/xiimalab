"""
engine/crew_monitor.py
─────────────────────────────────────────────────────────────────────────────
Crew Monitor — Monitoreo de colaboración multi-agente

Ejecuta el Agent Crew periódicamente y genera reportes de colaboración:
- Qué detectó cada agente
- Cómo se pasaron contexto entre sí
- Métricas de efectividad por agente
- Estado del sistema en tiempo real

Uso:
  python crew_monitor.py              ← monitor continuo (300s por defecto)
  python crew_monitor.py --interval 60 ← cada minuto
  python crew_monitor.py --once       ← una sola ejecución + reporte
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://xiima:secret@db:5432/xiimalab")
INTERVAL     = int(os.environ.get("MONITOR_INTERVAL", "300"))  # 5 minutos default

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
log = logging.getLogger("xiima.crew_monitor")


# ── Reporte de colaboración ───────────────────────────────────────────────────

async def get_last_run_report(conn: asyncpg.Connection) -> Optional[dict]:
    """Obtiene el último run del crew y genera reporte de colaboración."""
    try:
        run = await conn.fetchrow(
            """
            SELECT run_id, status, triggered_by, agents_invoked,
                   insights_created, started_at, finished_at
            FROM agent_runs
            ORDER BY started_at DESC
            LIMIT 1
            """
        )
        if not run:
            return None

        run_id = run["run_id"]

        # Insights creados en este run
        insights = await conn.fetch(
            """
            SELECT agent_name, insight_type, match_pct, relevance_score,
                   title, hackathon_title, project_title, status
            FROM agent_insights
            WHERE agent_metadata->>'run_id' = $1
            ORDER BY match_pct DESC
            """,
            run_id,
        )

        # Estadísticas por agente
        agent_stats = {}
        for insight in insights:
            agent = insight["agent_name"]
            if agent not in agent_stats:
                agent_stats[agent] = {"count": 0, "avg_match": 0, "top_match": 0, "insights": []}
            agent_stats[agent]["count"] += 1
            agent_stats[agent]["avg_match"] += insight["match_pct"]
            agent_stats[agent]["top_match"] = max(agent_stats[agent]["top_match"], insight["match_pct"])
            agent_stats[agent]["insights"].append({
                "title": insight["title"],
                "match_pct": insight["match_pct"],
                "hackathon": insight["hackathon_title"],
                "project": insight["project_title"],
            })

        for agent in agent_stats:
            count = agent_stats[agent]["count"]
            if count > 0:
                agent_stats[agent]["avg_match"] = round(agent_stats[agent]["avg_match"] / count)

        # Tiempo de ejecución
        duration = None
        if run["started_at"] and run["finished_at"]:
            duration = (run["finished_at"] - run["started_at"]).total_seconds()

        return {
            "run_id": run_id,
            "status": run["status"],
            "triggered_by": run["triggered_by"],
            "agents_invoked": json.loads(run["agents_invoked"] or "[]"),
            "insights_created": run["insights_created"] or 0,
            "duration_seconds": duration,
            "started_at": run["started_at"].isoformat() if run["started_at"] else None,
            "finished_at": run["finished_at"].isoformat() if run["finished_at"] else None,
            "agent_stats": agent_stats,
            "total_insights": len(insights),
        }

    except asyncpg.UndefinedTableError:
        log.warning("Tabla agent_runs no existe — ejecuta migración 003")
        return None


async def get_system_health(conn: asyncpg.Connection) -> dict:
    """Estado general del sistema."""
    try:
        hackathons = await conn.fetchval("SELECT COUNT(*) FROM active_hackathons")
        users = await conn.fetchval("SELECT COUNT(*) FROM user_skills_progress")
        projects = await conn.fetchval("SELECT COUNT(*) FROM user_projects")
        insights_total = await conn.fetchval("SELECT COUNT(*) FROM agent_insights")
        insights_active = await conn.fetchval(
            "SELECT COUNT(*) FROM agent_insights WHERE status = 'active'"
        )
        embeddings_ready = await conn.fetchval(
            "SELECT COUNT(*) FROM active_hackathons WHERE embedding IS NOT NULL"
        )
        users_with_embedding = await conn.fetchval(
            "SELECT COUNT(*) FROM user_skills_progress WHERE profile_embedding IS NOT NULL"
        )

        return {
            "hackathons_total": hackathons,
            "hackathons_embedded": embeddings_ready,
            "users_total": users,
            "users_embedded": users_with_embedding,
            "projects_total": projects,
            "insights_total": insights_total,
            "insights_active": insights_active,
        }
    except Exception as e:
        return {"error": str(e)}


def print_collaboration_report(report: dict, health: dict, run_number: int):
    """Imprime reporte visual de colaboración en consola."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    
    print("\n" + "═" * 65)
    print(f"  🤖 XIIMALAB AGENT CREW — Monitor #{run_number}")
    print(f"  {now}")
    print("═" * 65)

    # Sistema
    print("\n📊 ESTADO DEL SISTEMA:")
    print(f"   Hackatones: {health.get('hackathons_total', 0)} total | "
          f"{health.get('hackathons_embedded', 0)} con embeddings")
    print(f"   Usuarios:   {health.get('users_total', 0)} total | "
          f"{health.get('users_embedded', 0)} con perfil vectorizado")
    print(f"   Proyectos:  {health.get('projects_total', 0)} total")
    print(f"   Insights:   {health.get('insights_total', 0)} total | "
          f"{health.get('insights_active', 0)} activos")

    if not report:
        print("\n⚠️  Sin runs previos — inicia agent-crew primero")
        print("═" * 65)
        return

    # Último run
    print(f"\n🚀 ÚLTIMO RUN: {report['run_id']} ({report['status'].upper()})")
    if report["duration_seconds"]:
        print(f"   Duración: {report['duration_seconds']:.1f}s | "
              f"Insights creados: {report['insights_created']}")

    # Colaboración entre agentes
    if report["agent_stats"]:
        print("\n🤝 COLABORACIÓN DE AGENTES:")
        agent_flow = [
            ("HackathonScout",    "🔍", "Explora hackatones"),
            ("ProjectAnalyzer",   "🧠", "Vectoriza proyectos"),
            ("MatchOracle",       "⚡", "Cruza matches"),
            ("OpportunityWriter", "✍️ ", "Genera insights"),
        ]
        for agent_name, emoji, desc in agent_flow:
            stats = report["agent_stats"].get(agent_name, {})
            if stats:
                print(f"\n   {emoji} {agent_name} — {desc}")
                print(f"      Insights: {stats['count']} | "
                      f"Match promedio: {stats['avg_match']}% | "
                      f"Top match: {stats['top_match']}%")
                for ins in stats["insights"][:2]:
                    print(f"      → {ins['title'][:50]} ({ins['match_pct']}%)")
            else:
                print(f"\n   {emoji} {agent_name} — {desc}")
                print(f"      Sin actividad en este run")

    # Pasaje de contexto
    print("\n🔄 FLUJO DE CONTEXTO:")
    agents = report.get("agents_invoked", [])
    if agents:
        flow = " → ".join(agents)
        print(f"   {flow}")
        print(f"   Total insights generados en pipeline: {report['total_insights']}")

    print("\n" + "═" * 65 + "\n")


async def save_monitor_snapshot(conn: asyncpg.Connection, report: dict, health: dict):
    """Guarda snapshot del monitor en agent_insights como meta-insight."""
    try:
        snapshot = {
            "type": "monitor_snapshot",
            "health": health,
            "last_run": report,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await conn.execute(
            """
            INSERT INTO agent_insights
                (agent_name, insight_type, title, summary, relevance_score,
                 match_pct, status, agent_metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            "CrewMonitor",
            "system_snapshot",
            f"Monitor snapshot — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}",
            f"Sistema: {health.get('hackathons_total',0)} hackatones, "
            f"{health.get('users_total',0)} usuarios, "
            f"{health.get('insights_active',0)} insights activos",
            100,
            0,
            "archived",
            json.dumps(snapshot),
        )
    except Exception as e:
        log.debug(f"No se pudo guardar snapshot: {e}")


async def trigger_crew_run():
    """Dispara el agent crew como subproceso."""
    import subprocess
    log.info("Disparando Agent Crew...")
    proc = await asyncio.create_subprocess_exec(
        "python", "agent_crew.py", "--triggered-by", "monitor",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    if stdout:
        for line in stdout.decode().splitlines():
            log.info(f"[crew] {line}")
    return proc.returncode == 0


async def monitor_loop(interval: int, run_once: bool = False, skip_crew: bool = False):
    """Loop principal del monitor."""
    run_number = 0
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        while True:
            run_number += 1
            log.info(f"Monitor tick #{run_number}")

            # Disparar crew (opcional)
            if not skip_crew:
                success = await trigger_crew_run()
                if not success:
                    log.warning("Agent crew terminó con error")

            # Reporte de colaboración
            report = await get_last_run_report(conn)
            health = await get_system_health(conn)

            print_collaboration_report(report or {}, health, run_number)

            # Guardar snapshot
            if report:
                await save_monitor_snapshot(conn, report, health)

            if run_once:
                break

            log.info(f"Próximo ciclo en {interval}s...")
            await asyncio.sleep(interval)

    finally:
        await conn.close()


async def main():
    parser = argparse.ArgumentParser(description="Xiimalab Crew Monitor")
    parser.add_argument("--interval", type=int, default=INTERVAL,
                        help="Intervalo entre runs en segundos (default: 300)")
    parser.add_argument("--once", action="store_true",
                        help="Ejecutar una sola vez y salir")
    parser.add_argument("--report-only", action="store_true",
                        help="Solo mostrar reporte sin disparar crew")
    args = parser.parse_args()

    log.info("🤖 Xiimalab Crew Monitor iniciando...")
    log.info(f"   Intervalo: {args.interval}s | Once: {args.once} | Report-only: {args.report_only}")

    await monitor_loop(
        interval=args.interval,
        run_once=args.once or args.report_only,
        skip_crew=args.report_only,
    )


if __name__ == "__main__":
    asyncio.run(main())
