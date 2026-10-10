# TODO

## Avance de proyectos (`lib/projects/progress.ts`)

- [ ] Cualquier 403 de GitHub se reporta como "Límite de la API de GitHub alcanzado". Distinguir el límite real (cabecera `x-ratelimit-remaining: 0`) de otros 403 (repo bloqueado, token sin permisos).
- [ ] `raw()` pide `raw.githubusercontent.com` sin token, así que en repos privados el README y el roadmap vuelven vacíos aunque `GITHUB_TOKEN` tenga acceso. Enviar el token o leer el contenido por la API de GitHub.
