# Architecture des Clients - Guide Complet

## Vue d'ensemble

Cette documentation explique l'architecture complète des clients dans l'application, depuis les clients API jusqu'aux routes, en passant par les services et middlewares.

## Structure Générale

```
src/
├── clients/           # Clients API externes
├── core/             # Services de base et utilitaires
├── services/         # Couche métier
├── routes/           # Points d'entrée API
├── middleware/       # Middlewares de validation, auth, etc.
├── repositories/     # Accès aux données
├── types/           # Types TypeScript
└── schemas/         # Schémas de validation Zod
```

## 1. Couche Clients (src/clients/)

### Structure des Clients

Tous les clients héritent de `BaseApiService` et suivent le pattern Singleton :

```typescript
// BaseApiService fournit :
- fetchWithTimeout<T>() : gestion des timeouts
- withRetry() : mécanisme de retry
- post<T>() / get<T>() : méthodes HTTP
- handleError() : gestion d'erreurs
```

### Types de Clients

#### A. Clients Hyperliquid (src/clients/hyperliquid/)
- **Spot** : `HyperliquidSpotClient`
- **Perp** : `HyperliquidPerpClient`
- **Vault** : `HyperliquidVaultClient`, `HyperliquidVaultsClient`
- **Staking** : `ValidatorClient`
- **Deploy** : `HyperliquidSpotDeployClient`
- **Token Info** : `HyperliquidTokenInfoClient`
- **Stats** : `HyperliquidSpotStatsClient`, `HyperliquidGlobalStatsClient`

#### B. Clients Hypurrscan (src/clients/hypurrscan/)
- **Auction** : `HypurrscanClient`
- **Validation** : `HypurrscanValidationClient`
- **Unstaking** : `HypurrscanUnstakingClient`
- **Spot USDC** : `SpotUSDCClient`
- **Fees** : `HypurrscanFeesClient`

### Pattern Client Standard

```typescript
export class ExampleClient extends BaseApiService {
  private static instance: ExampleClient;
  private static readonly API_URL = 'https://api.example.com';
  private static readonly REQUEST_WEIGHT = 20;
  private static readonly MAX_WEIGHT_PER_MINUTE = 1200;

  // Cache et polling
  private readonly CACHE_KEY = 'example:data';
  private readonly UPDATE_CHANNEL = 'example:updated';
  private readonly UPDATE_INTERVAL = 10000;
  private pollingInterval: NodeJS.Timeout | null = null;

  // Services intégrés
  private circuitBreaker: CircuitBreakerService;
  private rateLimiter: RateLimiterService;

  private constructor() {
    super(ExampleClient.API_URL);
    this.circuitBreaker = CircuitBreakerService.getInstance('example');
    this.rateLimiter = RateLimiterService.getInstance('example', {
      maxWeightPerMinute: ExampleClient.MAX_WEIGHT_PER_MINUTE,
      requestWeight: ExampleClient.REQUEST_WEIGHT
    });
  }

  public static getInstance(): ExampleClient {
    if (!ExampleClient.instance) {
      ExampleClient.instance = new ExampleClient();
    }
    return ExampleClient.instance;
  }

  public startPolling(): void {
    // Logique de polling avec mise en cache Redis
  }

  private async updateData(): Promise<void> {
    // Récupération et mise en cache des données
  }

  public checkRateLimit(ip: string): boolean {
    return this.rateLimiter.checkRateLimit(ip);
  }
}
```

## 2. Initialisation des Clients

### ClientInitializerService

Le service `ClientInitializerService` centralise l'initialisation :

```typescript
// Dans src/core/client.initializer.service.ts
export class ClientInitializerService {
  private static instance: ClientInitializerService;
  private clients: Map<string, any> = new Map();

  public initialize(): void {
    // Initialise tous les clients
    const spotClient = HyperliquidSpotClient.getInstance();
    this.clients.set('spot', spotClient);
    
    // ... autres clients
    
    // Démarre le polling pour tous
    this.startAllPolling();
  }
}
```

### Intégration dans l'Application

```typescript
// Dans src/app.ts
const clientInitializer = ClientInitializerService.getInstance();
clientInitializer.initialize();
```

## 3. Couche Services (src/services/)

### Pattern Service Standard

