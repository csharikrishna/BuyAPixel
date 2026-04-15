# Validation Criteria for Production-Ready Fixes

The Validator Agent uses these criteria to ensure all fixes are production-ready. A fix must pass **ALL criteria in its category** to be marked complete.

## ✅ Correctness Validation

### Code Quality
- [ ] Syntax is correct (no TypeScript or SQL errors)
- [ ] Follows project's coding conventions
- [ ] Variable names are clear and descriptive
- [ ] No unused variables or imports
- [ ] Proper error handling (try-catch, null checks)
- [ ] No side effects in pure functions
- [ ] Logging is appropriate (not too verbose, not silent on errors)

### Business Logic
- [ ] Implementation matches audit recommendation exactly
- [ ] Doesn't introduce new business logic
- [ ] Doesn't change existing APIs or contracts
- [ ] Preserves backward compatibility
- [ ] Handles all specified edge cases
- [ ] No shortcuts or incomplete implementations
- [ ] Comments explain "why", not "what"

### Type Safety
- [ ] All types are explicit (no `any` types)
- [ ] TypeScript compiles without errors or warnings
- [ ] Function signatures are typed
- [ ] Return types are specified
- [ ] No unchecked type coercions

---

## 🔒 Security Validation

### Cryptography
- [ ] Timing-safe comparisons for sensitive data
- [ ] No secrets in error messages or logs
- [ ] HMAC/signature verification cannot be bypassed
- [ ] Key material is never printed or exposed
- [ ] Cryptographic operations use vetted libraries

### Authorization & Access Control
- [ ] Frontend authorization checks removed (if removed)
- [ ] Backend verification gates added (if added)
- [ ] RLS policies are correct and enforceable
- [ ] No privilege escalation paths
- [ ] Admin checks use database, not environment vars
- [ ] Rate limits are persistent (not ephemeral)

### Input Validation
- [ ] All user inputs are validated before use
- [ ] Whitelisting used instead of blacklisting
- [ ] URL scheme validation (no `javascript:`)
- [ ] HTML sanitization removes all tags/scripts
- [ ] String lengths checked before storage
- [ ] No SQL injection vectors (parameterized queries)
- [ ] No XSS vectors (encoded output)

---

## 🔄 Resilience Validation

### Timeouts & Async Operations
- [ ] External API calls have timeouts (5-15 seconds)
- [ ] No indefinite waits or blocking operations
- [ ] Timeout errors handled distinctly from other failures
- [ ] Retry logic has appropriate backoff (exponential, not linear)
- [ ] Maximum retries prevent infinite loops

### Data Consistency
- [ ] Database transactions are atomic (all-or-nothing)
- [ ] No partial updates possible
- [ ] Locks are acquired before checking values (not after)
- [ ] Race conditions prevented with SELECT FOR UPDATE
- [ ] Idempotent operations can be safely retried

### Failure Handling
- [ ] Graceful degradation on external API failures
- [ ] Fallback mechanisms defined and tested
- [ ] Orphaned data is recoverable (logged to recovery table)
- [ ] No silent failures (always log errors)
- [ ] User receives actionable error messages

---

## 🧪 Testing Validation

### Unit Tests
- [ ] Critical functions have unit tests
- [ ] Edge cases covered (empty input, max length, null, etc.)
- [ ] Error paths tested
- [ ] Mock external dependencies
- [ ] All assertions have meaningful messages

### Integration Tests
- [ ] Payment flow tested end-to-end
- [ ] Database operations verified
- [ ] Concurrent scenarios tested (for race conditions)
- [ ] Timeout behaviors verified
- [ ] Recovery scenarios tested

### Load Tests
- [ ] System handles 100+ concurrent users
- [ ] No deadlocks under load
- [ ] Response times acceptable (< 500ms for critical paths)
- [ ] No memory leaks over extended run
- [ ] Database connection pools don't exhaust

