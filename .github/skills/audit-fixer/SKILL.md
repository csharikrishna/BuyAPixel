---
name: audit-fixer
description: 'Transform comprehensive audit reports into production-ready fixes. Systematically resolves CRITICAL, HIGH, MEDIUM, and LOW severity issues using a multi-agent pipeline (Parser → Fixer → Reviewer → Validator). Implements actual code changes with before/after validation and confidence scoring.'
argument-hint: 'Provide audit report path (e.g., COMPREHENSIVE_AUDIT_REPORT.md) and priority level (critical-only, critical-high, all)'
user-invocable: true
disable-model-invocation: false
---

# Audit Fixer Skill

## Purpose

Transform a **comprehensive audit report** into **actual, working fixes** in your codebase. The skill systematically resolves identified issues through a rigorous multi-agent pipeline, ensuring each fix is:
- ✅ Technically correct and complete
- ✅ Follows best practices and patterns
- ✅ Doesn't introduce regressions
- ✅ Production-ready with confidence scoring

## When to Use

- **After Receiving Audit Report**: You have COMPREHENSIVE_AUDIT_REPORT.md from a `/project-audit`
- **Need Systematic Remediation**: Want automated fixes instead of manual implementation
- **Production Deployment Prep**: Must fix issues in order of severity
- **Quality Assurance**: Need documented before/after validation
- **Compliance**: Need audit trail of what was fixed and when

## How It Works

The skill operates a **4-agent pipeline** with automated iteration and validation:

```
INPUT: Audit Report (COMPREHENSIVE_AUDIT_REPORT.md)
  ↓
[PARSER AGENT]
  • Extract all issues with severity/description
  • Structure into actionable items
  • Identify dependencies between fixes
  ↓
[FIXER AGENT]  ← Applies actual code changes
  • Read current implementation
  • Apply recommended fix from audit
  • Modify files directly
  • Cross-reference best practices
  ↓
[REVIEWER AGENT] ← Validates correctness
  • Review all changes
  • Check for regressions
  • Verify code quality
  • Ensure completeness
  ↓
[VALIDATOR AGENT] ← Production readiness gate
  • Confirm all CRITICAL issues fixed
  • Verify no incomplete implementations
  • Ensure changes are safe
  • Score confidence level
  ↓
OUTPUT: Fix Summary + Changed Files + Validation Report
  • Total issues resolved
  • Remaining issues (if any)
  • Files modified with before/after
  • Risk assessment
  • Production deployment readiness
```

## Procedure

### Step 1: Invoke the Skill with Audit Report

```
/audit-fixer
Audit Report: docs/COMPREHENSIVE_AUDIT_REPORT.md
Priority: critical-only
```

**Available Priority Levels:**
- `critical-only` → Fix CRITICAL issues only (shortest path to safety)
- `critical-high` → Fix CRITICAL + HIGH issues (balanced approach)
- `all` → Fix all issues including MEDIUM and LOW (comprehensive)

### Step 2: Parser Agent Extracts Issues

The skill reads your audit report and extracts:

```
Issues Found:
├─ CRITICAL (5 issues)
│  ├─ C1: Missing Fetch Timeout
│  ├─ C2: HMAC Timing Attack
│  ├─ C3: Orphaned Orders
│  ├─ C4: Race Condition
│  └─ C5: Missing Idempotency
├─ HIGH (6 issues)
│  ├─ H1: Amount Not Re-Validated
│  ├─ H2: Input Validation Missing
│  ├─ H3: Rate Limit Bypass
│  ├─ H4: Admin Auth Bypass
│  ├─ H5: RLS Gaps
│  └─ H6: Webhook No Refund
├─ MEDIUM (5 issues)
├─ LOW (4 issues)
└─ Dependencies:
   • C1 blocks C3 (needs timeouts for reliable DB inserts)
   • C4 required before C5 (race condition lock needed)
```

### Step 3: Fixer Agent Implements Fixes

For each issue (in priority order), the fixer:

1. **Understands the Problem**
   - Reads issue description from audit report
   - Locates affected file(s)
   - Examines current implementation

2. **Applies the Fix**
   - Modifies code according to audit recommendation
   - Follows [fix-patterns.md](./references/fix-patterns.md) for consistency
   - Updates only necessary files
   - Preserves existing functionality

3. **Code Example (Issues →Fixed):**
   ```
   C1: Missing Fetch Timeout
   ────────────────────────────
   BEFORE:
   const response = await fetch(url); // No timeout
   
   AFTER:
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 10000);
   const response = await fetch(url, { signal: controller.signal });
   ```

### Step 4: Reviewer Agent Validates Each Fix

Reviewer checks:
- ✓ Code is syntactically correct
- ✓ Logic aligns with audit recommendation
- ✓ No obvious bugs or edge cases missed
- ✓ Follows project coding standards
- ✓ No breaking changes to existing code
- ✓ Performance impact acceptable

**Feedback Loop:** If reviewer finds issues, fixer re-applies with improvements.

### Step 5: Validator Agent Ensures Production Readiness

Final validation verifies:
- ✓ All CRITICAL issues are **definitely** fixed (not partial)
- ✓ No new security holes introduced
- ✓ Database migrations (if needed) are safe
- ✓ Configuration changes documented
- ✓ Test coverage for critical paths
- ✓ Deployment strategy clear

**Output: PASS or FAIL with confidence score**

### Step 6: Review Fix Summary

You receive a comprehensive report:

