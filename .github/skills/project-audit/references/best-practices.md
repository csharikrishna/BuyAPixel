# Production Readiness Best Practices

This document outlines best practices verified during audits to ensure production-grade quality.

## Code Quality

### Design Principles
- **SOLID Principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **DRY (Don't Repeat Yourself)**: Eliminate code duplication
- **KISS (Keep It Simple, Stupid)**: Favor simplicity over premature optimization
- **Separation of Concerns**: Each module has one reason to change

### Error Handling Pattern
```typescript
// ✅ Good: Comprehensive error handling
async function fetchUserData(userId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    const response = await fetch(`/api/users/${userId}`, {
      signal: controller.signal
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error('Failed to fetch user data', {
      userId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    throw new UserDataFetchError(`Could not load user ${userId}`);
  } finally {
    clearTimeout(timeout);
  }
}

// ❌ Bad: No error handling
async function fetchUserData(userId: string) {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}
```

## Security Best Practices

### Input Validation
```typescript
// ✅ Good: Validate and sanitize
function processEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  if (!isValidEmail(trimmed)) {
    throw new ValidationError('Invalid email format');
  }
  return trimmed;
}

// ❌ Bad: No validation
function processEmail(email: string): string {
  return email;
}
```

### API Security
```typescript
// ✅ Good: Comprehensive auth and rate limiting
app.post('/api/users', 
  authenticateJWT,     // Verify token
  rateLimiter(10, '1h'), // 10 requests per hour
  validateInput(userSchema), // Validate body
  async (req, res) => {
    // Handler
  }
);

// ❌ Bad: No auth or rate limiting
app.post('/api/users', async (req, res) => {
  // Anyone can hit this endpoint unlimited times
});
```

### Secrets Management
```typescript
// ✅ Good: Use environment variables
const dbPassword = process.env.DATABASE_PASSWORD; // From Vault/Secrets Manager
if (!dbPassword) throw new Error('DATABASE_PASSWORD not set');

// ❌ Bad: Hardcoded secrets
const dbPassword = 'mysecuresqlpassword123'; // In source code!
```

## Performance Best Practices

### Database Optimization
```typescript
// ✅ Good: Optimized query with index
// Index: CREATE INDEX idx_user_email ON users(email)
const user = await db.query(
  'SELECT id, email, name FROM users WHERE email = $1',
  [email]
);

// ❌ Bad: N+1 query pattern
const users = await db.query('SELECT * FROM users');
for (const user of users) {
  user.orders = await db.query('SELECT * FROM orders WHERE user_id = $1', [user.id]);
  // 1 + n queries!
}
```

### Caching Strategy
```typescript
// ✅ Good: Cache with invalidation
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
async function getUserWithCache(userId: string) {
  const cached = cache.get(`user:${userId}`);
  if (cached) return cached;
  
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  cache.set(`user:${userId}`, user, CACHE_TTL);
  
  return user;
}

// On user update:
function invalidateUserCache(userId: string) {
  cache.delete(`user:${userId}`);
}

// ❌ Bad: No cache invalidation
async function getUserWithCache(userId: string) {
  const cached = cache.get(`user:${userId}`);
  if (cached) return cached; // Stale data possible!
  
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  cache.set(`user:${userId}`, user);
  
  return user;
}
```

### Frontend Performance
```typescript
// ✅ Good: Code splitting and lazy loading
const PaymentForm = React.lazy(() => import('./PaymentForm'));

export function Checkout() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PaymentForm />
    </Suspense>
  );
}

// ✅ Good: Image optimization
<img 
  src="/images/hero.webp"
  srcSet="/images/hero-small.webp 480w, /images/hero-large.webp 1200w"
  sizes="(max-width: 600px) 480px, 1200px"
  alt="Hero image"
  loading="lazy"
/>

// ❌ Bad: No code splitting, large images
import * as PaymentLogic from './payment'; // All loaded upfront
<img src="/images/unoptimized.jpg" /> {/* Large file, no srcSet */}
```

## Architecture Best Practices

### Service Layer Pattern
```typescript
// ✅ Good: Separation of concerns
// API Layer
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Service Layer
class UserService {
  async getUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError();
    return user;
  }
}

// Repository Layer
class UserRepository {
  async findById(userId: string): Promise<User | null> {
    return db.query('SELECT * FROM users WHERE id = $1', [userId]);
  }
}

// ❌ Bad: Mixed concerns
app.get('/api/users/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!result) return res.status(404).json({});
  res.json(result);
});
```

### Dependency Injection
```typescript
// ✅ Good: Constructor injection for testability
class UserService {
  constructor(private userRepository: UserRepository) {}
  
  async getUserById(id: string) {
    return this.userRepository.findById(id);
  }
}

// Easy to test with mock
const mockRepo = new MockUserRepository();
const service = new UserService(mockRepo);

// ❌ Bad: Hard-coded dependencies
class UserService {
  private userRepository = new UserRepository(); // Can't mock!
  
  async getUserById(id: string) {
    return this.userRepository.findById(id);
  }
}
```

## Testing Best Practices

### Unit Test Pattern
```typescript
// ✅ Good: Clear, focused unit tests
describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<UserRepository>;
  
  beforeEach(() => {
    mockRepository = mock(UserRepository);
    service = new UserService(mockRepository);
  });
  
  it('should return user when found', async () => {
    mockRepository.findById.mockResolvedValue({ id: '1', name: 'John' });
    
    const user = await service.getUserById('1');
    
    expect(user.name).toBe('John');
    expect(mockRepository.findById).toHaveBeenCalledWith('1');
  });
  
  it('should throw error when user not found', async () => {
    mockRepository.findById.mockResolvedValue(null);
    
    await expect(service.getUserById('1')).rejects.toThrow(NotFoundError);
  });
});
```

### Error Scenario Testing
```typescript
// ✅ Good: Test error paths
describe('API error handling', () => {
  it('should handle network timeout gracefully', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('timeout'));
    
    const result = await fetchUserSafely('1');
    
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });
});

// ❌ Bad: Only test happy path
describe('API', () => {
  it('should fetch user', async () => {
    const user = await fetchUser('1');
    expect(user).toBeTruthy();
  });
});
```

## Deployment Best Practices

### Environment Configuration
```typescript
// ✅ Good: Environment-based configuration
const config = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: process.env.NODE_ENV === 'production',
  },
  api: {
    timeout: process.env.API_TIMEOUT_MS || '5000',
    retries: parseInt(process.env.API_RETRIES || '3'),
  },
};

// ❌ Bad: Hardcoded environment values
const config = {
  db: { host: 'localhost', port: 5432, ssl: false },
  api: { timeout: '5000' },
};
```

### Logging Strategy
```typescript
// ✅ Good: Structured logging with levels
logger.info('User login attempt', {
  userId: '123',
  ip: req.ip,
  timestamp: new Date().toISOString()
});

logger.error('Database connection failed', {
  error: error.message,
  retry_count: attempts,
  severity: 'critical'
});

// ❌ Bad: Unstructured strings
console.log('Trying to connect to DB');
console.log('Error: ' + error.toString());
```

## Monitoring Best Practices

### Key Metrics
- **Response Time**: p99 < 200ms for normal operations
- **Error Rate**: < 0.1% under normal load
- **CPU Usage**: Stay below 80% under peak load
- **Memory**: No memory leaks, stable over time
- **Database Connections**: Pool utilization < 70%

### Alerting Thresholds
```javascript
// ✅ Good: Appropriate thresholds
alerts = [
  { metric: 'error_rate', threshold: 1.0, severity: 'CRITICAL' },
  { metric: 'response_time_p99', threshold: 500, severity: 'HIGH' },
  { metric: 'cpu_usage', threshold: 85, severity: 'HIGH' },
  { metric: 'db_connection_pool', threshold: 80, severity: 'MEDIUM' }
];

// ❌ Bad: No alerting or too many false positives
// No monitoring at all, or alerts for everything
```

## Documentation Best Practices

### README Structure
```markdown
# Project Name
Brief description

## Quick Start
3-5 step setup with commands

## Architecture
System diagram and components

## API Documentation
Endpoints with examples

## Development
Local setup and debugging

## Deployment
Steps for staging and production

## Troubleshooting
Common issues and solutions
```

### Code Comments
```typescript
// ✅ Good: Explain the why, not the what
// User data is fetched with exponential backoff because the API
// occasionally experiences transient failures during peak hours (9-10am)
async function fetchUserWithRetry(userId: string) {
  return retry(fetch, { maxRetries: 3, backoff: 'exponential' });
}

// ❌ Bad: Restates what code does
// Fetch the user
const user = await fetch(...);
```

---

Use this guide as the baseline for production-readiness evaluation during audits.
