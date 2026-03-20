# Xiimalab Automation Service

Este servicio contiene herramientas de automatización para Xiimalab:

## Componentes

1. **Snap Engine** (`snap_engine.js`)
   - Captura de pantalla automatizada del dashboard
   - Optimización mediante RedimensionAI
   - Exportación a múltiples formatos sociales

## Instalación

```bash
cd services/automation
npm install
```

## Uso

```bash
# Capturar y optimizar dashboard
npm run snap

# Con URL personalizada
npm run snap -- --url http://localhost:3000 --out ./exports
```

## Configuración

Variables de entorno:
- `DASHBOARD_URL`: URL del dashboard a capturar (por defecto: http://localhost:3000)
- `SNAP_OUTPUT_DIR`: Directorio de salida (por defecto: ./snapshots)
- `REDIMENSION_AI_URL`: URL del microservicio RedimensionAI (por defecto: http://localhost:8001)