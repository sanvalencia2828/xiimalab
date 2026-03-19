#!/usr/bin/env python3
"""
test_devfolio_mcp.py — Prueba rápida del cliente MCP Devfolio
Verifica que:
1. La conexión al endpoint MCP funciona
2. Los hackathones se descargan correctamente
3. Normalización de datos funciona
"""
import asyncio
import os
import sys
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Agregar servicios al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "services", "scraper"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "services", "api"))

from devfolio_mcp import DevfolioMCPClient, normalize_devfolio_hackathon

async def test_devfolio_mcp():
    """Prueba el cliente MCP Devfolio."""
    print("🔍 Iniciando test del MCP Devfolio...\n")
    
    api_key = os.environ.get("DEVFOLIO_MCP_API_KEY", "")
    if not api_key:
        print("❌ Error: DEVFOLIO_MCP_API_KEY no configurada en .env")
        return False
    
    print(f"✅ API Key configurada: {api_key[:16]}...\n")
    
    try:
        # Crear cliente
        client = DevfolioMCPClient(api_key)
        print("📡 Conectando al servidor MCP...")
        
        # Inicializar sesión
        init_result = await client.initialize()
        print(f"✅ Inicialización MCP exitosa: {init_result.get('protocolVersion', 'N/A')}\n")
        
        # Listar herramientas disponibles
        print("🔧 Listando herramientas disponibles...")
        tools = await client.list_tools()
        print(f"✅ Herramientas disponibles: {len(tools)}")
        for tool in tools[:5]:  # Mostrar primeras 5
            print(f"   - {tool.get('name', 'N/A')}: {tool.get('description', 'N/A')[:60]}...")
        
        if len(tools) > 5:
            print(f"   ... y {len(tools) - 5} más\n")
        else:
            print()
        
        # Obtener hackathones
        print("📥 Descargando hackathones de Devfolio...")
        hackathons = await client.get_hackathons(status="open")
        print(f"✅ Hackathones obtenidos: {len(hackathons)}\n")
        
        if hackathons:
            print("🎯 Primeros 3 hackathones (raw):")
            for i, h in enumerate(hackathons[:3], 1):
                print(f"\n   {i}. {h.get('name') or h.get('title', 'N/A')}")
                print(f"      ID: {h.get('id', h.get('slug', 'N/A'))}")
                print(f"      Prize: ${h.get('prize_amount', h.get('prize', 0))}")
                print(f"      Deadline: {h.get('deadline', h.get('ends_at', 'N/A'))}")
            
            print("\n\n🔄 Normalizando hackathones...")
            normalized_count = 0
            for raw in hackathones[:3]:
                normalized = normalize_devfolio_hackathon(raw)
                if normalized:
                    normalized_count += 1
                    print(f"\n   ✅ {normalized['title']}")
                    print(f"      ID: {normalized['id']}")
                    print(f"      Prize: ${normalized['prize_pool']}")
                    print(f"      Source: {normalized['source']}")
                else:
                    print(f"   ❌ No se pudo normalizar: {raw.get('name', 'N/A')}")
            
            print(f"\n✅ {normalized_count}/{len(hackathons[:3])} hackathones normalizados correctamente")
        else:
            print("⚠️  No se obtuvieron hackathones del MCP")
        
        # Cerrar cliente
        await client.close()
        print("\n✅ Test completado exitosamente!")
        return True
        
    except Exception as e:
        print(f"\n❌ Error durante el test: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_devfolio_mcp())
    sys.exit(0 if success else 1)
