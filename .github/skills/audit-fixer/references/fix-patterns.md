# Fix Patterns for Common Issues

This document provides code patterns and templates for the most common audit findings. The Fixer agent references these patterns when implementing fixes.

## Pattern: Missing Timeout on External API Calls

**Issues:** C1 (Razorpay API), C8 (Email API), Network Failures

**Pattern:**
```typescript
// BROKEN: No timeout
const response = await fetch(url);

// FIXED: With timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds

try {
  const response = await fetch(url, { signal: controller.signal });
  // ... handle response
} catch (err) {
  if (err.name === 'AbortError') {
    throw new Error('API timeout after 10s');
  }
  throw err;
} finally {
  clearTimeout(timeoutId);
}
```

**Checklist:**
- [ ] Set appropriate timeout (5-15 seconds depending on API)
- [ ] Add try-catch for AbortError
- [ ] Clear timeout in finally block
- [ ] Log timeout errors distinctly from other failures
- [ ] Test with mocked slow API

---

## Pattern: Timing-Safe Cryptographic Comparison

**Issues:** C2 (HMAC), JWT verification, digital signatures

**Pattern:**
```typescript
// BROKEN: Timing attack vulnerable
function verifySignature(expected: string, received: string): boolean {
  return expected === received; // Early exit on first difference!
}

// FIXED: Constant-time comparison
function timingSafeEqual(actual: string, received: string): boolean {
  if (actual.length !== received.length) return false;
  
  let result = 0;
  for (let i = 0; i < actual.length; i++) {
    result |= actual.charCodeAt(i) ^ received.charCodeAt(i);
  }
  return result === 0;
}

function verifySignature(expected: string, received: string): boolean {
  const expectedHex = createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  // Always compare all bytes
  return timingSafeEqual(expectedHex, received);
}
```

**Checklist:**
- [ ] Use constant-time comparison (XOR-based)
- [ ] Compare full length regardless of match
- [ ] No early returns on mismatch
- [ ] Test timing doesn't vary with input position

---

## Pattern: Database Insert with Retry Logic

**Issues:** C3 (Orphaned Orders), Network Failures

**Pattern:**
```typescript
// BROKEN: Single attempt, no retry
const { data, error } = await db.from('orders').insert({...});
if (error) throw error;

// FIXED: Retry with exponential backoff
async function insertWithRetry(
  table: string,
  data: any,
  maxRetries = 3
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data: result, error } = await db.from(table).insert(data);
      if (!error) return result;
      
      // Check if retryable
      if (!isRetryableError(error)) throw error;
      lastError = error;
    } catch (err) {
      lastError = err as Error;
    }
    
    if (attempt < maxRetries - 1) {
      // Exponential backoff: 100ms, 200ms, 400ms
      await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
    }
  }
  
  throw lastError;
}
```