Les services utilisent le pattern Singleton et héritent souvent de `BaseService` :

```typescript
export class ExampleService extends BaseService<
  ResponseType, 
  CreateInputType, 
  UpdateInputType, 
  QueryParamsType
> {
  private static instance: ExampleService;
  protected repository = exampleRepository;
  protected cacheKeyPrefix = CACHE_PREFIX.EXAMPLE;
  protected validationSchemas = {
    create: createSchema,
    update: updateSchema,
    query: querySchema
  };
  protected errorClasses = {
    notFound: ExampleNotFoundError,
    alreadyExists: ExampleAlreadyExistsError,
    validation: ExampleValidationError
  };

  public static getInstance(): ExampleService {
    if (!ExampleService.instance) {
      ExampleService.instance = new ExampleService();
    }
    return ExampleService.instance;
  }
}
```

### Types de Services

#### A. Services Métier
- **Market Data** : `SpotAssetContextService`, `PerpAssetContextService`
- **Staking** : `ValidationService`, `UnstakingService`
- **Vault** : `VaultsService`
- **Auth** : `AuthService`
- **Wallet** : `WalletService`
- **Project** : `ProjectService`, `CategoryService`

#### B. Services Utilitaires
- **Global Stats** : `DashboardGlobalStatsService`
- **Fees** : `FeesService`
- **Bridged USDC** : `BridgedUsdcService`

### Connection Client-Service

```typescript
// Exemple : Service utilisant un client
export class ExampleService {
  private readonly client: ExampleClient;
  
  constructor() {
    this.client = ExampleClient.getInstance();
    this.setupSubscriptions(); // Écoute les mises à jour du client
  }
  
  private setupSubscriptions(): void {
    redisService.subscribe(this.UPDATE_CHANNEL, (message) => {
      // Traiter les mises à jour du client
    });
  }
}
```

## 4. Couche Routes (src/routes/)

### Structure des Routes

```
src/routes/
├── auth.routes.ts          # Authentification
├── globalStats.routes.ts   # Stats globales
├── health.routes.ts        # Santé de l'app
├── spot/                   # Routes Spot
│   ├── marketSpot.routes.ts
│   ├── spotStats.routes.ts
│   └── auction.routes.ts
├── perp/                   # Routes Perp
├── vault/                  # Routes Vault
├── staking/                # Routes Staking
├── wallet/                 # Routes Wallet
├── project/                # Routes Project
├── educational/            # Routes Educational
└── fees/                   # Routes Fees
```

### Pattern Route Standard

```typescript
import { Router, Request, Response, RequestHandler } from 'express';
import { ExampleService } from '../services/example.service';
import { marketRateLimiter } from '../middleware/apiRateLimiter';
import { validatePrivyToken } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validation/validation.middleware';
import { exampleSchema } from '../schemas/example.schema';

const router = Router();
const exampleService = ExampleService.getInstance();

// Middlewares globaux pour toutes les routes
router.use(marketRateLimiter);

// Route avec validation et authentification
router.post('/example', 
  validatePrivyToken,                    // Auth middleware
  validateRequest(exampleSchema),        // Validation middleware
  (async (req: Request, res: Response) => {
    try {
      const result = await exampleService.create(req.body);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      // Gestion d'erreurs standardisée
      if (error instanceof ExampleError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }) as RequestHandler
);

export default router;
```

## 5. Couche Middleware (src/middleware/)

### Types de Middlewares

#### A. Authentification
```typescript
// src/middleware/authMiddleware.ts
export const validatePrivyToken = (req: Request, res: Response, next: NextFunction): void => {
  // Validation des tokens Privy
  // Injection de req.user
}
```

#### B. Validation
```typescript
// src/middleware/validation/validation.middleware.ts
export const validateRequest = (schema: AnyZodObject): RequestHandler => {
  // Validation avec Zod
  // Mise en cache des validations
}
```

#### C. Rate Limiting
```typescript
// src/middleware/apiRateLimiter.ts
export const marketRateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Rate limiting multi-niveaux (burst, minute, hour)
  // Utilisation de Redis pour le comptage
}
```

#### D. Sécurité
```typescript
// src/middleware/security.middleware.ts
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Headers de sécurité (CSP, HSTS, etc.)
}
```

