"""
rate_limit.py

Single shared slowapi Limiter — imported by main.py (global wiring) and by
any router module that wants a stricter per-route limit than the default.
Kept in its own module (rather than services/clients.py) to avoid a circular
import between main.py and the routers it includes.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Keyed by client IP. Individual routes override this with @limiter.limit(...)
# for endpoints that are expensive to abuse (anything calling OpenAI/Fal.ai/Cala).
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
