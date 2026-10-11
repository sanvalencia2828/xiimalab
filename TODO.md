# TODO

## Avance de proyectos (`lib/projects/progress.ts`)

- [ ] Cualquier 403 de GitHub se reporta como "Límite de la API de GitHub alcanzado". Distinguir el límite real (cabecera `x-ratelimit-remaining: 0`) de otros 403 (repo bloqueado, token sin permisos).
- [ ] `raw()` pide `raw.githubusercontent.com` sin token, así que en repos privados el README y el roadmap vuelven vacíos aunque `GITHUB_TOKEN` tenga acceso. Enviar el token o leer el contenido por la API de GitHub.

## Avance de los tracks (`hooks/useLearningProgress.ts`)

- [ ] El avance de los tracks (hitos marcados y su fecha) se guarda en `localStorage`, así que no se comparte entre dispositivos ni navegadores. Moverlo a Supabase para sincronizarlo, y con él la acción del logro de match (`lib/hackathons/actions.ts`); el dashboard podrá entonces leerlo en el servidor sin que el cliente lo envíe.
- [ ] Los datos de Mi Perfil (nombre, bio, foto y enlaces) también se guardan en `localStorage` (`hooks/useProfile.ts`, clave `xiimalab_profile`). Moverlos a Supabase junto con el avance de los tracks.

## Wallets (`components/settings/SettingsClient.tsx`)

- [ ] No hay integración con Freighter: la wallet Stellar se vincula pegando la clave pública, sin comprobar que sea tuya. Añadir "Conectar con Freighter" (`@stellar/freighter-api`) y pedir la firma de un mensaje para verificar la propiedad.
- [ ] `@stellar/stellar-sdk` está fijado en la v13: la v17 usa sintaxis (`#campo in obj`) que el webpack de Next 14.2 no compila. Volver a probar la última versión al subir de versión mayor de Next.

## Snapshots en Supabase (`scripts/snapshot.ts`)

- [ ] El upsert, la migración (`supabase/migrations/`) y la lectura de la campana desde Supabase no se han ejecutado contra una base real: solo se probó `npm run snapshot -- --dry-run`. Tras aplicar la migración y crear los secretos, lanzar el workflow a mano y comprobar las filas.
- [ ] El match de los bounties se calcula solo con el título (Superteam no da etiquetas), así que casi nunca superan el 50 % que exige la campana.

## Despliegue

- [ ] Vercel creó despliegues de producción desde `feat/skills-market` sin que la rama se fusionara a `main` (2026-10-11). Revisar en Vercel → Settings → Git cuál es la rama de producción.
