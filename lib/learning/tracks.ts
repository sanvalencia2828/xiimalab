/**
 * lib/learning/tracks.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks de aprendizaje de Xiimalab.
 *
 * El contenido (fases, objetivos e hitos) está escrito para Xiimalab. Cada
 * track enlaza al roadmap equivalente de roadmap.sh solo como referencia
 * externa: no se copia ni se descarga nada de allí.
 *
 * Reglas del contenido:
 *   • Cada hito es verificable: se demuestra con un repo, una demo o un despliegue.
 *   • 3–5 fases por track y 3–6 hitos por fase (2 en una fase puente).
 *   • El orden de las fases es por impacto: primero las que resuelven una
 *     necesidad real de más proyectos del portafolio (`resuelve`), respetando
 *     las dependencias entre fases. Las fases que ningún proyecto necesita van
 *     al final y pueden ser opcionales.
 *   • Cada fase tiene un proyecto práctico por cada proyecto del portafolio
 *     que la toca. Los escritos a mano están en lib/learning/practices-data.ts
 *     y llegan aquí como `practicas`; `practicaGeneral` es el texto de la fase
 *     que se adapta a los proyectos que aún no tienen uno (lib/learning/practices.ts).
 *   • `resuelve` y `appliesTo` se fijan a mano a partir de lo que cada repo
 *     tiene pendiente (ROADMAP.md, TODO.md, README y código): no se calculan
 *     por coincidencia de stack. Usan el nombre corto del proyecto.
 *   • `skills` usa las mismas etiquetas que lib/hackathons/match.ts
 *     (SKILL_WEIGHTS y LEARNING_SKILLS), para cruzar cada fase con las
 *     hackatones abiertas.
 *   • AI Engineer y AI Agents no comparten skills de IA: el primero cubre el
 *     modelo y sus datos (LLM por API, RAG, embeddings, evaluación,
 *     fine-tuning); el segundo, lo que hace de un modelo un agente (tool use,
 *     MCP, orquestación, memoria, multi-agente).
 *
 * El id de un hito es `<track>:<fase>:<número>`; el número es su posición salvo
 * que se fije con `n`. El avance guardado depende de él: añade hitos nuevos al
 * final de la fase, no reordenes los existentes y, si quitas uno, fija con `n`
 * el número de los que le siguen. Si un hito se mueve o se fusiona, añade la
 * regla a MILESTONE_MIGRATIONS en lib/learning/progress.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { MANUAL_PRACTICES } from "./practices-data";

export interface Milestone {
    id: string;
    text: string;
    /** Proyectos del portafolio donde este hito resuelve algo pendiente */
    appliesTo?: string[];
}

/** Necesidad común a varios proyectos que la fase enseña a resolver. */
export interface PhaseNeed {
    need: string;
    /** Nombre corto de los proyectos que la tienen ("Rastreador") */
    projects: string[];
}

export interface PracticeProject {
    /** Idea de proyecto, o qué hacer con el proyecto del portafolio */
    idea: string;
    /** Título de un proyecto de lib/projects/data.ts, si la práctica se apoya en él */
    portfolioTitle?: string;
}

export type Effort = "S" | "M" | "L";
/** "Nueva función" cuando el proyecto no usa hoy esa tecnología. */
export type PracticeType = "Mejora" | "Nueva función";
export type PracticeOrigin = "Manual" | "IA" | "General";

/** Qué hacer en un proyecto del portafolio para practicar una fase. */
export interface Practice {
    /** Nombre corto del proyecto ("Rastreador") */
    project: string;
    title: string;
    type: PracticeType;
    /** Qué hacer, en 2–3 frases */
    what: string;
    /** Primeros pasos: 3 tareas verificables */
    steps: string[];
    /** Hitos de la fase que demuestra */
    milestones: Milestone[];
    /** null en una práctica general: nadie la ha estimado */
    effort: Effort | null;
    origin: PracticeOrigin;
}

