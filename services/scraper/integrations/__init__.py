"""
Xiimalab Scraper Integrations Package
Exports all available scraper modules for the orchestrator.
"""

# Modern API-based integrations
from . import devfolio_engine as devfolio
from . import dorahacks_api_engine as dorahacks_api
from . import devpost

# Legacy DoraHacks Playwright scraper (still used)
from . import dorahacks as dorahacks_legacy

# Export the legacy scraper as the main dorahacks module for compatibility
dorahacks = dorahacks_legacy

__all__ = [
    "devfolio",
    "dorahacks_api",
    "dorahacks_legacy",
    "dorahacks",
    "devpost"
]