```markdown
# Audit Fixer Report

## Summary
- **Issues Fixed:** 11 / 16
- **Remaining:** 5 (can be addressed later)
- **Overall Confidence:** 92%

## Fixed (By Severity)
✅ CRITICAL: 5/5 (100%)
  • C1: Fetch Timeout ✓
  • C2: HMAC Timing Attack ✓
  • C3: Orphaned Orders ✓
  • C4: Race Condition ✓
  • C5: Idempotency ✓

✅ HIGH: 4/6 (67%)
  • H1: Amount Validation ✓
  • H2: Input Validation ✓
  • H3: Rate Limiting ✓
  • H4: Admin Auth ✓

⏸️ MEDIUM: 0/5 (0%)
  • M1: Audit Logging (deferred)
  • M2: Email Retry (deferred)

## Changed Files
1. supabase/functions/create-razorpay-order/index.ts
2. supabase/functions/verify-razorpay-payment/index.ts
3. supabase/migrations/017_enhanced_payment_validation.sql
4. src/hooks/useIsAdmin.ts
5. ... (12 files total)

## Risk Assessment
- No breaking changes to public APIs
- Database migration required (safe, backward-compatible)
- Edge function versions updated (handle old clients)
- Recommended: Test in staging 24 hours before production

## Production Deployment Readiness
✅ All CRITICAL fixed → Safe to deploy
⚠️ Some HIGH issues remain → Plan Phase 2
🎯 Estimated deployment impact: LOW
```

## Reference Materials

- [Fix Patterns](./references/fix-patterns.md) — Common patterns for each issue type
- [Fix Checklist](./references/fix-checklist.md) — Tracking checklist for each issue
- [Validation Criteria](./references/validation-criteria.md) — Quality gates and verification steps
- [Best Practices](./references/best-practices.md) — Production-ready code standards

## Example Invocations

**Fix Critical Issues Only (Fastest Path to Production):**
```
/audit-fixer
Audit Report: docs/COMPREHENSIVE_AUDIT_REPORT.md
Priority: critical-only
Dry-run: false
```

**Review Fixes Without Applying (Safe Preview):**
```
/audit-fixer
Audit Report: docs/COMPREHENSIVE_AUDIT_REPORT.md
Priority: critical-high
Dry-run: true
```

**Fix Everything (Comprehensive Remediation):**
```
/audit-fixer
Audit Report: docs/COMPREHENSIVE_AUDIT_REPORT.md
Priority: all
Staging-first: true
```

## Best Practices

1. **Start with Critical Issues**: Use `critical-only` first, deploy to staging
2. **Review Each Fix**: Don't blindly apply all changes; understand each one
3. **Test in Staging**: Always test fixes in staging environment before production
4. **Use Dry-Run Mode**: Preview all changes before applying (use `Dry-run: true`)
5. **Iterate in Phases**: Fix → Test → Deploy → Monitor (don't do everything at once)
6. **Document Assumptions**: The skill notes assumptions made; review them
7. **Monitor Post-Deployment**: Watch metrics for first 24-48 hours after deployment

## Output Quality Guarantees

✅ **Complete**: All identified issues addressed  
✅ **Correct**: Code implementations verified by reviewer  
✅ **Safe**: No breaking changes or regressions  
✅ **Documented**: Before/after code snippets shown  
✅ **Validated**: Production readiness confirmed  
✅ **Traceable**: Every fix linked to audit issue  

## Iteration Strategy

If Validator finds problems during Phase 1:
1. Communicate specific issue found
2. Fixer re-applies with improvements
3. Repeat until PASS or maximum 3 iterations
4. If still failing, escalate specific issues for manual review

## Post-Fix Verification

After fixes are applied, you should:

1. **Test Locally**
   ```bash
   npm run test:unit
   npm run test:integration
   ```

2. **Lint & Type Check**
   ```bash
   npm run lint
   npm run type-check
   ```

3. **Deploy to Staging**
   ```bash
   git push origin fix/audit-critical
   # Deploy staging environment
   ```

4. **Smoke Test in Staging**
   - Payment flow end-to-end
   - Edge cases from audit report
   - Concurrent operations (for race conditions)

5. **Monitor Metrics**
   - Error rates
   - Orphaned order detection
   - HMAC verification success rate
   - Payment processing latency

## Confidence Scoring

Each fix receives a confidence score (0-100%):

| Score | Meaning |
|-------|---------|
| 95-100% | Straightforward fix, high certainty |
| 85-95% | Moderate complexity, well-tested solution |
| 70-85% | More complex, some assumptions made |
| <70% | Requires manual review or staging verification |

**Overall Report Confidence** = Average of all fix confidence scores

## Incompleteness Markers

If a fix is incomplete, it will be marked:
- 🟡 **PARTIAL** → Needs additional work to be production-ready
- 🔴 **INCOMPLETE** → Must be finished manually
- ✅ **COMPLETE** → Ready for production deployment

## Key Assumptions

The skill assumes:
- Audit report follows COMPREHENSIVE_AUDIT_REPORT.md format
- Project uses TypeScript/JavaScript with Supabase backend
- Git repository is available for version control
- You have write access to all necessary files
- You'll review and test changes before production deployment

If your setup differs, communicate changes upfront and the skill will adapt recommendations.

## Support & Next Steps

After running the skill:
1. **Review the fix summary** with your team
2. **Test in staging** for 24-48 hours
3. **Monitor deployment** closely in production
4. **Plan Phase 2** fixes (remaining HIGH/MEDIUM issues)
5. **Re-run audit** after Phase 2 to verify improvement

---

**Generated by:** BuyASpot Audit Fixer System  
**Version:** 1.0  
**Compatible With:** project-audit skill output
