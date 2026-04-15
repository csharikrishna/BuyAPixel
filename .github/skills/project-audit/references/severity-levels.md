# Severity Levels

Issues identified in project audits are classified into four severity tiers:

## CRITICAL 🔴

**Impact**: System failure, complete feature unavailability, or data loss  
**Timeline**: Fix immediately before production deployment  
**Examples**:
- SQL injection vulnerabilities
- Authentication bypass
- Complete lack of error handling causing crashes
- Data loss or corruption bugs
- Unencrypted sensitive data storage
- Missing critical security controls

**Characteristics**:
- System is unusable or unsafe in current state
- Requires code changes before deployment
- May block entire release
- No workarounds available

## HIGH 🟠

**Impact**: Significant degradation of functionality, security risk, or performance issue  
**Timeline**: Fix before or immediately after production deployment  
**Examples**:
- Missing error boundaries causing UI crashes
- N+1 query problems
- Unvalidated API inputs
- Missing rate limiting on public endpoints
- Poor error messages impacting troubleshooting
- Incomplete API documentation

**Characteristics**:
- Feature works but with serious limitations
- May impact user experience significantly
- Security or performance concerns
- Should have a fix implemented soon

## MEDIUM 🟡

**Impact**: Notable issues affecting code quality, maintainability, or edge cases  
**Timeline**: Address in next sprint or feature cycle  
**Examples**:
- Inconsistent error handling patterns
- Missing unit tests for critical paths
- Suboptimal database indexing (but still performant)
- Duplicate code that should be refactored
- Missing logging at key decision points
- Outdated but still functional dependencies

**Characteristics**:
- System works correctly for standard cases
- Edge cases or failures have reduced quality
- Technical debt accumulation risk
- Best practice violations
- Can be scheduled into backlog

## LOW 🟢

**Impact**: Minor issues, nice-to-have improvements, or code style concerns  
**Timeline**: Consider for future refactoring  
**Examples**:
- Code style inconsistencies
- Unused imports or variables
- Documentation gaps
- Comments that could be clearer
- Non-critical logging improvements
- Refactoring opportunities for readability

**Characteristics**:
- No impact on functionality or safety
- Nice-to-have improvements
- Can be addressed incrementally
- Good for tech debt reduction

## Severity Decision Matrix

| Factor | CRITICAL | HIGH | MEDIUM | LOW |
|--------|----------|------|--------|-----|
| **Data/Security Risk** | Complete compromise | Significant exposure | Limited exposure | None |
| **Availability** | Feature unavailable | Significantly degraded | Occasional hiccup | None |
| **Performance** | System unusable | Noticeably slow | Slightly suboptimal | Negligible |
| **Users Affected** | 100% / production-critical | Most users | Some users | Edge cases |
| **Effort to Fix** | Variable | Variable | Low-Medium | Low |
| **Workaround Available** | None | Limited | Possible | N/A |

## Classification Rules

1. **Security First**: Any security issue is bumped at least one level up  
2. **Data Integrity**: Any data loss risk is at least HIGH  
3. **Production Impact**: Issues affecting production deployments are at least HIGH  
4. **Development Impact**: Issues affecting developer productivity are at most MEDIUM  
5. **Edge Cases**: Edge case issues are at most MEDIUM unless they affect security/data  
