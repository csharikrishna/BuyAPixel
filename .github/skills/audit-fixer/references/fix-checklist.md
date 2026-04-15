# Fix Checklist

This checklist tracks the status of each issue as it moves through the Fixer pipeline. Use this to monitor progress and ensure no issues are skipped.

## CRITICAL Issues (Must Fix Before Production)

### C1: Missing Fetch Timeout on Razorpay API Call
- [ ] **Parser**: Issue extracted and understood
- [ ] **Fixer**: AbortController added with 10s timeout
- [ ] **Fixer**: Try-catch handles AbortError distinctly
- [ ] **Fixer**: Finally block clears timeout
- [ ] **Fixer**: Error handling distinguishes timeout from other failures
- [ ] **Reviewer**: Code review completed
- [ ] **Reviewer**: No regressions to other API calls
- [ ] **Reviewer**: Error messages are clear and actionable
- [ ] **Validator**: Timeout actually triggers at 10s (tested)
- [ ] **Validator**: Database doesn't create record on timeout
- [ ] **Validator**: User receives error message not indefinite hang
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

### C2: Timing Attack Vulnerability in HMAC
- [ ] **Parser**: Cryptographic vulnerability understood
- [ ] **Fixer**: timingSafeEqual function implemented with XOR bitwise op
- [ ] **Fixer**: No early returns on mismatch
- [ ] **Fixer**: All 64 hex characters compared regardless
- [ ] **Fixer**: Applied to verifySignature function
- [ ] **Reviewer**: Constant-time property verified
- [ ] **Reviewer**: No performance regression
- [ ] **Reviewer**: Correct XOR logic for comparison
- [ ] **Validator**: Timing test shows no correlation with input position
- [ ] **Validator**: All existing payments still verify correctly
- [ ] **Validator**: New payments with valid signatures succeed
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

### C3: Database Inconsistency - Orphaned Orders
- [ ] **Parser**: Orphaned order failure scenarios understood
- [ ] **Fixer**: Retry logic with exponential backoff implemented
- [ ] **Fixer**: Retryable error detection implemented
- [ ] **Fixer**: orphaned_orders recovery table created
- [ ] **Fixer**: Unrecoverable failures logged to recovery table
- [ ] **Reviewer**: Retry counts reasonable (typically 3 attempts)
- [ ] **Reviewer**: Backoff timing appropriate (100ms, 200ms, 400ms)
- [ ] **Reviewer**: Non-retryable errors not retried
- [ ] **Validator**: Database insert failure triggers retry
- [ ] **Validator**: After 3 retries, logged to recovery table
- [ ] **Validator**: Recovery process is documented
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

### C4: Race Condition - Concurrent Pixel Purchase
- [ ] **Parser**: Race condition timing understood
- [ ] **Fixer**: SELECT ... FOR UPDATE added before checking availability
- [ ] **Fixer**: All pixels locked in single transaction
- [ ] **Fixer**: Availability check happens after lock acquired
- [ ] **Fixer**: Update count verified against request count
- [ ] **Reviewer**: Lock ordering correct (no deadlock possibility)
- [ ] **Reviewer**: Lock granularity appropriate
- [ ] **Reviewer**: Nothing else uses FOR UPDATE that could conflict
- [ ] **Validator**: 100 concurrent users can't buy same pixel
- [ ] **Validator**: Profile pixel_count matches pixels in database
- [ ] **Validator**: Lock wait times < 100ms under load
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

### C5: Idempotency Not Implemented
- [ ] **Parser**: Webhook+frontend race condition understood
- [ ] **Fixer**: idempotency_log table created with expiry
- [ ] **Fixer**: RPC function signature updated with p_idempotency_key
- [ ] **Fixer**: Idempotency check happens BEFORE work (Step 0)
- [ ] **Fixer**: Result cached after work in idempotency_log
- [ ] **Fixer**: Expiry set to 24 hours
- [ ] **Reviewer**: Cache lookup logic correct
- [ ] **Reviewer**: Concurrent inserts handled (ON CONFLICT DO NOTHING)
- [ ] **Validator**: Webhook + frontend can't double-execute
- [ ] **Validator**: Second call returns cached result immediately
- [ ] **Validator**: Profile pixel_count incremented only once
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

---

## HIGH Severity Issues (Should Fix Before Production)

### C6: Payment Amount Not Re-Validated
- [ ] **Parser**: Amount mismatch risk understood
- [ ] **Fixer**: Call to getRazorpayPayment API added
- [ ] **Fixer**: Amount comparison implemented (expected vs received)
- [ ] **Fixer**: Mismatch marks order as 'failed'
- [ ] **Fixer**: Mismatch logged for fraud investigation
- [ ] **Reviewer**: API call handles errors gracefully
- [ ] **Reviewer**: Mismatch prevents completion (not just logged)
- [ ] **Validator**: Underpayment is detected and rejected
- [ ] **Validator**: Overpayment is detected and logged
- [ ] **Validator**: Valid amounts still accepted
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

### C7: Input Validation Missing (URLs/Alt Text)
- [ ] **Parser**: XSS attack surface understood
- [ ] **Fixer**: validatePixelName function created
- [ ] **Fixer**: validateUrl function created
- [ ] **Fixer**: HTML sanitization with DOMPurify
- [ ] **Fixer**: URL parsing and normalization
- [ ] **Fixer**: Validation applied before database insert
- [ ] **Reviewer**: OWASP XSS payloads tested
- [ ] **Reviewer**: No HTML tags in sanitized output
- [ ] **Reviewer**: URLs can only be HTTP/HTTPS
- [ ] **Validator**: XSS payload in name → sanitized
- [ ] **Validator**: JavaScript URL → rejected
- [ ] **Validator**: Valid data still passes validation
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

