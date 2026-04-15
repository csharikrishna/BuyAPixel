---
name: project-audit
description: 'Comprehensive, production-grade audit of projects, features, or working items. Analyzes code quality, architecture, scalability, security, error handling, and deployment readiness using a multi-agent pipeline (Generator → Reviewer → Validator). Use when: auditing MVP readiness, evaluating code quality, assessing security posture, planning architecture improvements, preparing for production deployment, reviewing feature completeness.'
argument-hint: 'Provide project/feature name and scope (e.g., "BuyAPixel main MVP" or "Payment checkout flow")'
user-invocable: true
---

# Project Audit Skill

## Purpose

Performs a **senior software architect + security auditor** level comprehensive analysis of your codebase, producing production-ready audit reports with:
- Executive summaries with confidence scores
- Severity-classified issues with root cause analysis
- Actionable remediation strategies
- Architecture improvement recommendations
- Deployment readiness verification
- Production safety checkpoints

## When to Use

- **MVP Launch Readiness**: Evaluate if your project is production-ready
- **Feature Code Review**: Deep audit of a new feature before merging
- **Security Assessment**: Identify vulnerabilities and compliance gaps
- **Performance Bottlenecks**: Discover scalability and performance issues
- **Architecture Evaluation**: Review system design for long-term maintainability
- **Technical Debt Analysis**: Prioritize refactoring efforts
- **Compliance & DevOps**: Verify deployment practices, monitoring, logging
- **Code Quality Baseline**: Establish metrics and improvement targets

## How It Works

The skill uses a **multi-agent pipeline** for rigor and confidence:

```
1. GENERATOR AGENT
   └─ Analyzes codebase systematically
   └─ Explores architecture, dependencies, patterns
   └─ Identifies issues across all audit dimensions

2. REVIEWER AGENT  
   └─ Critically examines findings
   └─ Checks for missed issues or false positives
   └─ Enhances recommendations with best practices
   └─ Validates severity classifications

3. VALIDATOR AGENT
   └─ Verifies correctness and completeness
   └─ Confirms production-readiness standards
   └─ Validates technical accuracy of recommendations
   └─ If issues found → loop back to Generator with improvements
```

## Audit Dimensions

The skill systematically evaluates:

### 1. **Code Quality & Structure**
- Code organization and module boundaries
- Design patterns and anti-patterns
- Consistency of coding conventions
- Documentation and maintainability
- Test coverage and testing strategy

### 2. **Scalability & Performance**
- Database query efficiency and indexing
- Caching strategies and memory management
- HTTP request handling and optimization
- Bundle size and asset loading
- Algorithmic complexity issues

### 3. **Security**
- Authentication and authorization gaps
- Input validation and injection vulnerabilities
- Secrets management and environment handling
- API security and CORS configuration
- Dependency vulnerabilities and version audits

### 4. **Error Handling & Resilience**
- Exception handling completeness
- Graceful degradation and fallback mechanisms
- Logging and observability
- State consistency guarantees
- Edge case coverage

### 5. **Architecture & Design**
- System design for scalability
- Service boundaries and coupling
- Technology stack appropriateness
- Data flow and consistency models
- Integration patterns and complexity

### 6. **Deployment Readiness**
- CI/CD pipeline completeness
- Deployment scripts and automation
- Database migration strategy
- Rollback and recovery procedures
- Monitoring and alerting setup
- Documentation for operations team

## Procedure

### Step 1: Invoke the Skill
Type `/project-audit` in chat and specify the scope:
```
/project-audit
Scope: BuyAPixel main MVP
Focus Areas: Payment flow, canvas feature, scalability
```

### Step 2: Skill Gathers Context
The skill will:
- Analyze your codebase structure
- Identify key components and dependencies
- Review architecture and design patterns
- Scan for obvious issues and patterns
- Understand your tech stack

### Step 3: Generator Agent Analysis
The skill runs a systematic analysis:
1. **Deep Codebase Exploration** → Maps structure, dependencies, complexity
2. **Issue Identification** → Finds problems across 6 dimensions
3. **Risk Assessment** → Classifies severity (CRITICAL, HIGH, MEDIUM, LOW)
4. **Preliminary Recommendations** → Suggests fixes and improvements

### Step 4: Reviewer Agent Validation
Critical review phase:
1. **Verify Findings** → Confirms issues are real and correctly understood
2. **Challenge Assumptions** → Questions classifications and accuracy
3. **Enhance Recommendations** → Adds implementation details and best practices
4. **Test Against Standards** → Validates against production readiness criteria

