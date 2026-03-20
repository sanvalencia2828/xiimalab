# Backend Issues & Prevention Guide

## Overview
This document provides a quick reference for known backend issues and how to prevent/fix them.

---

## 1. Error Handling Patterns (Common Throughout)

### Issue
Files like `openrouter_client.py`, `aura_client.py`, and others have generic exception handling that masks real errors.

### Pattern Found
```python
except Exception as exc:
    logger.error(f"Error: {exc}")
    return None  # or fallback
```

### Better Pattern
```python
except httpx.HTTPStatusError as exc:
    logger.error("HTTP %s: %s", exc.response.status_code, exc.response.text)
    return None
except httpx.TimeoutException as exc:
    logger.warning("Request timeout, will retry")
    return None
except Exception as exc:
    logger.error("Unexpected error: %s", exc, exc_info=True)
    return None
```

### Files to Review
- `services/api/integrations/openrouter_client.py`
- `services/api/integrations/aura_client.py`
- `services/api/hotmart_bridge.py`
- `engine/staking_manager.py` (lines 176-177, 823-827)

---

## 2. Retry Logic for API Calls

### Issue
Many API integrations don't have robust retry logic. `openrouter_client_improved.py` exists but needs to be used consistently.

### Solution Used
File `services/api/integrations/openrouter_client_improved.py` has:
- Exponential backoff with jitter
- Specific retry logic for HTTP 429, 5xx
- MAX_RETRIES = 4
- BASE_DELAY = 1.0s, MAX_DELAY = 30s

### Action Items
- [ ] Review which client is being used in `ai_engine.py`
- [ ] Ensure all external API calls use `openrouter_client_improved`
- [ ] Add similar retry logic to AURA client calls

---

## 3. Database Connection Management

### Issue
Many functions create connections but might not close them properly on error.

### Pattern Found
```python
conn = await _connect()
try:
    # do stuff
finally:
    await conn.close()  # ✅ Good pattern
```

### Files Using This
- ✅ `staking_manager.py` (after our fixes)
- ✅ `ml_matcher.py`
- ❓ `agent_crew.py` (verify)

---

## 4. Missing Type Hints

### Issue
Many functions lack complete type hints, making it hard to catch errors early.

### Example
```python
# ❌ Bad
async def create_staking_escrow(user_id, user_stellar_pubkey, ...):
    ...

# ✅ Good (what we did)
async def create_staking_escrow(
    user_id: str,
    user_stellar_pubkey: str,
    hotmart_order_id: str,
    amount_xlm: Decimal,
    course_id: str | None = None,
) -> dict:
    ...
```

### Files to Type
- [ ] `ai_engine.py` — check parameter types
- [ ] `integrations/aura_client.py` — check return types
- [ ] `hotmart_bridge.py` — verify all types

---

## 5. Schema-Code Misalignment Prevention

### Mistake We Found
```python
# Code expected:
SELECT user_id, amount_xlm, status FROM educational_escrows

# But schema had:
user_id → buyer_email
amount_xlm → xlm_amount
status → escrow_status
```

### Prevention Strategy
1. **Always define schema FIRST** in `.sql` files
2. **Document field mapping** in code comments
3. **Use migration tests** before deploying
4. **Run `SELECT *` query** to verify column names match expectations

### Check Script
```bash
# Test column names match code expectations
psql $DATABASE_URL -c "
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'educational_escrows';
"
```

---

## 6. Logging Best Practices

### Issue
Inconsistent logging levels and missing context.

### Pattern to Use
```python
log = logging.getLogger("xiima.<module>")

# Debug — detailed diagnostic info
log.debug(f"Processing hackathon {hackathon_id}")

# Info — significant milestones
log.info(f"✅ Escrow #{escrow_id} created successfully")

# Warning — something unexpected but recoverable
log.warning(f"Retry {attempt} for OpenRouter API")

# Error — something failed, action may be needed
log.error(f"Failed to create escrow: {exc}", exc_info=True)

# Exception — use ONLY in except blocks with exc_info=True
log.exception(f"Critical failure in {func_name}")
```

### Status Emojis
```python
✨ Created/started
✅ Success  
⚠️  Warning
❌ Failed
💰 Payment related
🚀 Activated/deployed
🔄 Refund/rollback
```

---

## 7. Environment Variables Checklist

