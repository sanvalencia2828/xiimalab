# Roadmap — Xiimalab

Hub personal de IA y Blockchain: portafolio de proyectos conectado a hackatones y bounties activos.

> Xiimalab lee este archivo para calcular el % de avance del proyecto.
> Marca una tarea como hecha cambiando el espacio por una `x` entre los corchetes.
> Última revisión: 2026-10-11.

## Fase 1 — Base de la plataforma

- [x] Frontend Next.js 14 (App Router) con navegación lateral y tema oscuro
- [x] Backend FastAPI con modelos asíncronos (SQLAlchemy + asyncpg)
- [x] Esquema de base de datos (hackathons, user_achievements, skill_demands)
- [x] Docker Compose para levantar el stack completo en local
- [x] Deploy del frontend en Vercel (xiimalab.vercel.app)
- [x] Plantilla de variables de entorno (.env.example)

## Fase 2 — Hackatones y bounties en vivo

- [x] Scraper de DoraHacks con la API real del hub (paginación, premios, fechas)
- [x] Integración con Devfolio (API pública y MCP)
- [x] Agregador en vivo en Next.js: DoraHacks + Devpost + Devfolio sin depender de FastAPI
- [x] Corregir el formato de /api/hackathons para que todas las pantallas reciban la lista
- [x] Publicar en producción el agregador en vivo y comprobar /api/hackathons?debug=1
- [x] Confirmar que DoraHacks responde desde los servidores de Vercel (si no, usar el scraper como respaldo)
- [x] Bounties abiertos de Superteam Earn en su propia página (/bounties)
- [x] Página única de hackatones (/hackathons), con premios "No verificado" fuera del orden por premio
- [ ] Añadir otros bounties activos (p. ej. Gitcoin, Layer3)
- [x] Migración, script y workflow de GitHub Actions (cada 6 h) para guardar hackatones y bounties en Supabase
- [ ] Activar los snapshots: aplicar la migración en Supabase y crear los secretos SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en GitHub
- [x] Campana con las convocatorias que cierran en 72 h y encajan con tus skills (Supabase, con el agregador en vivo como respaldo)

## Fase 3 — Portafolio de proyectos

- [x] Página de proyectos con tarjetas, stack y métricas
- [x] Enlaces de demo y repositorio visibles en cada tarjeta
- [x] Crédito de autor y licencia en proyectos de terceros (Pulsar Radar)
- [x] Proyectos Pulsar Radar y Rastreador añadidos
- [x] Avance automático por proyecto desde GitHub, con filtro Completos / Pendientes
- [x] Redactar el ROADMAP.md de cada proyecto del portafolio
- [ ] Subir el ROADMAP.md a cada repositorio en GitHub
- [ ] Configurar GITHUB_TOKEN en Vercel para no agotar el límite de la API
- [ ] Recomendar hackatones por proyecto según su stack con datos en vivo
- [ ] Mover la lista de proyectos a Supabase para editarla sin tocar código

## Fase 4 — Inteligencia y perfil

- [x] Sistema de prioridades (urgencia, match y premio)
- [x] Análisis de relevancia de skills según la demanda de hackatones
- [x] Roadmap de aprendizaje con persistencia (PATCH)
- [x] Tracks de aprendizaje con hitos verificables (/roadmap) y ranking de tracks por demanda actual
- [x] Dashboard del Estudiante calculado con datos reales (tracks, proyectos, skills, logros)
- [x] Market Match unificado en la pestaña "Mercado" de /skills, con nivel por evidencia
- [x] Recursos reconocidos por fase (Cyfrin Updraft) y certificaciones como evidencia de una skill
- [x] Mi Perfil con datos personales, ideas en exploración y exportación a Markdown
- [x] Configuración: wallets Stellar (StrKey) y Solana, estado de integraciones, exportar y borrar datos
- [x] Lectura del saldo y de los saldos reclamables de la wallet desde Horizon testnet
- [ ] Guardar en Supabase el avance de los tracks, el perfil y las certificaciones (hoy en localStorage)
- [ ] Conectar con Freighter para verificar que la wallet Stellar es tuya
- [ ] Reemplazar el userId fijo de /staking por el usuario o wallet real
- [ ] Conectar el escrow educativo de Stellar con wallets reales (testnet)
- [ ] Revisar las respuestas de error de NeuroProfileDashboard y PriorityBoard

## Fase 5 — Calidad y publicación

- [x] Tests del parser del scraper (pytest)
- [ ] Workflow de GitHub Actions que corra lint, tsc y build en cada push
- [ ] Tests del frontend para el agregador de hackatones y el cálculo de avance
- [ ] Añadir un archivo LICENSE
- [ ] Limpiar la raíz del repo: logs (*.log, ts_errors.txt) y reportes .md antiguos a docs/
- [ ] Resolver el desajuste del servicio frontend en docker-compose.yml (contexto de build)
- [x] Unir la rama ui/premium-design-system a main
- [x] Unir a main las ramas de tracks, dashboard, bounties, Skills, perfil, snapshots y recursos
- [x] Actualizar Next.js al último parche de 14.2 (14.2.35)
- [ ] Revisar en el navegador las páginas nuevas (solo se comprobaron la lógica y las respuestas del servidor)
- [ ] Mover el repositorio fuera de OneDrive (rompe la carpeta .next de Next.js)
- [ ] Rotar la clave del MCP de Devfolio, si aún no está hecho (también la de .claude/settings.local.json)