export interface Phase {
    id: string;
    title: string;
    objective: string;
    milestones: Milestone[];
    skills: string[];
    /** Texto general de la fase, para los proyectos sin práctica propia */
    practicaGeneral: PracticeProject;
    /** Prácticas escritas a mano, una por proyecto (lib/learning/practices-data.ts) */
    practicas: Practice[];
    /** Necesidades reales de los proyectos que atiende; sin ellas, ningún proyecto la necesita hoy */
    resuelve?: PhaseNeed[];
    /** No cuenta para el avance del track */
    optional?: boolean;
    /** Aviso sobre cuándo saltarla o cómo encaja con otro track */
    note?: string;
}

export interface TrackReference {
    label: string;
    url: string;
}

export interface Track {
    id: string;
    title: string;
    description: string;
    /** Roadmap equivalente en roadmap.sh (solo enlace) */
    referenceUrl: string;
    secondaryReferences?: TrackReference[];
    /** Cadena o tecnología con la que el track hace la práctica (para contrastar con los recursos externos) */
    ecosystem?: string;
    phases: Phase[];
}

type MilestoneInput = string | { text: string; n?: number; appliesTo?: string[] };

interface PhaseInput extends Omit<Phase, "milestones" | "practicas"> {
    milestones: MilestoneInput[];
}
interface TrackInput extends Omit<Track, "phases"> {
    phases: PhaseInput[];
}

function defineTrack(input: TrackInput): Track {
    return {
        ...input,
        phases: input.phases.map((phase) => {
            const milestones: Milestone[] = phase.milestones.map((milestone, i) => {
                const { text, n = i + 1, appliesTo } = typeof milestone === "string" ? { text: milestone } : milestone;
                return { id: `${input.id}:${phase.id}:${n}`, text, ...(appliesTo ? { appliesTo } : {}) };
            });
            const practicas: Practice[] = (MANUAL_PRACTICES[`${input.id}:${phase.id}`] ?? []).map((manual) => ({
                project: manual.proyecto,
                title: manual.titulo,
                type: manual.tipo,
                what: manual.queHacer,
                steps: manual.primerosPasos,
                // Un número que no corresponde a ningún hito de la fase se descarta (lo detecta el test de prácticas)
                milestones: milestones.filter((m) => manual.hitos.includes(Number(m.id.split(":")[2]))),
                effort: manual.esfuerzo,
                origin: "Manual",
            }));
            return { ...phase, milestones, practicas };
        }),
    };
}