### Required for Backend
```bash
DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname
STELLAR_NETWORK=testnet|public
STELLAR_SECRET_KEY=S...  # 56 chars
OPENROUTER_API_KEY=sk-or-v1-...
ANTHROPIC_API_KEY=sk-ant-...  # fallback
HOTMART_WEBHOOK_SECRET=...  # for signature verification
```

### Optional for Backend
```bash
ESCROW_TIMEOUT_DAYS=180
AURA_IMAGES_MILESTONE=10
STAKING_MONITOR_INTERVAL_SEC=60
AGENT_TOP_MATCHES=3
AGENT_MIN_SCORE=40
```

---

## 8. Common Async/Await Mistakes

### Mistake 1: Not awaiting
```python
# ❌ Wrong
result = create_staking_escrow(...)  # WRONG!

# ✅ Right
result = await create_staking_escrow(...)
```

### Mistake 2: Blocking in async
```python
# ❌ Wrong
time.sleep(5)  # Blocks the entire thread!

# ✅ Right
await asyncio.sleep(5)  # Non-blocking
```

### Mistake 3: Mixing sync/async
```python
# ❌ Wrong
db_result = conn.fetch(...)  # sync method on async connection!

# ✅ Right
db_result = await conn.fetch(...)  # async method
```

---

## 9. Testing Quick Checklist

### Unit Tests
```bash
# Test staking_manager functions
cd engine && pytest tests/test_staking_manager.py -v

# Test staking routes
cd services/api && pytest routes/test_staking.py -v
```

### Integration Tests
```bash
# Test full webhook flow
curl -X POST http://localhost:8000/staking/hotmart-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "TEST-001",
    "product_id": "PROD-001", 
    "buyer_email": "test@example.com",
    "buyer_name": "Test User",
    "stellar_pubkey": "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "amount_xlm": 10.0
  }'
```

---

## 10. Deployment Verification

### Pre-Deploy
```bash
# 1. Check syntax
python -m py_compile services/api/routes/staking.py
python -m py_compile engine/staking_manager.py

# 2. Verify imports
python -c "from routes import staking; print('✅ Imports OK')"

# 3. Check environment
env | grep -E "DATABASE_URL|STELLAR|OPENROUTER|ANTHROPIC|HOTMART"
```

### Post-Deploy
```bash
# 1. Check health
curl http://localhost:8000/health

# 2. Verify migrations
psql $DATABASE_URL -c "SELECT COUNT(*) FROM educational_escrows;"

# 3. Test webhook (with signature)
# See "Testing Quick Checklist" above

# 4. Monitor logs
docker compose logs -f api | grep -E "Escrow|ERROR|WARNING"
```

---

## Quick Reference: What Was Fixed

| Issue | File | Fix | Status |
|-------|------|-----|--------|
| Missing `create_staking_escrow` | `staking_manager.py` | ✅ Implemented full function | DONE |
| Schema column mismatch | DB schema | ✅ Created migration 007 | DONE |
| TODO in routes | `routes/staking.py` | ✅ Uncommented & fixed | DONE |
| User progress tracking | `user_skills_progress` | ✅ Schema aligned | DONE |
| Lifecycle logging | `escrow_lifecycle_log` table | ✅ Created in migration | DONE |
| Error handling | Multiple files | ⏳ Needs review | TODO |
| Type hints | Multiple files | ⏳ Needs enhancement | TODO |
| Retry logic | API clients | ⏳ Consolidate to improved client | TODO |

---

## For Debugging

### Check Escrow Status
```sql
-- See all escrows for a user
SELECT * FROM educational_escrows WHERE user_id = 'student@example.com';

-- Check lifecycle log
SELECT * FROM escrow_lifecycle_log WHERE user_id = 'student@example.com' ORDER BY created_at DESC;

-- Test skills progress
SELECT * FROM user_skills_progress WHERE user_id = 'student@example.com';
```

### Monitor Active API Calls
```python
# Add to FastAPI startup
from slowapi import Limiter
# Configure rate limiting and timing
```

### Stellar Transaction Lookup
```bash
# After payment sent, verify in Horizon
curl https://horizon-testnet.stellar.org/transactions/{tx_hash}
```

---

## Contact/Issues

If you encounter issues:
1. Check logs: `docker compose logs -f api`
2. Run migrations: Ensure all 007 migrations are applied
3. Verify env vars: `echo $DATABASE_URL | head -c 20`...
4. Test locally first before deploying to production
