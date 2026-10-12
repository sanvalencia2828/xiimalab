/**
 * lib/learning/practices-data.ts
 * Prácticas escritas a mano: qué hacer en cada proyecto del portafolio para
 * practicar una fase. Cubren las fases de más impacto; el resto de fases y de
 * proyectos reciben una práctica de la IA o la general (lib/learning/practices.ts).
 *
 * Cada una parte de lo que hay hoy en el repositorio del proyecto (README,
 * árbol de archivos y código): si el repo cambia, revísala.
 *
 *   • La clave es `<track>:<fase>`; `hitos` son los números de los hitos de
 *     la fase que la práctica demuestra.
 *   • `tipo` es "Nueva función" cuando el proyecto no usa hoy esa tecnología.
 *   • Pulsar Radar es de Miguel Ángel: sus prácticas son propuestas de contribución.
 */
import type { Effort, PracticeType } from "./tracks";

export interface ManualPractice {
    proyecto: string;
    titulo: string;
    tipo: PracticeType;
    queHacer: string;
    primerosPasos: [string, string, string];
    hitos: number[];
    esfuerzo: Effort;
}

export const MANUAL_PRACTICES: Record<string, ManualPractice[]> = {
    // ── AI Engineer ─────────────────────────────────────────────────────────
    "ai-engineer:modelos-por-api": [
        {
            proyecto: "Xiimalab",
            titulo: "Añadir la respuesta en streaming al análisis de match (/api/match)",
            tipo: "Mejora",
            queHacer:
                "El análisis de match ya valida la salida del modelo, la guarda en caché y limita las peticiones por IP. Falta mostrarla a medida que llega: primero el porcentaje y al final la recomendación.",
            primerosPasos: [
                "Devolver eventos SSE desde /api/match cuando la respuesta no está en caché",
                "Leer el stream en el modal «Analizar match» y pintar los campos parciales",
                "Añadir un test que comprueba que una respuesta inválida no se guarda en caché",
            ],
            hitos: [3, 4],
            esfuerzo: "M",
        },
        {
            proyecto: "Regen-Buddy",
            titulo: "Hacer que api/chat.js devuelva JSON validado, con la clave en el servidor y un límite por usuario",
            tipo: "Mejora",
            queHacer:
                "La mascota ya conversa con la API de OpenAI desde api/chat.js. Si la respuesta llega como JSON validado (mensaje y cambios de felicidad y energía), el frontend deja de interpretar texto libre y un fallo del modelo no rompe el chat.",
            primerosPasos: [
                "Definir el esquema de la respuesta (mensaje y cambios de estado) y rechazar la que no lo cumple",
                "Comprobar que la clave de OpenAI solo se lee en api/chat.js y nunca llega al navegador",
                "Limitar las peticiones por IP y devolver un mensaje propio al superar el límite",
            ],
            hitos: [1, 4],
            esfuerzo: "S",
        },
        {
            proyecto: "Rastreador",
            titulo: "Añadir un endpoint que resume un polo comercial con un LLM a partir de /api/clusters/emergentes",
            tipo: "Nueva función",
            queHacer:
                "La API ya calcula los cinco polos comerciales con sus totales. Un endpoint nuevo en api.py puede pasar esos datos a un modelo y devolver un resumen legible del polo, validado contra un esquema para que el panel de detalle lo pinte sin sorpresas.",
            primerosPasos: [
                "Crear GET /api/clusters/{id}/resumen en api.py, que envía al modelo los totales del polo",
                "Validar la respuesta contra un esquema (titular, tres rasgos y sector dominante)",
                "Mostrar el resumen en el panel de detalle del polo",
            ],
            hitos: [1],
            esfuerzo: "M",
        },
        {
            proyecto: "RedimensionAI",
            titulo: "Sugerir el recorte y el texto alternativo de cada imagen con un modelo de visión",
            tipo: "Nueva función",
            queHacer:
                "Hoy el redimensionado se hace en el navegador, sin ningún modelo. Una ruta de servidor puede enviar la imagen a un modelo de visión y devolver en JSON la zona que conviene conservar y un texto alternativo para cada plataforma.",
            primerosPasos: [
                "Crear una ruta de servidor que envía la imagen al modelo y devuelve JSON (zona de recorte y texto alternativo)",
                "Validar el JSON y aplicar el recorte sugerido en ImageResizer",
                "Dejar la clave solo en el servidor y limitar las peticiones por usuario",
            ],
            hitos: [1, 4],
            esfuerzo: "M",
        },
    ],
    "ai-engineer:prompts-fiables": [
        {
            proyecto: "Xiimalab",
            titulo: "Crear el conjunto de pruebas del prompt de match y compararlo entre dos modelos",
            tipo: "Mejora",
            queHacer:
                "El prompt de match vive en lib/match/ai.ts y hoy solo se comprueba a mano. Con casos fijos y un script que los puntúa, cada cambio del prompt o del modelo se puede medir antes de publicarlo.",
            primerosPasos: [
                "Escribir 15 casos (skills, hackatón y rango de match esperado) en un archivo del repo",
                "Crear un script que ejecuta el prompt sobre los casos y puntúa cada respuesta",
                "Publicar en el README la tabla con el resultado de dos modelos",
            ],
            hitos: [2, 3],
            esfuerzo: "M",
        },
        {
            proyecto: "Regen-Buddy",
            titulo: "Versionar los prompts de la mascota y probarlos con 15 conversaciones",
            tipo: "Mejora",
            queHacer:
                "La personalidad de Regenmon está en el prompt de api/chat.js y api/evaluate.js decide los cambios de estado. Sacando ambos prompts a archivos versionados se puede comprobar con casos fijos que el tono cambia de verdad con la energía y la felicidad.",
            primerosPasos: [
                "Mover los prompts de api/chat.js y api/evaluate.js a archivos propios, con una nota de cada cambio",
                "Escribir 15 mensajes de prueba con el estado de la mascota y la reacción esperada",
                "Crear un script que puntúa cada versión del prompt contra esos casos",
            ],
            hitos: [1, 2],
            esfuerzo: "S",
        },
    ],

    // ── AI Agents ───────────────────────────────────────────────────────────
    "ai-agents:herramientas": [
        {
            proyecto: "Rastreador",
            titulo: "Crear un agente que responde preguntas sobre polos comerciales con /api/heatmap y /api/clusters/emergentes",
            tipo: "Nueva función",
            queHacer:
                "La API ya expone la densidad de comercios y el ranking de polos. Un agente con esos dos endpoints como herramientas puede contestar preguntas como «¿dónde hay más gastronomía?» con datos reales en lugar de inventarlos.",
            primerosPasos: [
                "Definir las dos herramientas con su esquema de entrada (sector y polo)",
                "Implementar el bucle completo: pregunta, llamada a la herramienta, resultado y respuesta",
                "Exponerlo en un endpoint nuevo de api.py y probarlo con tres preguntas reales",
            ],
            hitos: [1, 2, 4],
            esfuerzo: "M",
        },
        {
            proyecto: "Xiimalab",
            titulo: "Crear un asistente que responde «¿a qué hackatón me apunto esta semana?» consultando el agregador",
            tipo: "Nueva función",
            queHacer:
                "El agregador de /api/hackathons ya une Devpost, DoraHacks y Devfolio y calcula el match. Expuesto como herramienta, un asistente puede filtrar por etiqueta y cierre y recomendar una convocatoria explicando por qué.",
            primerosPasos: [
                "Exponer /api/hackathons como herramienta, con filtros de etiqueta y fecha de cierre",
                "Añadir una segunda herramienta que devuelve las skills del perfil",
                "Devolver el error al modelo cuando el agregador no responde y comprobar que lo explica",
            ],
            hitos: [1, 3, 4],
            esfuerzo: "M",
        },
        {
            proyecto: "Pulsar Radar",
            titulo: "Crear un asistente que explica por qué un token tiene ese potencial y ese riesgo",
            tipo: "Nueva función",
            queHacer:
                "El radar ya calcula dos puntuaciones con su detalle. Un agente con dos herramientas (la lista del radar y la ficha de un token) puede responder «¿cuál es el de menor riesgo ahora?» sin salirse de los datos. Proponlo como contribución al repo de Miguel Ángel.",
            primerosPasos: [
                "Definir las herramientas «listar tokens» y «ficha de un token» con su esquema de entrada",
                "Implementar el bucle completo y mostrar qué herramienta se usó en cada respuesta",
                "Añadir al aviso del proyecto que las respuestas no son una recomendación de compra",
            ],
            hitos: [1, 2],
            esfuerzo: "M",
        },
    ],
    "ai-agents:memoria": [
        {
            proyecto: "Regen-Buddy",
            titulo: "Guardar las memorias de Regenmon en una base de datos en lugar de localStorage",
            tipo: "Mejora",
            queHacer:
                "La mascota ya detecta datos personales y los recuerda, pero solo en el navegador donde se creó. Con las memorias en una base de datos, Regenmon te reconoce desde cualquier dispositivo.",
            primerosPasos: [
                "Crear una tabla de memorias por usuario y una ruta api/memory.js para leerlas y guardarlas",
                "Cargar las memorias al abrir el chat en otro navegador y comprobar que recuerda tu nombre",
                "Resumir el historial al superar un límite de tokens sin perder las memorias",
            ],
            hitos: [3, 4],
            esfuerzo: "M",
        },
        {
            proyecto: "Xiimalab",
            titulo: "Dar memoria al asistente de hackatones: que recuerde las convocatorias que descartaste",
            tipo: "Nueva función",
            queHacer:
                "Parte del asistente de la fase de herramientas. Si guarda en Supabase qué convocatorias descartaste y por qué, en la siguiente sesión deja de proponerlas y afina la recomendación.",
            primerosPasos: [
                "Crear en Supabase una tabla de memorias por wallet",
                "Guardar cada convocatoria descartada con su motivo y leerlas al iniciar una conversación",
                "Comprobar en una sesión nueva que no vuelve a proponer una descartada",
            ],
            hitos: [3],
            esfuerzo: "M",
        },
    ],

    // ── Full Stack ──────────────────────────────────────────────────────────
    "full-stack:api": [
        {
            proyecto: "Xiimalab",
            titulo: "Guardar en Supabase el avance de los tracks, el perfil y las certificaciones",
            tipo: "Mejora",
            queHacer:
                "Hoy viven en localStorage, así que no se comparten entre dispositivos y el servidor depende de que el cliente los envíe. Es una tarea pendiente del ROADMAP.md y del TODO.md del proyecto.",
            primerosPasos: [
                "Crear la migración con las tablas de avance y de perfil, por wallet",
                "Leer y escribir el avance desde server actions, con localStorage como respaldo si Supabase no responde",
                "Añadir tests de esas acciones que corren sin red",
            ],
            hitos: [2, 4, 5],
            esfuerzo: "L",
        },
        {
            proyecto: "AURA",
            titulo: "Sustituir users.json por una base de datos con Drizzle",
            tipo: "Mejora",
            queHacer:
                "Los usuarios se guardan en un archivo users.json con fs, que no sobrevive en un despliegue serverless. drizzle-orm ya está entre las dependencias: faltan el esquema, las migraciones y cambiar src/lib/db/users.ts.",
            primerosPasos: [
                "Definir el esquema de usuarios y generar la primera migración",
                "Reescribir createUser, getUserByEmail y getUserById contra la base de datos",
                "Añadir un test que registra un usuario y lo recupera",
            ],
            hitos: [2, 5],
            esfuerzo: "M",
        },
        {
            proyecto: "Regen-Buddy",
            titulo: "Persistir la mascota y sus mensajes en una base de datos",
            tipo: "Nueva función",
            queHacer:
                "La mascota, sus estadísticas y el historial se guardan en localStorage. Una ruta nueva junto a api/chat.js puede leerlos y guardarlos en una base de datos, dejando localStorage solo como respaldo.",
            primerosPasos: [
                "Crear las tablas de mascota y mensajes y una ruta api/pet.js con leer y guardar, validando su entrada",
                "Sustituir en index.html las lecturas de localStorage por llamadas a esa ruta, con localStorage como respaldo",
                "Comprobar que la mascota aparece igual al abrirla en otro navegador",
            ],
            hitos: [1, 2, 5],
            esfuerzo: "M",
        },
        {
            proyecto: "Rastreador",
            titulo: "Añadir a api.py un endpoint de comercios por polo, con sus tests",
            tipo: "Mejora",
            queHacer:
                "La API tiene tres endpoints de lectura. Uno nuevo que liste los comercios de un polo, con el sector validado, se puede probar con londrina_businesses.json sin levantar PostGIS y queda documentado en /docs.",
            primerosPasos: [
                "Crear GET /api/clusters/{id}/comercios con el filtro de sector validado",
                "Añadir tests del endpoint que corren con el JSON de respaldo, sin base de datos",
                "Revisar que aparece en /docs con su esquema de respuesta",
            ],
            hitos: [3, 4],
            esfuerzo: "S",
        },
    ],
    "full-stack:integracion": [
        {
            proyecto: "Xiimalab",
            titulo: "Verificar la wallet con Freighter y usarla en /staking en lugar del userId fijo",
            tipo: "Mejora",
            queHacer:
                "La wallet Stellar se vincula pegando la clave pública, sin comprobar que sea tuya, y /staking usa un userId fijo. Pidiendo la firma de un mensaje con Freighter, la wallet verificada pasa a ser la identidad del usuario.",
            primerosPasos: [
                "Añadir «Conectar con Freighter» en Configuración y pedir la firma de un mensaje",
                "Comprobar la firma en el servidor y guardar la sesión",
                "Sustituir el userId fijo de /staking por la wallet verificada",
            ],
            hitos: [2],
            esfuerzo: "M",
        },
        {
            proyecto: "AURA",
            titulo: "Revisar que todas las rutas de posts, cursos y suscripción exigen la sesión de NextAuth",
            tipo: "Mejora",
            queHacer:
                "AURA ya tiene registro e inicio de sesión con NextAuth, y /api/proof comprueba la sesión. Falta asegurar que el resto de rutas de src/app/api y las páginas del panel hacen lo mismo.",
            primerosPasos: [
                "Listar las rutas de src/app/api y marcar cuáles deben exigir sesión",
                "Añadir la comprobación a las que falten y un middleware para las páginas del panel",
                "Añadir un test que recibe 401 al pedir una ruta protegida sin sesión",
            ],
            hitos: [2],
            esfuerzo: "S",
        },
        {
            proyecto: "RedimensionAI",
            titulo: "Iniciar sesión con la wallet: firmar un mensaje y desbloquear funciones con ella",
            tipo: "Nueva función",
            queHacer:
                "El proyecto ya conecta una wallet con Reown AppKit y wagmi, pero conectar no demuestra de quién es. Firmando un mensaje y verificándolo en el servidor, la wallet sirve como inicio de sesión.",
            primerosPasos: [
                "Pedir la firma de un mensaje después de conectar con ConnectButton",
                "Verificar la firma en una ruta de servidor con viem y crear la sesión",
                "Proteger una función del redimensionador detrás de esa sesión",
            ],
            hitos: [2],
            esfuerzo: "M",
        },
        {
            proyecto: "Pulsar Radar",
            titulo: "Respetar el límite de DexScreener y distinguir sus errores en la interfaz",
            tipo: "Mejora",
            queHacer:
                "El radar se actualiza solo con datos de DexScreener. Conviene medir cuántas peticiones hace cada refresco y distinguir en pantalla entre límite alcanzado, sin conexión y respuesta inválida, mostrando mientras tanto los últimos datos buenos. Proponlo como contribución al repo de Miguel Ángel.",
            primerosPasos: [
                "Medir las peticiones de cada refresco y ajustarlas al límite documentado de la API",
                "Mostrar un aviso distinto para límite alcanzado, sin conexión y respuesta inválida",
                "Seguir mostrando los últimos datos válidos, con su hora, cuando la API falla",
            ],
            hitos: [3, 5],
            esfuerzo: "S",
        },
        {
            proyecto: "Rastreador",
            titulo: "Geocodificar con Nominatim sin superar su límite de peticiones",
            tipo: "Mejora",
            queHacer:
                "enriquecer_lojas.py completa las coordenadas de los comercios con Nominatim, un servicio público con un límite estricto. Con una espera entre peticiones, caché de direcciones ya resueltas y errores separados, el enriquecimiento se puede relanzar sin riesgo de bloqueo.",
            primerosPasos: [
                "Limitar enriquecer_lojas.py a una petición por segundo, con un User-Agent propio",
                "Guardar en caché las direcciones ya resueltas para no repetirlas",
                "Reintentar solo los errores temporales y registrar los definitivos en un archivo",
            ],
            hitos: [4, 5],
            esfuerzo: "S",
        },
    ],
    "full-stack:calidad": [
        {
            proyecto: "Xiimalab",
            titulo: "Añadir el workflow de GitHub Actions con lint, tipos, tests y build",
            tipo: "Mejora",
            queHacer:
                "El repo ya tiene tests con vitest y un workflow de snapshots, pero nada corre lint, tsc y build en cada push. Es una tarea pendiente de la fase 5 de su ROADMAP.md, junto con el LICENSE.",
            primerosPasos: [
                "Crear el workflow que corre npm run lint, tsc --noEmit, npm test y npm run build en cada push",
                "Añadir tests del agregador de hackatones con respuestas grabadas, sin red",
                "Añadir un archivo LICENSE",
            ],
            hitos: [1, 5, 6],
            esfuerzo: "S",
        },
        {
            proyecto: "AURA",
            titulo: "Escribir el README de AURA y dejar el repo con tests, CI y licencia",
            tipo: "Mejora",
            queHacer:
                "El repositorio no tiene README, tests, workflow ni licencia, así que quien llega no sabe qué hace ni cómo levantarlo. Es lo que más sube su avance medido.",
            primerosPasos: [
                "Escribir un README con qué hace, cómo ejecutarlo y qué variables de entorno necesita",
                "Añadir tests del registro y del inicio de sesión que corren sin red",
                "Crear el workflow con lint, tipos, tests y build, y añadir LICENSE y ROADMAP.md",
            ],
            hitos: [1, 4, 5, 6],
            esfuerzo: "M",
        },
        {
            proyecto: "RedimensionAI",
            titulo: "Sustituir el README de plantilla y añadir tests y CI",
            tipo: "Mejora",
            queHacer:
                "El README es el de create-next-app y no explica el proyecto; tampoco hay tests, workflow ni licencia. Con un README propio y un test del redimensionado, la demo desplegada queda respaldada por un repo presentable.",
            primerosPasos: [
                "Escribir un README propio: qué redimensiona, para qué plataformas, la demo y cómo ejecutarlo",
                "Añadir un test de la función de redimensionado de ImageResizer",
                "Crear el workflow con lint, tipos y build, y añadir LICENSE y ROADMAP.md",
            ],
            hitos: [1, 4, 5, 6],
            esfuerzo: "S",
        },
        {
            proyecto: "Regen-Buddy",
            titulo: "Añadir tests a api/chat.js y api/evaluate.js y un workflow que los corre",
            tipo: "Mejora",
            queHacer:
                "El proyecto son nueve archivos sin tests ni CI. Las dos funciones de api/ concentran la lógica y se pueden probar simulando la respuesta de OpenAI, sin gastar tokens.",
            primerosPasos: [
                "Añadir tests de las dos funciones con la respuesta de OpenAI simulada",
                "Crear un workflow que corre los tests en cada push",
                "Añadir LICENSE y un ROADMAP.md con lo que falta",
            ],
            hitos: [1, 5, 6],
            esfuerzo: "S",
        },
        {
            proyecto: "Rastreador",
            titulo: "Añadir LICENSE y ROADMAP.md, y ampliar los tests de la API",
            tipo: "Mejora",
            queHacer:
                "El repo ya tiene tests y un workflow, pero el README solo dice «fines educativos» sin una licencia, y no hay ROADMAP.md, así que su avance se mide solo por preparación.",
            primerosPasos: [
                "Añadir un archivo LICENSE y enlazarlo desde el README",
                "Crear ROADMAP.md con las tareas pendientes en formato «- [ ]»",
                "Añadir tests de /api/heatmap y /api/clusters/emergentes con el JSON de respaldo",
            ],
            hitos: [1, 6],
            esfuerzo: "S",
        },
    ],
    "full-stack:docker-despliegue": [
        {
            proyecto: "Rastreador",
            titulo: "Publicar la demo de Rastreador: frontend y API desplegados con su base de datos",
            tipo: "Mejora",
            queHacer:
                "El proyecto se levanta con Docker Compose y su README explica el despliegue en Vercel, pero no hay una demo pública enlazada. Falta desplegarlo con un PostGIS alojado y vigilar /health.",
            primerosPasos: [
                "Desplegar api.py y el frontend según vercel.json, con DATABASE_URL apuntando a un PostGIS alojado",
                "Comprobar /health y /api/heatmap en la URL pública y enlazar la demo en el README",
                "Configurar una alerta que avise cuando /health falla",
            ],
            hitos: [1, 2, 4],
            esfuerzo: "M",
        },
        {
            proyecto: "AURA",
            titulo: "Publicar una demo de AURA con un endpoint de salud",
            tipo: "Nueva función",
            queHacer:
                "AURA no tiene demo pública. Antes necesita la base de datos de la fase «API y base de datos», porque un archivo en disco no sobrevive en un despliegue serverless.",
            primerosPasos: [
                "Desplegar en Vercel con la base de datos y sus variables de entorno",
                "Añadir /api/health, que comprueba la conexión a la base de datos",
                "Configurar una alerta cuando /api/health falla y enlazar la demo en el README",
            ],
            hitos: [4],
            esfuerzo: "M",
        },
        {
            proyecto: "Xiimalab",
            titulo: "Arreglar el servicio frontend de docker-compose y fijar la rama de producción en Vercel",
            tipo: "Mejora",
            queHacer:
                "El servicio frontend de docker-compose.yml apunta a ./frontend, pero la app se construye desde la raíz con Dockerfile.frontend. En Vercel hubo despliegues de producción desde una rama sin fusionar. Las dos cosas están anotadas como pendientes.",
            primerosPasos: [
                "Cambiar el build del servicio frontend a la raíz del repo con Dockerfile.frontend",
                "Levantar todo con docker compose up y comprobar frontend, API y base de datos",
                "Revisar en Vercel la rama de producción y configurar GITHUB_TOKEN",
            ],
            hitos: [1, 2],
            esfuerzo: "S",
        },
    ],
};
