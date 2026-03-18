"""
Xiimalab Scraper Integrations Package
Exports all available scraper modules for the orchestrator.
"""

# Legacy DoraHacks Playwright scraper (still used)
from .. import scraper as dorahacks_legacy

# Modern API-based integrations
from . import devfolio_engine as devfolio
from . import dorahacks_api_engine as dorahacks_api
from . import devpost_engine as devpost

__all__ = [
    "devfolio",
    "dorahacks_api",
    "dorahacks_legacy",
    "devpost"
]