# Issue Report Template

This template defines the standard format for all issues in audit reports.

## Issue Format

```
[SEVERITY] Issue title
├─ Component: path/to/component.tsx:line_number
├─ Category: Code Quality | Security | Performance | Architecture | Error Handling | DevOps
├─ Detection Method: Code review | Testing | Analysis | Best practice violation
│
├─ Impact Summary:
│  └─ What happens when this occurs and who is affected
│
├─ Current State:
│  └─ How the code currently works / what's missing
│
├─ Root Cause Analysis:
│  ├─ Why this issue exists
│  ├─ Design decision or oversight that led to it
│  └─ Contributing factors
│
├─ Risk Assessment:
│  ├─ Likelihood: Common | Occasional | Rare
│  ├─ Severity: Critical | High | Medium | Low
│  └─ Confidence: 100% | High (90%+) | Medium (70-90%) | Low (<70%)
│
└─ Recommended Fix:
   ├─ Solution: [Specific technical approach]
   ├─ Steps: [1. ... 2. ... 3. ...]
   ├─ Effort: [Small (1-2h) | Medium (1-2d) | Large (1w+)]
   ├─ Code Example: [if applicable]
   └─ Verification: [How to test the fix]
```

## Detailed Breakdown

### Header
- **[SEVERITY]**: CRITICAL, HIGH, MEDIUM, or LOW
- **Title**: Concise problem statement (5-10 words)

### Location
- **Component**: Exact file path and line number where issue exists
- **Context**: What this component does

### Categorization
- **Category**: One of the six audit dimensions
- **Detection Method**: How was this found (static analysis, manual review, pattern analysis)

### Description Section

#### Impact Summary
The business/user impact if this isn't fixed:
- "Users will lose unsaved drag-and-drop changes in the canvas"
- "Payment processing will fail silently, no order created"
- "Any SQL error will crash the entire checkout flow"

#### Current State
Describe how the code currently behaves:
```typescript
// Current: No error handling on fetch
const response = await fetch(url);
const data = await response.json();
// If fetch fails, component crashes
```

#### Root Cause Analysis
Explain why this happened:
- Was it an oversight?
- Was there a misunderstanding of requirements?
- Was it a shortcut under time pressure?
- Is it a knowledge gap?

### Risk Assessment

#### Likelihood
- **Common**: Happens frequently or under normal usage
- **Occasional**: Happens sometimes, requires specific conditions
- **Rare**: Very unlikely to occur in normal usage

#### Severity
See [severity-levels.md](./severity-levels.md) for definitions

#### Confidence
How confident are we in this finding:
- **100%**: Verified by running tests or code inspection
- **High (90%+)**: Likely based on code analysis
- **Medium (70-90%)**: Probable based on patterns observed
- **Low (<70%)**: Speculative, requires verification

### Solution Section

#### Recommended Fix
The specific technical approach to resolve:
- "Add ErrorBoundary component wrapper"
- "Implement prepared statements for all database queries"
- "Add timeout with exponential backoff for API calls"

#### Implementation Steps
1. Clear, sequential steps to implement the fix
2. Include code locations and files to modify
3. Specify testing needed

#### Code Example
Before/after showing the fix:

**Before:**
```typescript
const data = await fetch(url).then(r => r.json());
display(data); // crashes if fetch fails
```

**After:**
```typescript
try {
  const data = await fetchWithRetry(url, { timeout: 5000 });
  display(data);
} catch (error) {
  console.error('Failed to fetch data:', error);
  displayError('Could not load data. Please refresh.');
}
```

#### Effort Estimate
- **Small (1-2h)**: Can be done in quick PR
- **Medium (1-2d)**: Part of a sprint task
- **Large (1w+)**: Significant refactoring/redesign

#### Verification
How to confirm the fix works:
- "Add test case: `test('should handle network timeout gracefully')`"
- "Run load test with 1000 concurrent requests"
- "Verify error logs show proper error context"

## Example Issues

### Example 1: Security Issue