#### E. Sanitization
```typescript
// src/middleware/validation/sanitization.middleware.ts
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Nettoyage des entrées utilisateur
}
```

## 6. Flux de Données Complet

### Exemple : Route Spot Markets

```
1. Client fait une requête → GET /api/spot/markets
2. Middlewares appliqués :
   - securityHeaders
   - marketRateLimiter
   - sanitizeInput
3. Route handler appelé
4. Service SpotAssetContextService.getMarkets()
5. Service lit depuis Redis (cache du client)
6. Si cache vide, déclenche mise à jour du client
7. Client HyperliquidSpotClient fait l'appel API
8. Données traitées et mises en cache
9. Service retourne les données
10. Route retourne la réponse JSON
```

### Polling et Mise à Jour

```
1. Client démarre le polling (setInterval)
2. Client fait l'appel API externe
3. Données traitées et stockées dans Redis
4. Message publié sur le canal Redis
5. Services abonnés reçoivent la notification
6. Mise à jour des caches locaux si nécessaire
```

## 7. Gestion des Erreurs

### Hiérarchie d'Erreurs

```typescript
// Erreurs de base
export class BaseError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
}

// Erreurs spécifiques par domaine
export class SpotError extends BaseError {}
export class PerpError extends BaseError {}
export class VaultError extends BaseError {}
// etc.
```

### Gestion dans les Routes

```typescript
try {
  const result = await service.method();
  res.json({ success: true, data: result });
} catch (error) {
  if (error instanceof DomainError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR'
  });
}
```

## 8. Patterns et Bonnes Pratiques

### A. Singleton Pattern
- Tous les clients et services principaux
- Évite les instances multiples
- Partage d'état et de ressources

### B. Circuit Breaker
- Protection contre les APIs externes défaillantes
- Fail-fast en cas de problème
- Récupération automatique

### C. Rate Limiting
- Protection contre les abus
- Limites par IP et par endpoint
- Multi-niveaux (burst, minute, hour)

### D. Caching Strategy
- Redis pour le cache distribué
- Invalidation intelligente
- TTL appropriés selon les données

### E. Polling Strategy
- Intervalles optimisés par type de données
- Gestion des erreurs avec retry
- Évitement des appels concurrents

## 9. Comment Ajouter une Nouvelle Route

### Étapes Standard

1. **Créer le Client** (si nécessaire)
```typescript
// src/clients/provider/new.client.ts
export class NewClient extends BaseApiService {
  // Pattern standard
}
```

2. **Créer le Service**
```typescript
// src/services/new.service.ts
export class NewService extends BaseService {
  // Pattern standard
}
```

3. **Créer le Repository** (si base de données)
```typescript
// src/repositories/new.repository.ts
export class NewRepository implements BaseRepository {
  // CRUD operations
}
```

4. **Créer les Types**
```typescript
// src/types/new.types.ts
export interface NewData {
  // Structure des données
}
```

5. **Créer les Schémas**
```typescript
// src/schemas/new.schema.ts
export const newSchema = z.object({
  // Validation Zod
});
```

6. **Créer les Routes**
```typescript
// src/routes/new.routes.ts
const router = Router();
const newService = NewService.getInstance();

router.use(marketRateLimiter);

router.get('/', async (req, res) => {
  // Handler
});

export default router;
```

7. **Intégrer dans l'App**
```typescript
// src/app.ts
import newRoutes from './routes/new.routes';
app.use('/api/new', newRoutes);
```

8. **Ajouter au ClientInitializer** (si client)
```typescript
// src/core/client.initializer.service.ts
const newClient = NewClient.getInstance();
this.clients.set('new', newClient);
```

## 10. Debugging et Monitoring

### Logs
- `logDeduplicator` pour éviter les logs dupliqués
- Logs structurés avec contexte
- Niveaux appropriés (info, warn, error)

### Métriques
- Rate limiting par IP
- Temps de réponse des APIs
- Erreurs par endpoint
- Utilisation du cache

### Health Checks
- Route `/health` pour vérifier l'état
- Vérification des services externes
- État des clients et connexions

Cette architecture permet une extensibilité facile et une maintenance simplifiée. Chaque couche a sa responsabilité et les patterns sont cohérents à travers l'application. 