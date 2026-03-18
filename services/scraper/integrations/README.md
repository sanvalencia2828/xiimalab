# Xiimalab Scraper Integrations

Este directorio contiene las integraciones para hacer scraping de diferentes plataformas de hackathones.

## Integraciones Disponibles

### 1. Devfolio API Integration (`devfolio_engine.py`)
- **Tipo**: API JSON-RPC
- **Fuente**: Devfolio MCP API
- **Endpoint**: `https://mcp.devfolio.co/mcp`
- **Datos extraídos**: Título, premios, fecha límite, etiquetas, URL
- **Método**: Llamadas HTTP POST con JSON-RPC 2.0

### 2. DoraHacks API Integration (`dorahacks_api_engine.py`)
- **Tipo**: API REST
- **Fuente**: DoraHacks API oficial
- **Endpoint**: `https://api.dorahacks.io`
- **Datos extraídos**: Nombre, premios, fecha límite, etiquetas, URL
- **Método**: Llamadas HTTP GET

### 3. Devpost Integration (`devpost_engine.py`)
- **Tipo**: Web Scraping (Playwright)
- **Fuente**: Sitio web de Devpost
- **URL**: `https://devpost.com/hackathons`
- **Datos extraídos**: Título, premios, fecha límite, etiquetas, URL
- **Método**: Navegación automática con scroll infinito

### 4. DoraHacks Legacy Integration (`../scraper.py`)
- **Tipo**: Web Scraping (Playwright)
- **Fuente**: Sitio web de DoraHacks
- **URL**: `https://dorahacks.io/hackathon`
- **Datos extraídos**: Título, premios, fecha límite, etiquetas, URL
- **Método**: Navegación automática con técnicas anti-detección

## Arquitectura

```
scraper/
├── scraper.py                 # Orchestrator principal
├── integrations/              # Directorio de integraciones
│   ├── __init__.py           # Exporta todas las integraciones
│   ├── devfolio_engine.py    # Integración con Devfolio API
│   ├── dorahacks_api_engine.py # Integración con DoraHacks API
│   └── devpost_engine.py     # Integración con Devpost (web scraping)
├── parser.py                 # Parser de datos (compartido)
└── requirements.txt          # Dependencias
```

## Cómo Agregar una Nueva Integración

1. Crear un nuevo archivo en `integrations/` siguiendo el patrón existente
2. Implementar las funciones:
   - `scrape_[platform]_hackathons()` - Extrae los datos
   - `upsert_[platform]_hackathons()` - Guarda en la base de datos
   - `run_[platform]_job()` - Punto de entrada principal
3. Actualizar `integrations/__init__.py` para exportar la nueva integración
4. Agregar la integración al orchestrator en `scraper.py`

## Requisitos

- Python 3.8+
- Dependencias listadas en `requirements.txt`
- Variables de entorno configuradas en `.env`

## Ejecución Individual

Cada integración puede ejecutarse individualmente:

```bash
# Ejecutar solo Devfolio
python integrations/devfolio_engine.py

# Ejecutar solo DoraHacks API
python integrations/dorahacks_api_engine.py

# Ejecutar solo Devpost
python integrations/devpost_engine.py
```