### Step 5: Validator Agent Quality Gate
Final validation and sign-off:
1. **Correctness Check** → Ensures all findings are technically accurate
2. **Completeness Audit** → Confirms no major categories were missed
3. **Production Safety Verification** → Validates deployment readiness checklist
4. **Confidence Scoring** → Assigns overall confidence level to findings

### Step 6: Iterative Refinement
If validator identifies gaps:
- Generator re-analyzes with specific focus areas
- Additional findings are integrated
- Enhanced report is generated
- Process repeats until validation passes

### Step 7: Final Report
You receive a comprehensive audit report including:
- ✅ Executive Summary
- ✅ Issues List (with severity levels)
- ✅ Root Cause Analysis
- ✅ Recommended Fixes (prioritized)
- ✅ Architecture Improvements
- ✅ Production Readiness Checklist
- ✅ Confidence Score & Signed-Off Items

## Report Structure

### Executive Summary
- High-level findings
- Overall tech health assessment
- Top 3-5 priority issues
- Estimated effort for remediation

### Identified Issues
```
[CRITICAL] SQL Injection in user search endpoint
├─ Component: src/utils/userSearch.ts:45
├─ Risk: Complete database compromise
├─ Root Cause: Unvalidated parameterized queries
└─ Fix: Implement prepared statements with validation

[HIGH] Missing error boundaries on payment flow
├─ Component: src/pages/Checkout.tsx
├─ Risk: Unhandled exceptions crash checkout UI
├─ Root Cause: No try-catch at component level
└─ Fix: Add ErrorBoundary component wrapper
```

### Architecture Assessment
- System design strengths and weaknesses
- Scalability concerns for projected growth
- Technology choices and trade-offs
- Recommendations for long-term health

### Production Readiness Checklist
- [ ] Error handling comprehensive and tested
- [ ] Logging instrumented at critical paths
- [ ] Database indexed for expected queries
- [ ] API rate limiting configured
- [ ] Monitoring and alerting operational
- [ ] Deployment pipeline automated
- [ ] Secrets management in place
- [ ] Backup and recovery tested
- [ ] Security scan passes (dependencies, code, config)
- [ ] Performance meets SLOs under load
- [ ] Documentation complete and reviewed
- [ ] Runbooks created for operations

### Confidence Score
```
Overall Audit Confidence: 92%
├─ Generator findings accuracy: 95%
├─ Reviewer validation: 90%
└─ Validator sign-off: 88%

Issues requiring verification in staging: 3
Recommendations with high confidence: 18/22
```

## Example Invocations

**Full MVP Audit:**
```
/project-audit
Scope: BuyAPixel main MVP
Focus: All areas - production readiness evaluation
```

**Feature-Specific Audit:**
```
/project-audit
Scope: Payment checkout feature
Focus: Security, error handling, performance
```

**Security-Focused Audit:**
```
/project-audit
Scope: API authentication and authorization
Focus: Security vulnerabilities, access control, secrets management
```

**Performance Audit:**
```
/project-audit
Scope: Canvas rendering and pixel grid
Focus: Performance bottlenecks, memory leaks, optimization
```

## Best Practices

1. **Specific Scope**: More specific scopes produce more accurate, actionable results
2. **Focus Areas**: Highlight what you care about most
3. **Known Issues**: Tell the skill about issues you already know about to avoid duplicates
4. **Action Plan**: Use findings to create JIRA tickets/tasks with clear ownership
5. **Verification**: Test recommendations in staging before production
6. **Follow-up**: Re-run audit after major changes to track improvements

## Reference Materials

- [Audit Checklist](./references/audit-checklist.md) — Dimensions evaluated
- [Issue Template](./references/issue-template.md) — How issues are formatted
- [Severity Levels](./references/severity-levels.md) — How issues are classified
- [Best Practices](./references/best-practices.md) — Production readiness standards

## Output Quality Guarantees

✅ **Production-Grade**:All recommendations verified and actionable  
✅ **Precise**: Specific code locations and root causes  
✅ **Complete**: All major audit dimensions covered  
✅ **Prioritized**: Issues sorted by impact and effort  
✅ **Signed-Off**: Multi-agent validation with confidence scores  
✅ **Deployment-Ready**: Clear path from findings to production safety  