**Checklist:**
- [ ] Implement exponential backoff (not linear)
- [ ] Check if error is retryable (don't retry on constraint violations)
- [ ] Log after all retries exhausted
- [ ] Create recovery table for unrecoverable failures
- [ ] Test database unavailability scenario

---

## Pattern: Row-Level Database Locking

**Issues:** C4 (Race Conditions), Concurrent Updates

**Pattern:**
```sql
-- BROKEN: Check-then-act without locking (TOCTOU)
SELECT COUNT(*) INTO v_count 
FROM items WHERE owner_id IS NULL;

IF v_count >= requested_count THEN
  UPDATE items SET owner_id = v_user_id WHERE ...
END IF;

-- FIXED: Lock before checking
SELECT COUNT(*) INTO v_count 
FROM items 
WHERE id = ANY(v_item_ids)
FOR UPDATE; -- Acquire exclusive lock FIRST

-- Now check with lock held
SELECT COUNT(*) INTO v_available FROM items
WHERE id = ANY(v_item_ids)
AND owner_id IS NULL;

IF v_available != ARRAY_LENGTH(v_item_ids, 1) THEN
  RAISE EXCEPTION 'Not all items available';
END IF;

-- Update with lock still held
UPDATE items SET owner_id = v_user_id WHERE id = ANY(v_item_ids);
```

**Checklist:**
- [ ] Use SELECT ... FOR UPDATE before checking values
- [ ] Lock all relevant rows before any checks
- [ ] Verify count after check (double-check)
- [ ] Test with concurrent load (100+ simultaneous updates)
- [ ] Monitor lock wait times in production

---

## Pattern: Idempotency With Cache

**Issues:** C5 (Idempotent Operations), Webhook/Frontend Races

**Pattern:**
```sql
-- Create idempotency log table
CREATE TABLE idempotency_log (
  key TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- In function: check cache first
IF p_idempotency_key IS NOT NULL THEN
  SELECT response INTO v_cached
  FROM idempotency_log
  WHERE key = p_idempotency_key
  AND expires_at > NOW();
  
  IF v_cached IS NOT NULL THEN
    RETURN v_cached; -- Return cached result
  END IF;
END IF;

-- ... do work ...

-- Cache the result
IF p_idempotency_key IS NOT NULL THEN
  INSERT INTO idempotency_log (key, response, expires_at)
  VALUES (p_idempotency_key, v_result, NOW() + INTERVAL '24 hours')
  ON CONFLICT (key) DO NOTHING;
END IF;

RETURN v_result;
```

**Checklist:**
- [ ] Generate idempotency_key = hash(unique_inputs)
- [ ] Check cache before doing work
- [ ] Cache result after work completes
- [ ] Set reasonable cache expiry (usually 24 hours)
- [ ] Test race conditions (webhook + frontend)

---

## Pattern: Amount Validation

**Issues:** C6 (Payment Underpayment), Financial Transactions

**Pattern:**
```typescript
// BROKEN: Trust database amount without verification
const dbAmount = paymentOrder.amount; // 50000 (₹500)
// No verification that actual payment matches

// FIXED: Verify against payment processor
const razorpayPayment = await getRazorpayPayment(paymentId);

if (razorpayPayment.amount !== paymentOrder.amount) {
  throw new Error(
    `Amount mismatch: expected ${paymentOrder.amount}, ` +
    `received ${razorpayPayment.amount}`
  );
}

// Continue with completion
```

**Checklist:**
- [ ] Call payment processor API to get actual amount
- [ ] Compare with stored/expected amount
- [ ] Fail transaction if mismatch (don't complete)
- [ ] Log discrepancy for fraud investigation
- [ ] Mark order as 'failed' on mismatch

---

## Pattern: Input Validation & Sanitization

**Issues:** C7 (XSS), HTML Injection, Malicious Input

**Pattern:**
```typescript
// BROKEN: Trust user input
const name = req.body.pixelName; // Could be "<img onerror=stealToken()>"
const url = req.body.linkUrl;    // Could be "javascript:alert('xss')"

// FIXED: Validate and sanitize
function validatePixelName(name: string): string {
  if (!name || name.length > 100) throw new Error('Invalid name');
  
  // Sanitize: remove any HTML
  return DOMPurify.sanitize(name, { ALLOWED_TAGS: [] });
}

function validateUrl(url: string): string {
  if (!url) return '';
  if (url.length > 2048) throw new Error('URL too long');
  
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP/HTTPS allowed');
    }
    return urlObj.toString();
  } catch {
    throw new Error('Invalid URL');
  }
}

const validName = validatePixelName(req.body.pixelName);
const validUrl = validateUrl(req.body.linkUrl);
```

**Checklist:**
- [ ] Whitelist validation (not blacklist)
- [ ] Check length limits
- [ ] For URLs: parse and re-stringify to normalize
- [ ] For text: remove HTML tags
- [ ] Test with OWASP payloads (XSS, SQL injection attempts)

---

## Pattern: Persistent Rate Limiting

**Issues:** C8 (Rate Limit Bypass), Brute Force Protection

**Pattern:**
```typescript
// BROKEN: In-memory rate limiting (ephemeral on function restart)
const rateLimitMap = new Map();

function checkRateLimit(userId: string) {
  // Lost on function cold start!
  const entry = rateLimitMap.get(userId);
  // ...
}

// FIXED: Database-backed rate limiting
async function checkRateLimitWithDB(userId: string): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window
  
  const { data: entry, error } = await supabase
    .from('rate_limits')
    .select('count, reset_at')
    .eq('user_id', userId)
    .eq('window_start', Math.floor(windowStart / 60000))
    .single();
  
  if (!entry) {
    // First request in window
    await supabase.from('rate_limits').insert({
      user_id: userId,
      count: 1,
      window_start: Math.floor(windowStart / 60000),
      expires_at: now + 60000
    });
    return true; // Allowed
  }
  
  if (entry.count >= 5) {
    return false; // Rate limited
  }
  
  // Increment counter
  await supabase.from('rate_limits')
    .update({ count: entry.count + 1 })
    .eq('user_id', userId);
  
  return true;
}

// Use in endpoint
if (!(await checkRateLimitWithDB(user.id))) {
  throw new Error('Rate limit exceeded');
}
```

**Checklist:**
- [ ] Use database/Redis (not memory)
- [ ] Implement sliding window counter
- [ ] Set expiration on old entries
- [ ] Test persistence across cold starts
- [ ] Monitor rate limit hit frequency

---

## Pattern: Backend Authorization Gate

**Issues:** C9 (Admin Bypass), Privilege Escalation

**Pattern:**
```typescript
// BROKEN: Client-side only
const isAdmin = user.email === SUPER_ADMIN_EMAIL; // VITE env exposed!
if (isAdmin) {
  // Admin features available
}

// FIXED: Backend verification required
async function getAdminStatus(userId: string): Promise<boolean> {
  // Only query database, never trust client
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .single();
  
  return data?.is_admin === true;
}

// Create backend RPC
CREATE OR REPLACE FUNCTION check_admin_access()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

// Frontend calls backend
const { data: isAdmin } = await supabase.rpc('check_admin_access');
if (!isAdmin) {
  throw new Error('Not authorized');
}
```

**Checklist:**
- [ ] Remove client-side admin checks (or use only for UX)
- [ ] Create backend RPC for authorization
- [ ] Backend verifies auth.uid() in session
- [ ] Backend queries database for admin status
- [ ] Test privilege escalation scenarios

---

## Pattern: Row-Level Security Policies

**Issues:** C10 (RLS Gaps), Access Control

**Pattern:**
```sql
-- BROKEN: No explicit admin policy
CREATE POLICY "users_select_own" ON users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- FIXED: Add explicit admin bypass
CREATE POLICY "users_select_admin" ON users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Combine: User sees own + all if admin
CREATE POLICY "users_select" ON users
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() -- Own data
    OR
    EXISTS ( -- OR is admin
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );
```

**Checklist:**
- [ ] Explicit RLS policy for admin role
- [ ] Test with non-admin user (can't see others)
- [ ] Test with admin user (can see all)
- [ ] Test with unauthenticated (deny all)
- [ ] Verify policy in database (e.g., `\d+ table_name`)

---

## Pattern: Automatic Refund for Orphaned Payments

**Issues:** C11 (Webhook Refunds), Payment Reconciliation

**Pattern:**
```typescript
// BROKEN: Just log orphaned payments
if (!paymentOrder) {
  console.warn('Orphaned payment detected');
  // No refund attempt
}

// FIXED: Attempt automatic refund
if (!paymentOrder) {
  console.warn(`Orphaned payment: ${paymentId}`);
  
  try {
    const refundResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(API_KEY + ':' + API_SECRET)}`,
        },
        body: JSON.stringify({ speed: 'optimum' }),
      }
    );
    
    if (refundResponse.ok) {
      // Log successful refund
      await supabase.from('audit_log').insert({
        event: 'orphaned_payment_refunded',
        payment_id: paymentId,
      });
    } else {
      // Alert for manual review
      await supabase.from('alerts').insert({
        alert_type: 'refund_failed',
        payment_id: paymentId,
      });
    }
  } catch (err) {
    // Log and alert
    console.error('Refund error:', err);
  }
}
```

**Checklist:**
- [ ] Call payment processor refund API
- [ ] Handle successful refund
- [ ] Alert/log on refund failure
- [ ] Track refunded vs disputed orphaned payments
- [ ] Test refund in sandbox environment

---

## General Best Practices

1. **Always have an escape hatch** - If automated fix fails, log for manual intervention
2. **Test edge cases** - Especially for concurrency and timeout issues
3. **Document assumptions** - Note any limits, retry counts, timeouts
4. **Monitor post-deployment** - Watch metrics that would indicate the issue
5. **Staged rollout** - Deploy to staging, then canary, then full production
