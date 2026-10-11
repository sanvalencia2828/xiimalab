# TODO

## Avance de proyectos (`lib/projects/progress.ts`)

- [ ] Cualquier 403 de GitHub se reporta como "Límite de la API de GitHub alcanzado". Distinguir el límite real (cabecera `x-ratelimit-remaining: 0`) de otros 403 (repo bloqueado, token sin permisos).
- [ ] `raw()` pide `raw.githubusercontent.com` sin token, así que en repos privados el README y el roadmap vuelven vacíos aunque `GITHUB_TOKEN` tenga acceso. Enviar el token o leer el contenido por la API de GitHub.

## Avance de los tracks (`hooks/useLearningProgress.ts`)

- [ ] El avance de los tracks (hitos marcados y su fecha) se guarda en `localStorage`, así que no se comparte entre dispositivos ni navegadores. Moverlo a Supabase para sincronizarlo, y con él la acción del logro de match (`lib/hackathons/actions.ts`); el dashboard podrá entonces leerlo en el servidor sin que el cliente lo envíe.