export const TRACKS: Track[] = [
    // ── AI Engineer ─────────────────────────────────────────────────────────
    defineTrack({
        id: "ai-engineer",
        title: "AI Engineer",
        description: "Construir productos sobre modelos ya entrenados: integrarlos, hacer fiables sus respuestas, darles tus datos y operarlos en producción.",
        referenceUrl: "https://roadmap.sh/ai-engineer",
        phases: [
            {
                id: "modelos-por-api",
                title: "Usar modelos por API",
                objective: "Integrar un LLM en una aplicación real, con la clave protegida y el coste medido.",
                milestones: [
                    "Publicar un script que llama a un LLM por API y devuelve JSON validado contra un esquema",
                    "Comparar dos modelos con 10 prompts propios y publicar la tabla de calidad, coste y latencia",
                    "Mostrar la respuesta en streaming en una interfaz web desplegada",
                    "Mover la clave al servidor y limitar las peticiones por usuario",
                ],
                skills: ["llm", "ai", "python", "typescript"],
                practicaGeneral: { idea: "Revisar el análisis de match de Xiimalab (/api/match) y añadirle la respuesta en streaming.", portfolioTitle: "Xiimalab" },
                resuelve: [{ need: "Integrar un LLM con salidas fiables", projects: ["Xiimalab", "Regen-Buddy"] }],
            },
            {
                id: "prompts-fiables",
                title: "Prompts y salidas fiables",
                objective: "Tratar los prompts como código: versionados, probados y con salida predecible.",
                milestones: [
                    "Versionar los prompts de una app en el repo, con una nota de por qué cambió cada uno",
                    {
                        text: "Escribir 15 casos de prueba para un prompt que ya está en producción y un script que puntúe cada versión",
                        appliesTo: ["Xiimalab", "Regen-Buddy"],
                    },
                    "Lograr que la salida estructurada pase la validación de esquema en todos los casos de prueba",
                    "Documentar tres fallos reales del modelo y el cambio que los corrigió",
                ],
                skills: ["llm", "ai", "evaluation"],
                practicaGeneral: { idea: "Crear el conjunto de pruebas del prompt de match de Xiimalab y compararlo entre dos modelos.", portfolioTitle: "Xiimalab" },
                resuelve: [{ need: "Integrar un LLM con salidas fiables", projects: ["Xiimalab", "Regen-Buddy"] }],
            },
            {
                id: "produccion",
                title: "Producto en producción",
                objective: "Operar la aplicación: saber cuánto cuesta, cuándo falla y cómo se protege.",
                milestones: [
                    "Desplegar la app con caché de respuestas y publicar el ahorro medido",
                    "Registrar coste, latencia y errores por petición en un panel consultable",
                    "Filtrar entradas maliciosas y datos personales, con casos de prueba que lo demuestren",
                    "Empaquetar la app en Docker con un workflow que despliega al hacer push",
                    "Publicar la demo con un README que explique la arquitectura",
                ],
                skills: ["llm", "evaluation", "docker", "devops", "analytics"],
                practicaGeneral: { idea: "Añadir a RedimensionAI un panel de coste y errores por petición.", portfolioTitle: "RedimensionAI" },
            },
            {
                id: "multimodal-abiertos",
                title: "Multimodal y modelos abiertos",
                objective: "Salir del texto y de un único proveedor: imagen, voz y modelos que corres tú.",
                milestones: [
                    "Procesar una imagen con un modelo de visión y devolver datos estructurados",
                    "Ejecutar un modelo abierto en local y exponerlo detrás de una API propia",
                    "Comparar el modelo local con uno comercial en la misma tarea y publicar los resultados",
                    "Añadir transcripción o síntesis de voz a una demo desplegada",
                ],
                skills: ["ai", "ml", "machine learning", "fine-tuning", "python"],
                practicaGeneral: { idea: "Añadir a AURA una descripción automática de cada imagen redimensionada.", portfolioTitle: "AURA" },
            },
            {
                id: "embeddings-rag",
                title: "Embeddings y búsqueda sobre tus datos",
                objective: "Que el modelo responda con información propia y diga de dónde la sacó.",
                milestones: [
                    "Generar embeddings de más de 100 documentos propios y guardarlos en una base vectorial",
                    "Publicar un buscador semántico que devuelve los 5 fragmentos más cercanos a una consulta",
                    "Responder preguntas citando la fuente, y negarse cuando el contexto no alcanza",
                    "Medir la recuperación con 20 preguntas de respuesta conocida y publicar el resultado",
                    "Reindexar solo los documentos que cambian, sin reprocesar todo el corpus",
                ],
                skills: ["rag", "embeddings", "llm", "data", "python"],
                practicaGeneral: { idea: "Buscador semántico sobre las hackatones abiertas del agregador de Xiimalab.", portfolioTitle: "Xiimalab" },
            },
        ],
    }),

    // ── AI Agents ───────────────────────────────────────────────────────────
    defineTrack({
        id: "ai-agents",
        title: "AI Agents",
        description: "Pasar de llamar a un modelo a construir agentes que usan herramientas, recuerdan contexto y se pueden desplegar y medir.",
        referenceUrl: "https://roadmap.sh/ai-agents",
        phases: [
            {
                id: "llamada-fiable",
                title: "Hablar con un modelo desde código",
                objective: "Dominar una llamada a un LLM con salida fiable antes de añadir autonomía.",
                milestones: [
                    "Hacer una llamada a la API de un LLM desde un script, con la clave en una variable de entorno, y anotar en el README los tokens y el coste de 20 llamadas",
                    "Obtener una respuesta en JSON validada contra un esquema y manejar tres fallos distintos (límite de peticiones, timeout, respuesta inválida) con un mensaje propio para cada uno",
                ],
                skills: ["agent", "python", "typescript"],
                resuelve: [{ need: "Integrar un LLM con salidas fiables", projects: ["Xiimalab", "Regen-Buddy"] }],
                note: "Fase puente: si ya hiciste «Usar modelos por API» en AI Engineer, puedes saltarla.",
                practicaGeneral: { idea: "Estudiar el análisis de match de Xiimalab (/api/match), que valida la respuesta del modelo y distingue sus errores.", portfolioTitle: "Xiimalab" },
            },
            {
                id: "herramientas",
                title: "Herramientas (tool use)",
                objective: "Que el modelo decida cuándo llamar a funciones tuyas y use sus resultados.",
                milestones: [
                    {
                        text: "Exponer como herramientas dos endpoints que ya existen, con su esquema de entrada, y hacer que el modelo elija la correcta según la pregunta",
                        appliesTo: ["Rastreador", "Xiimalab", "Pulsar Radar"],
                    },
                    "Implementar el bucle completo: petición, llamada a la herramienta, resultado y respuesta final",
                    "Devolver un error de herramienta al modelo y comprobar que se recupera sin romper la conversación",
                    "Conectar una herramienta a datos reales, por ejemplo las hackatones abiertas de /api/hackathons",
                    "Desplegar un agente con tool use accesible por URL",
                ],
                skills: ["agent", "tool use", "mcp", "python", "fastapi"],
                practicaGeneral: { idea: "Un asistente que responde «¿a qué hackatón me apunto esta semana?» consultando el agregador de Xiimalab.", portfolioTitle: "Xiimalab" },
            },
            {
                id: "memoria",
                title: "Memoria y contexto",
                objective: "Que el agente trabaje con información que no cabe o no está en el prompt.",
                milestones: [
                    "Mantener una conversación de 10 turnos sin perder un dato dado en el primero",
                    "Indexar un conjunto de documentos propios y responder citando el fragmento usado",
                    {
                        text: "Guardar un dato entre sesiones en una base de datos, no en el navegador, y recuperarlo en una conversación nueva",
                        appliesTo: ["Regen-Buddy", "Xiimalab"],
                    },
                    "Resumir o recortar el historial al superar un límite de tokens, sin perder los datos clave",
                ],
                skills: ["agent", "memory", "data", "python"],
                resuelve: [{ need: "Persistencia en base de datos", projects: ["Regen-Buddy", "Xiimalab"] }],
                practicaGeneral: { idea: "Dar memoria a Regen-Buddy: que recuerde el nombre y el estado de la mascota entre visitas.", portfolioTitle: "Regen-Buddy" },
            },
            {
                id: "multi-paso",
                title: "Varios pasos y varios agentes",
                objective: "Resolver tareas que requieren planificar, repartir trabajo y parar a tiempo.",
                milestones: [
                    "Hacer que un agente divida una tarea en pasos, los ejecute y muestre el plan seguido",
                    "Poner un tope de pasos y de gasto, y comprobar que el agente se detiene al alcanzarlo",
                    "Coordinar dos agentes con roles distintos (uno busca, otro redacta) en una misma tarea",
                    "Añadir una confirmación humana antes de cualquier acción irreversible",
                ],
                skills: ["agent", "multi-agent", "orchestration", "python"],
                practicaGeneral: { idea: "Un agente que lee el repo de un proyecto del portafolio y propone su ROADMAP.md." },
            },
            {
                id: "evaluar-desplegar",
                title: "Evaluar y poner en producción",
                objective: "Saber si el agente funciona, cuánto cuesta y qué pasa cuando falla.",
                milestones: [
                    "Escribir 20 casos de prueba con respuesta esperada y un script que los puntúe",
                    "Registrar cada ejecución (pasos, herramientas, tokens, duración) en un log consultable",
                    "Probar tres entradas con instrucciones maliciosas y documentar cómo responde el agente",
                    "Empaquetar el agente en Docker y desplegarlo con límite de peticiones por usuario",
                    "Publicar una demo en vivo con el enlace en el README",
                ],
                skills: ["agent", "orchestration", "docker", "devops", "analytics"],
                practicaGeneral: { idea: "Presentar el agente de la fase de herramientas o de varios pasos a una hackatón abierta de IA o agentes." },
            },
        ],
    }),

    // ── Blockchain ──────────────────────────────────────────────────────────
    defineTrack({
        id: "blockchain",
        title: "Blockchain",
        description: "De enviar tu primera transacción en testnet a publicar una dApp con wallet y pagos; los contratos propios quedan como fase opcional.",
        referenceUrl: "https://roadmap.sh/blockchain",
        ecosystem: "Stellar",
        phases: [
            {
                id: "fundamentos",
                title: "Fundamentos con las manos",
                objective: "Entender cuentas, firmas y transacciones haciéndolas, no leyéndolas.",
                milestones: [
                    "Crear una wallet en testnet, recibir fondos de un faucet y enviar una transacción desde código",
                    "Leer el saldo y las últimas transacciones de una dirección con un script",
                    "Publicar una explicación propia de una transacción real, desglosando firma, comisión y bloque",
                    "Firmar un mensaje fuera de la cadena y verificar la firma en otro script",
                ],
                skills: ["blockchain", "web3", "stellar", "typescript"],
                resuelve: [{ need: "Autenticación y wallet", projects: ["Xiimalab"] }],
                practicaGeneral: { idea: "Seguir el flujo de wallet Stellar de Xiimalab y repetirlo en un script propio contra testnet.", portfolioTitle: "Xiimalab" },
            },
            {
                id: "dapp",
                title: "dApp con wallet y pagos",
                objective: "Dar a una web una wallet real: conectarla, comprobar de quién es y pagar en testnet, sin escribir un contrato propio.",
                milestones: [
                    "Conectar una wallet desde una web y mostrar la dirección y el saldo",
                    "Enviar un pago en testnet desde la interfaz y reflejar si está pendiente, confirmado o fallido",
                    "Mostrar el historial de pagos de la cuenta leyéndolo de la red",
                    "Desplegar el frontend y enlazar en el README una transacción de ejemplo en el explorador",
                    {
                        text: "Verificar que la wallet es de quien la conecta: pedir la firma de un mensaje y comprobarla en el servidor",
                        appliesTo: ["Xiimalab", "RedimensionAI"],
                    },
                ],
                skills: ["web3", "blockchain", "react", "next.js", "typescript"],
                practicaGeneral: { idea: "Conectar la página de staking de Xiimalab a una wallet real en testnet.", portfolioTitle: "Xiimalab" },
                resuelve: [{ need: "Autenticación y wallet", projects: ["Xiimalab", "RedimensionAI"] }],
            },
            {
                id: "tokens-defi",
                title: "Tokens, DeFi y NFT",
                objective: "Usar las piezas financieras que ya existen en lugar de reinventarlas.",
                milestones: [
                    "Emitir un token en testnet y transferirlo entre dos cuentas",
                    "Acuñar una colección NFT con los metadatos alojados fuera de la cadena",
                    "Integrar en testnet un intercambio o un pool de liquidez de un protocolo existente",
                    {
                        text: "Crear un pago condicionado (escrow o saldo reclamable) y reclamarlo desde otra cuenta",
                        appliesTo: ["Xiimalab"],
                    },
                ],
                skills: ["defi", "nft", "stellar", "solana", "blockchain"],
                resuelve: [{ need: "Autenticación y wallet", projects: ["Xiimalab"] }],
                practicaGeneral: { idea: "Añadir a Pulsar Radar la lectura en cadena de la liquidez de un token.", portfolioTitle: "Pulsar Radar" },
            },
            {
                id: "contratos-seguridad",
                title: "Contratos y seguridad",
                objective: "Escribir, probar y desplegar lógica propia en la cadena, sabiendo qué puede salir mal con dinero real.",
                milestones: [
                    "Escribir un contrato con estado y dos funciones, desplegarlo en testnet y verificar su código en un explorador de bloques",
                    "Cubrirlo con tests que incluyan al menos dos casos que deben fallar",
                    "Emitir eventos desde el contrato, leerlos con un script y publicar el coste de despliegue y de cada llamada",
                    "Reproducir en un test una vulnerabilidad conocida (por ejemplo, reentrada), corregirla y pasar un analizador estático documentando cada hallazgo",
                    "Añadir control de acceso y una pausa de emergencia, con tests de ambos",
                    "Escribir el plan de despliegue, ejecutarlo con claves separadas o una cuenta multifirma y presentar el proyecto a una hackatón o a un bounty",
                ],
                skills: ["smart contract", "blockchain", "web3", "defi", "open track"],
                practicaGeneral: { idea: "Un contrato de escrow educativo: el depósito se libera al completar un hito. Audítalo y preséntalo a una hackatón abierta." },
                optional: true,
                note: "Opcional: hoy ningún proyecto del portafolio necesita un contrato propio.",
            },
        ],
    }),

    // ── Full Stack ──────────────────────────────────────────────────────────
    defineTrack({
        id: "full-stack",
        title: "Full Stack (Next.js + FastAPI)",
        description: "Una aplicación completa con interfaz en Next.js, API y base de datos, con pruebas, un repositorio presentable y una demo desplegada.",
        referenceUrl: "https://roadmap.sh/full-stack",
        secondaryReferences: [
            { label: "Next.js", url: "https://roadmap.sh/nextjs" },
            { label: "TypeScript", url: "https://roadmap.sh/typescript" },
            { label: "Python", url: "https://roadmap.sh/python" },
            { label: "Docker", url: "https://roadmap.sh/docker" },
        ],
        phases: [
            {
                id: "interfaz",
                title: "Interfaz con Next.js y TypeScript",
                objective: "Una interfaz tipada que se comporta bien cuando los datos tardan, faltan o fallan.",
                milestones: [
                    "Publicar una app Next.js con tres rutas y navegación compartida",
                    "Tipar props y datos sin usar any y pasar tsc en modo estricto",
                    "Mostrar una lista con datos del servidor y sus estados de carga, vacío y error",
                    "Hacerla usable en móvil y con teclado, comprobando contraste y foco",
                ],
                skills: ["next.js", "react", "typescript"],
                practicaGeneral: { idea: "Añadir una página nueva a Xiimalab con sus tres estados (carga, vacío y error).", portfolioTitle: "Xiimalab" },
            },
            {
                id: "api",
                title: "API y base de datos",
                objective: "Un backend con datos persistentes, validación y documentación que otros puedan usar, en FastAPI o en los route handlers de Next.js.",
                milestones: [
                    "Exponer una API con cuatro endpoints (crear, leer, actualizar y borrar) que validan su entrada",
                    {
                        text: "Persistir el estado del usuario en una base de datos con migraciones versionadas",
                        appliesTo: ["Xiimalab", "AURA", "Regen-Buddy"],
                    },
                    "Publicar la documentación de la API generada desde su esquema",
                    "Cubrir los endpoints con tests que corren sin red",
                    {
                        text: "Sustituir un archivo JSON o localStorage por consultas a la base de datos, con un respaldo si no responde",
                        appliesTo: ["AURA", "Rastreador", "Xiimalab"],
                    },
                ],
                skills: ["fastapi", "python", "next.js", "typescript", "data"],
                practicaGeneral: { idea: "Añadir un endpoint nuevo, con sus tests, a la API de Rastreador.", portfolioTitle: "Rastreador · Londrina Radar Comercial" },
                resuelve: [{ need: "Persistencia en base de datos", projects: ["Xiimalab", "AURA", "Regen-Buddy", "Rastreador"] }],
            },
            {
                id: "integracion",
                title: "Unir frontend y backend",
                objective: "Que las dos mitades hablen con tipos compartidos y aguanten la caída de la otra.",
                milestones: [
                    "Consumir la API desde Next.js con tipos compartidos o generados",
                    {
                        text: "Añadir inicio de sesión, o una wallet verificada con firma, y proteger una ruta y un endpoint",
                        appliesTo: ["Xiimalab", "AURA", "RedimensionAI"],
                    },
                    "Seguir mostrando datos de respaldo cuando el backend no responde",
                    "Añadir caché a una consulta lenta y publicar la mejora medida",
                    {
                        text: "Consumir una API de terceros respetando su límite de peticiones y distinguiendo sus errores",
                        appliesTo: ["Xiimalab", "Pulsar Radar", "Rastreador"],
                    },
                ],
                skills: ["next.js", "fastapi", "typescript", "python"],
                resuelve: [
                    { need: "Autenticación y wallet", projects: ["Xiimalab", "AURA", "RedimensionAI"] },
                    { need: "APIs de terceros con límites y errores", projects: ["Xiimalab", "Pulsar Radar", "Rastreador"] },
                ],
                practicaGeneral: { idea: "Estudiar cómo el agregador de hackatones de Xiimalab sigue funcionando sin el backend.", portfolioTitle: "Xiimalab" },
            },
            {
                id: "calidad",
                title: "Calidad y repo presentable",
                objective: "Detectar los problemas antes que los usuarios y dejar el repositorio entendible para quien llega de fuera.",
                milestones: [
                    {
                        text: "Escribir tests del flujo principal que corren sin red",
                        appliesTo: ["Xiimalab", "AURA", "RedimensionAI", "Regen-Buddy"],
                    },
                    "Medir el rendimiento de la página principal y corregir el peor indicador",
                    "Registrar los errores del cliente y del servidor en un servicio consultable",
                    {
                        text: "Publicar un README con la arquitectura, cómo ejecutarlo y las decisiones tomadas",
                        appliesTo: ["AURA", "RedimensionAI"],
                    },
                    {
                        text: "Configurar un workflow que corre lint, tipos, tests y build en cada push",
                        appliesTo: ["Xiimalab", "AURA", "RedimensionAI", "Regen-Buddy"],
                    },
                    {
                        text: "Añadir un LICENSE y un ROADMAP.md con las tareas en formato «- [ ]»",
                        appliesTo: ["AURA", "RedimensionAI", "Regen-Buddy", "Rastreador", "Xiimalab"],
                    },
                ],
                skills: ["typescript", "python", "devops", "analytics"],
                practicaGeneral: { idea: "Añadir a Xiimalab el workflow de GitHub Actions con lint, tipos y build.", portfolioTitle: "Xiimalab" },
                resuelve: [
                    { need: "Tests y CI", projects: ["Xiimalab", "AURA", "RedimensionAI", "Regen-Buddy"] },
                    { need: "Repo presentable (README, LICENSE, ROADMAP)", projects: ["AURA", "RedimensionAI", "Regen-Buddy", "Rastreador", "Xiimalab"] },
                ],
            },
            {
                id: "docker-despliegue",
                title: "Docker y despliegue",
                objective: "Que cualquiera pueda levantar el proyecto con un comando y que tenga una demo pública que avisa cuando cae.",
                milestones: [
                    "Levantar frontend, API y base de datos con un solo comando de Docker Compose",
                    "Desplegar el frontend y la API en servicios distintos, cada uno con sus variables de entorno",
                    // El hito 3 (workflow de CI) pasó a «Calidad y repo presentable»
                    { n: 4, text: "Añadir un endpoint de salud y una alerta que avise cuando falla" },
                ],
                skills: ["docker", "devops", "next.js", "fastapi"],
                practicaGeneral: { idea: "Publicar la demo de Rastreador: frontend y API desplegados con su base de datos.", portfolioTitle: "Rastreador · Londrina Radar Comercial" },
                resuelve: [{ need: "Despliegue con demo pública", projects: ["AURA", "Rastreador", "Xiimalab"] }],
            },
        ],
    }),

    // ── MLOps ───────────────────────────────────────────────────────────────
    defineTrack({
        id: "mlops",
        title: "MLOps",
        description: "Automatizar los datos y llevar un modelo del notebook a un servicio que se reentrena, se despliega y se vigila solo.",
        referenceUrl: "https://roadmap.sh/mlops",
        phases: [
            {
                id: "pipeline",
                title: "Pipeline de datos programado",
                objective: "Convertir un script de datos que se lanza a mano en un proceso que corre solo, se detiene si los datos cambian y avisa si falla.",
                milestones: [
                    "Convertir un script o notebook manual en un pipeline con pasos separados de extracción, transformación y carga",
                    "Añadir una validación de datos que detiene el pipeline si cambia el esquema",
                    "Ejecutar el pipeline completo dentro de Docker",
                    {
                        text: "Programar su ejecución automática, guardar los artefactos de cada corrida y avisar con una alerta si falla",
                        appliesTo: ["Rastreador", "Xiimalab"],
                    },
                ],
                skills: ["python", "data", "docker", "devops"],
                practicaGeneral: { idea: "Convertir en pipeline el ETL de datos de Rastreador.", portfolioTitle: "Rastreador · Londrina Radar Comercial" },
                resuelve: [{ need: "Pipeline de datos programado", projects: ["Rastreador", "Xiimalab"] }],
            },
            {
                id: "experimentos",
                title: "Experimentos reproducibles",
                objective: "Poder reconstruir cualquier resultado pasado: mismos datos, mismo código, mismo número.",
                milestones: [
                    "Entrenar un modelo de referencia con un script que fija semillas y dependencias",
                    "Versionar datos y modelo de forma que se pueda reconstruir un resultado anterior",
                    "Registrar parámetros y métricas de cinco experimentos en un tracker",
                    "Publicar la comparación de los experimentos con la conclusión a la que llevan",
                ],
                skills: ["ml", "machine learning", "python", "data"],
                practicaGeneral: { idea: "Un modelo que predice el match de una hackatón a partir de sus etiquetas, con los datos del agregador." },
            },
            {
                id: "servir",
                title: "Servir el modelo",
                objective: "Ofrecer predicciones por API con números de latencia conocidos y vuelta atrás posible.",
                milestones: [
                    "Exponer el modelo detrás de una API que valida su entrada",
                    "Medir latencia y capacidad con una prueba de carga y publicar los números",
                    "Desplegar una versión nueva sin cortar el servicio y volver a la anterior con un comando",
                    "Añadir predicción por lotes para procesar un archivo completo",
                ],
                skills: ["fastapi", "docker", "ml", "python"],
                practicaGeneral: { idea: "Publicar el modelo de AURA detrás de una API con su prueba de carga.", portfolioTitle: "AURA" },
            },
            {
                id: "ci-cd",
                title: "CI/CD para modelos",
                objective: "Que un cambio en el código o en los datos llegue a producción solo si mejora lo que hay.",
                milestones: [
                    "Configurar un workflow que corre tests de código y de datos en cada cambio",
                    "Reentrenar automáticamente cuando cambian los datos y publicar el modelo solo si supera al actual",
                    "Guardar cada modelo en un registro con su versión y sus métricas",
                    "Describir la infraestructura como código en el repo",
                ],
                skills: ["devops", "docker", "ml", "machine learning"],
                practicaGeneral: { idea: "Reentrenar cada semana el modelo de match con las hackatones nuevas del agregador." },
            },
            {
                id: "monitoreo",
                title: "Monitoreo y deriva",
                objective: "Enterarse de que el modelo empeora antes de que lo note quien lo usa.",
                milestones: [
                    "Registrar las predicciones de producción junto con sus entradas",
                    "Detectar deriva de datos con una prueba que dispara una alerta",
                    "Publicar un panel con calidad del modelo, latencia y coste",
                    "Simular una degradación y documentar paso a paso cómo se respondió",
                ],
                skills: ["analytics", "data", "ml", "devops"],
                practicaGeneral: { idea: "Un panel que compara el match predicho con las hackatones a las que realmente aplicaste." },
            },
        ],
    }),
];

export function getTrack(id: string): Track | undefined {
    return TRACKS.find((t) => t.id === id);
}

export function countMilestones(track: Track): number {
    return track.phases.reduce((sum, phase) => sum + phase.milestones.length, 0);
}