### Security Tests
- [ ] OWASP XSS payloads rejected
- [ ] Timing attack resistant (constant-time operations)
- [ ] Rate limits enforce correctly
- [ ] Authorization truly prevents unauthorized access
- [ ] RLS policies actually enforced

---

## 📊 Performance Validation

### Latency
- [ ] No performance regression vs original code
- [ ] Critical path latency acceptable (< 100ms additional)
- [ ] Background operations don't block main request
- [ ] Database queries have appropriate indexes
- [ ] No N+1 query patterns

### Throughput
- [ ] Concurrent requests handled without degradation
- [ ] Rate limiting prevents abuse without impacting legitimate traffic
- [ ] Retry delays don't amplify outages

### Resource Usage
- [ ] Memory usage stable over time (no memory leaks)
- [ ] CPU usage reasonable under normal load
- [ ] Database connections released properly
- [ ] File handles closed appropriately

---

## 🌐 Compatibility Validation

### Backward Compatibility
- [ ] Old clients continue to work (if API changed)
- [ ] Graceful fallback for missing features
- [ ] No breaking changes to public functions
- [ ] Database migrations are reversible
- [ ] Feature flags used for gradual rollout (if applicable)

### Environment Compatibility
- [ ] Works on localhost (development)
- [ ] Works in staging environment
- [ ] Works on listed production infrastructure
- [ ] Handles all supported Node.js versions
- [ ] No platform-specific code (Windows-only, etc.)

---

## 📋 Deployment Readiness Validation

### Documentation
- [ ] Code comments explain complex logic
- [ ] Migration instructions provided (if DB changes)
- [ ] Deployment steps documented
- [ ] Rollback procedure documented
- [ ] Configuration requirements listed
- [ ] Dependencies documented

### Operational Readiness
- [ ] Logs identify the issue if it occurs
- [ ] Metrics/dashboards setup for monitoring
- [ ] Alerts configured for anomalies
- [ ] Runbook created for on-call response
- [ ] Known limitations documented

### Version Control
- [ ] Changes are in separate commits (not one giant commit)
- [ ] Commit messages explain "why" not "what"
- [ ] Related changes grouped logically
- [ ] No merge conflicts
- [ ] Branch is up-to-date with main

---

## 🎯 Production Safety Validation

### Critical Issues (C1-C5)
- [ ] **All CRITICAL issues must be fixed** before production rollout
- [ ] Each critical fix verified by reviewer
- [ ] Each critical fix tested in staging
- [ ] Rollback plan exists for each critical fix
- [ ] Confidence score > 90% for critical issues

### High Issues (C6-C11)
- [ ] High issues should be fixed (or justified if deferred)
- [ ] If deferred: documented plan to fix in Phase 2
- [ ] If fixed: verified in staging

### Database Migrations
- [ ] Down migrations exist (can rollback)
- [ ] Migrations are idempotent (safe to re-run)
- [ ] No data loss potential
- [ ] Tested on production-like data volume
- [ ] Expected runtime documented (< 1 hr for production)