```
[CRITICAL] SQL Injection in user search endpoint
├─ Component: src/api/users.ts:line 42
├─ Category: Security
├─ Detection Method: Code review
│
├─ Impact Summary:
│  └─ Attacker can execute arbitrary SQL queries, compromising entire database
│     including all user PII, payment info, and admin accounts
│
├─ Current State:
│  └─ User search builds SQL query by string concatenation:
│     const query = `SELECT * FROM users WHERE email = '${email}'`;
│
├─ Root Cause Analysis:
│  ├─ Developer was unaware of parameterized query requirement
│  ├─ No code review caught the vulnerability
│  └─ No SQL injection test in security test suite
│
├─ Risk Assessment:
│  ├─ Likelihood: Common (every search request vulnerable)
│  ├─ Severity: CRITICAL (complete database compromise)
│  └─ Confidence: 100% (trivial exploitation)
│
└─ Recommended Fix:
   ├─ Solution: Use parameterized queries with named parameters
   ├─ Steps:
   │  1. Replace string concatenation with parameterized query
   │  2. Add input validation before database call
   │  3. Add SQL injection test to test suite
   │  4. Run SAST tool to catch similar issues
   ├─ Effort: Small (30 minutes)
   ├─ Code Example:
   │  BEFORE: const query = `SELECT * FROM users WHERE email = '${email}'`;
   │  AFTER: const result = await db.query(
   │    'SELECT * FROM users WHERE email = $1',
   │    [email]
   │  );
   └─ Verification: Run SQLi payload tests, SAST scan passes
```

### Example 2: Performance Issue

```
[HIGH] N+1 query pattern on orders with items list
├─ Component: src/api/orders.ts:line 156
├─ Category: Performance
├─ Detection Method: Code analysis + load testing
│
├─ Impact Summary:
│  └─ Orders list endpoint makes 1 query for orders + 1 query per order for items
│     1000 orders = 1001 database queries. Page loads in 45 seconds instead of 2s.
│
├─ Current State:
│  └─ JavaScript in-memory loop fetches items for each order separately
│
├─ Root Cause Analysis:
│  ├─ Developer didn't realize loop was fetching data individually
│  ├─ Database JOIN not considered
│  └─ No performance test caught the issue
│
├─ Risk Assessment:
│  ├─ Likelihood: Common (happens on every orders list view)
│  ├─ Severity: HIGH (significantly degrades user experience)
│  └─ Confidence: 100% (confirmed with load testing)
│
└─ Recommended Fix:
   ├─ Solution: Use SQL JOIN to fetch orders with items in single query
   ├─ Steps:
   │  1. Rewrite SQL to use JOIN instead of loop
   │  2. Add index on orders.id and items.order_id
   │  3. Update response shape to include nested items
   │  4. Add performance test to verify < 500ms response time
   ├─ Effort: Medium (2-3 hours)
   ├─ Code Example:
   │  BEFORE:
   │    const orders = await getOrders();
   │    for (const order of orders) {
   │      order.items = await getItemsForOrder(order.id);
   │    }
   │  AFTER:
   │    const orders = await db.query(`
   │      SELECT o.*, json_agg(i) as items
   │      FROM orders o
   │      LEFT JOIN items i ON i.order_id = o.id
   │      GROUP BY o.id
   │    `);
   └─ Verification: Load test shows <500ms response, query plan shows single scan
```

### Example 3: Code Quality Issue

```
[MEDIUM] Missing error handling in UserProfile component
├─ Component: src/components/UserProfile.tsx:line 23
├─ Category: Error Handling
├─ Detection Method: Code review + testing
│
├─ Impact Summary:
│  └─ If user data fetch fails, entire profile page crashes with blank screen.
│     No error message guides user or admin on what went wrong.
│
├─ Current State:
│  └─ useEffect fetches user data but doesn't handle network errors
│
├─ Root Cause Analysis:
│  ├─ Developer focus was on happy path
│  ├─ Error scenarios not explicitly tested
│  └─ No error boundary wrapper at component level
│
├─ Risk Assessment:
│  ├─ Likelihood: Occasional (happens if network drops or server errors)
│  ├─ Severity: HIGH (user-visible crash)
│  └─ Confidence: 95% (pattern found in other components too)
│
└─ Recommended Fix:
   ├─ Solution: Add error state and fallback UI in component
   ├─ Steps:
   │  1. Add error state to component
   │  2. Wrap fetch in try-catch
   │  3. Show error UI if fetch fails
   │  4. Add retry button
   │  5. Test in browser with network disabled
   ├─ Effort: Small (1-2 hours)
   ├─ Code Example:
   │  [See code diff example]
   └─ Verification: Test with network offline, error UI appears
```

## Usage Guidelines

1. **Be Specific**: Always include exact file paths and line numbers
2. **Provide Context**: Help the reader understand the component and its role
3. **Explain Why**: Root cause analysis helps prevent similar issues
4. **Make it Actionable**: Solution should be clear enough to implement
5. **Include Examples**: Code examples are worth 1000 words
6. **Verify Everything**: Every claim should be verifiable