### C8: Rate Limit In-Memory Only
- [ ] **Parser**: Cold-start bypass vulnerability understood
- [ ] **Fixer**: rate_limits table created in database
- [ ] **Fixer**: Sliding window counter logic implemented
- [ ] **Fixer**: checkRateLimitWithDB queries database (not memory)
- [ ] **Fixer**: Per-user counters tracked separately
- [ ] **Fixer**: Window expiry set appropriately
- [ ] **Reviewer**: Sliding window vs fixed window appropriate
- [ ] **Reviewer**: Persistence verified across cold starts
- [ ] **Validator**: 5 requests within 60 seconds allowed
- [ ] **Validator**: 6th request rejected (rate limited)
- [ ] **Validator**: Limit persists after cold start
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

### C9: Admin Authorization Bypass (Email-Based)
- [ ] **Parser**: Client-side authorization weakness understood
- [ ] **Fixer**: useIsAdmin hook modified (database only, no email check)
- [ ] **Fixer**: check_admin_access RPC created in database
- [ ] **Fixer**: RPC queries profiles.is_admin (not email)
- [ ] **Fixer**: Frontend calls RPC instead of checking email
- [ ] **Reviewer**: VITE env variable no longer exposed
- [ ] **Reviewer**: Email compromise doesn't grant admin
- [ ] **Reviewer**: Database admin flag is single source of truth
- [ ] **Validator**: Non-admin user blocked from admin endpoints
- [ ] **Validator**: Admin user verified via database
- [ ] **Validator**: Email change doesn't affect admin status
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

### C10: RLS Policy Gap for Admin Access
- [ ] **Parser**: Missing admin read policy understood
- [ ] **Fixer**: Admin select policy created for all tables
- [ ] **Fixer**: Policy uses profiles.is_admin check
- [ ] **Fixer**: Combined policy: user's own data OR is admin
- [ ] **Reviewer**: Non-admin can't see others' data
- [ ] **Reviewer**: Admin can see all data
- [ ] **Reviewer**: Unauthenticated users denied
- [ ] **Validator**: Test non-admin querying admin data → denied
- [ ] **Validator**: Test admin querying any data → allowed
- [ ] **Validator**: RLS is actually enforced in database
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

### C11: Webhook No Automatic Refund for Orphaned Payments
- [ ] **Parser**: Orphaned payment refund process understood
- [ ] **Fixer**: Refund API call implemented in webhook handler
- [ ] **Fixer**: Parallel error handling (attempt refund, then alert)
- [ ] **Fixer**: Successful refund logged to audit_log
- [ ] **Fixer**: Failed refund logged to alerts table for manual intervention
- [ ] **Reviewer**: Refund errors don't crash webhook
- [ ] **Reviewer**: Alert logic clear for ops team
- [ ] **Validator**: Orphaned payment → automatic refund attempted
- [ ] **Validator**: Successful refund is logged
- [ ] **Validator**: Failed refund triggers alert
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

---

## MEDIUM Severity Issues (Should Fix Soon)

### M1: Missing Audit Logging for Critical Changes
- [ ] **Parser**: Compliance requirement understood
- [ ] **Fixer**: payment_audit_log table created
- [ ] **Fixer**: Logging inserted in complete_pixel_purchase RPC
- [ ] **Fixer**: Logs include: action, from_status, to_status, user_id, details
- [ ] **Reviewer**: All critical state changes have logs
- [ ] **Validator**: Audit trail is queryable and complete
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

### M2: Email Send Failure Not Handled
- [ ] **Parser**: Silent failure risk understood
- [ ] **Fixer**: Email retry queue table created
- [ ] **Fixer**: sendConfirmationEmailWithRetry with retry logic
- [ ] **Fixer**: Failure logged to email_retry_queue
- [ ] **Reviewer**: Retry schedule reasonable (60s, 300s, 900s)
- [ ] **Validator**: Email failures don't block payment completion
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

### M3: localStorage Trusted Without Validation
- [ ] **Parser**: XSS gadget chain risk understood
- [ ] **Fixer**: ReValidation of restored checkout data
- [ ] **Fixer**: Failed validation removes bad data from localStorage
- [ ] **Reviewer**: Validation same as input validation
- [ ] **Validator**: Malicious localStorage data is rejected
- **Status**: ☐ Pending | ☑ Complete | ✗ Incomplete

---

## Summary

**Total Issues:** 16  
**Fixed:** ___ / 16  
**Complete:** ___ / 16  
**Incomplete:** ___ / 16  
**Pending:** ___ / 16  

**Completion %:** ____%

---

## Instructions

1. **Before starting**: Mark all as "Pending"
2. **During Parser**: Update Parser checkboxes
3. **During Fixer**: Update Fixer checkboxes
4. **During Reviewer**: Update Reviewer checkboxes  
5. **During Validator**: Update Validator checkboxes and Status
6. **Final**: Record completion % and any incomplete items for next iteration

For each incomplete item, note:
- [ ] **Why incomplete?** (scope, complexity, dependency?)
- [ ] **When will it be completed?** (next sprint?)
- [ ] **Who owns it?** (developer name)