### Deployment Risk
- [ ] Change set is minimal (not bundling unrelated work)
- [ ] Deployment doesn't require downtime
- [ ] Can be rolled back within 5 minutes
- [ ] No manual steps required (fully automated)
- [ ] No timing dependencies (don't need to deploy at specific time)

---

## 📈 Metrics & Validation

### Success Metrics (Post-Deployment)
For each critical fix, define how to validate it's working:

| Issue | Success Metric | Target |
|-------|---|---|
| C1: Fetch Timeout | Razorpay API calls timeout < 15min | 10s timeout observed in logs |
| C2: HMAC Timing | No timing-attack HMAC failures reported | 0 forged signatures detected |
| C3: Orphaned Orders | Orphaned orders in recovery table | < 1 per week |
| C4: Race Condition | Profile pixel_count matches pixels in DB | 0 inconsistencies |
| C5: Idempotency | Duplicate payment attempts prevented | 0 double-charges |

### Monitoring

- [ ] Dashboards show relevant metrics
- [ ] Alerts configured for failures
- [ ] Logs queryable for debugging
- [ ] Version deployed is trackable
- [ ] Rollback logged with reason

---

## ✅ Final Validator Checklist

Before marking a fix as COMPLETE, Validator must verify:

### Code Review
- [ ] Code reviewed by at least one other developer
- [ ] No comments requiring changes remain
- [ ] All feedback addressed

### Testing
- [ ] Unit tests pass (100% of new code)
- [ ] Integration tests pass
- [ ] Staging deployment passes smoke tests
- [ ] Edge cases manually tested

### Documentation
- [ ] Deployment notes written
- [ ] Rollback procedure documented
- [ ] Monitoring configured
- [ ] Team notified of changes

### Final Sign-Off
- [ ] Issue is truly fixed (not circumvented)
- [ ] No regressions introduced
- [ ] Production safe to deploy
- [ ] Confidence score assigned (0-100%)

---

## Confidence Scoring

Each fix receives a confidence score reflecting the validator's certainty it's correct:

### 95-100%: VERY HIGH
- Straightforward fix matching audit exactly
- Well-tested solution (no edge cases)
- No known issues or concerns
- **Ready for immediate production deployment**

### 85-95%: HIGH
- Moderately complex but well-understood
- Tested in staging, works as expected
- Minor edge cases possible but unlikely
- **Safe for production deployment**

### 70-85%: MEDIUM
- More complex fix with some assumptions
- Some edge cases tested, others theoretical
- May need monitoring in staging first
- **Deploy to production with caution, monitor closely**

### <70%: LOW
- Complex fix with many unknowns
- Significant edge cases not tested
- Assumptions made that could be wrong
- **Requires manual review, extended staging testing, or expert verification**

---

## Incomplete Fix Handling

If a fix fails validation, mark as 🔴 INCOMPLETE with reason:

- [ ] **Non-blocking concern**: Fix works but could be improved
  - Decision: Can deploy as-is, plan improvement for later
  
- [ ] **Staging issue**: Fix works locally but fails in staging
  - Decision: Extend staging test, adjust environment config
  
- [ ] **Partial implementation**: Some parts fixed, others incomplete
  - Decision: Complete implementation before deployment
  
- [ ] **Missing validation**: Unsure if fix actually works
  - Decision: Add tests/monitoring before deployment
  
- [ ] **Regression risk**: Fix solves issue but breaks something else
  - Decision: Redesign fix to avoid regression

---

## Summary Report Template

```
# Validator Report - [Date]

## Fixed Issues
- ✅ C1: Fetch Timeout (Confidence: 98%)
- ✅ C2: HMAC Timing (Confidence: 100%)
- ✅ C3: Orphaned Orders (Confidence: 94%)
- ✅ C4: Race Condition (Confidence: 92%)
- ✅ C5: Idempotency (Confidence: 95%)
- ✅ C6: Amount Validation (Confidence: 96%)
- ✅ C7: Input Validation (Confidence: 94%)
- ✅ C8: Rate Limiting (Confidence: 91%)
- ✅ C9: Admin Auth (Confidence: 93%)
- ✅ C10: RLS Policies (Confidence: 92%)
- ✅ C11: Webhook Refunds (Confidence: 90%)

## Incomplete Issues
- 🔴 M1: Audit Logging - Deferred to Phase 2
- 🔴 M2: Email Retry - Deferred to Phase 2
- 🔴 M3: localStorage Validation - Deferred to Phase 2

## Overall Status
- **PASS**: 11/16 issues fixed (69%)
- **Confidence Score**: 93%
- **Ready for Production**: YES (all CRITICAL + most HIGH fixed)

## Recommended Deployment
1. Create release branch: `release/audit-fix-critical-v1`
2. Stage deployment date: [date]
3. Plan Phase 2 for MEDIUM/deferred issues
4. Monitoring: Watch orphaned orders dashboard hourly for first 48 hours

```
