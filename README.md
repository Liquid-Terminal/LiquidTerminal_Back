# Liquid Terminal Backend

Liquid Terminal Backend is a comprehensive API and data processing platform dedicated to the HyperLiquid ecosystem. Our goal is to provide robust, scalable services that power the Liquid Terminal frontend and enable developers to build on top of HyperLiquid data.

## 🚀 Features

- **Real-time Market Data** - Live spot and perpetual market feeds from HyperLiquid
- **Market Analytics** - Volume, market cap, and trading statistics
- **Auction System** - Real-time auction data and timing information
- **User Management** - Secure authentication with Privy integration
- **Wallet Management** - Multi-wallet support with limits and validation
- **Wallet Lists** - Curated lists for portfolio management
- **Educational Resources** - Comprehensive learning materials
- **Project Database** - Ecosystem project tracking and categorization
- **Staking Data** - Validator information and staking statistics
- **Rate Limiting** - Multi-tier protection against abuse
- **Caching** - Redis-based high-performance caching
- **Real-time Updates** - WebSocket support for live data

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for high-performance data caching
- **Authentication**: Privy JWT validation
- **Validation**: Zod schema validation
- **Rate Limiting**: Redis-based multi-tier rate limiting
- **File Upload**: Multer with validation
- **Logging**: Custom log deduplication system
- **Circuit Breaker**: Fault tolerance for external APIs
- **Deployment**: Railway-ready

## 📁 Project Structure

```
src/
├── app.ts                   # Express app configuration
├── server.ts                # Server entry point
├── core/                    # Core services and utilities
│   ├── base.api.service.ts  # Base API service class
│   ├── cache.service.ts     # Redis caching service
│   ├── circuit.breaker.ts   # Circuit breaker implementation
│   ├── client.initializer.ts # API clients initialization
│   ├── crudBase.service.ts  # Base CRUD service
│   ├── prisma.service.ts    # Prisma database client
│   ├── redis.service.ts     # Redis client
│   └── transaction.service.ts # Database transactions
├── clients/                 # External API clients
│   ├── hyperliquid/         # HyperLiquid API clients
│   │   ├── spot/            # Spot market clients
│   │   ├── perp/            # Perpetual market clients
│   │   └── vault/           # Vault clients
│   └── hypurrscan/          # Hypurrscan API clients
├── services/                # Business logic services
│   ├── auth/                # Authentication services
│   ├── spot/                # Spot market services
│   ├── perp/                # Perpetual market services
│   ├── wallet/              # Wallet management
│   ├── walletlist/          # Wallet list management
│   ├── educational/         # Educational content
│   ├── project/             # Project management
│   └── staking/             # Staking services
├── routes/                  # API route handlers
│   ├── auth/                # Authentication routes
│   ├── spot/                # Spot market routes
│   ├── perp/                # Perpetual market routes
│   ├── wallet/              # Wallet routes
│   ├── walletlist/          # Wallet list routes
│   ├── educational/         # Educational routes
│   ├── project/             # Project routes
│   └── staking/             # Staking routes
├── repositories/            # Data access layer
│   ├── interfaces/          # Repository interfaces
│   └── prisma/              # Prisma implementations
├── middleware/              # Express middleware
│   ├── authMiddleware.ts    # Privy authentication
│   ├── apiRateLimiter.ts    # Rate limiting
│   ├── roleMiddleware.ts    # Role-based access
│   ├── security.middleware.ts # Security headers
│   └── validation/          # Request validation
├── schemas/                 # Zod validation schemas
├── types/                   # TypeScript type definitions
├── errors/                  # Custom error classes
├── constants/               # Application constants
├── utils/                   # Utility functions
└── prisma/                  # Database schema and migrations
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- npm, yarn, pnpm, or bun

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Liquid-Terminal/LiquidTerminal_Back.git
   cd LiquidTerminal_Back
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/liquidterminal"
   
   # Redis
   REDIS_URL="redis://localhost:6379"
   
   # Authentication
   PRIVY_APP_ID="your_privy_app_id"
   PRIVY_APP_SECRET="your_privy_app_secret"
   
   # Security
   ALLOWED_ORIGINS="http://localhost:3000,https://liquidterminal.xyz"
   
   # Server
   PORT=3002
   NODE_ENV=development
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run migrations
   npx prisma migrate dev
   
   # (Optional) Seed the database
   npx prisma db seed
   ```

5. **Start Redis**
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:alpine
   
   # Or using local Redis installation
   redis-server
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Verify the setup**
   Navigate to [http://localhost:3002/health](http://localhost:3002/health)

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests (when implemented)
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed the database
- `npm run db:studio` - Open Prisma Studio

### API Documentation

The API follows RESTful principles with comprehensive error handling and rate limiting.

#### Base URL
- **Development**: `http://localhost:3002`
- **Production**: `https://liquidterminal.up.railway.app`

#### Rate Limits
- **Burst**: 20 requests per second
- **Minute**: 1,200 requests per minute
- **Hour**: 72,000 requests per hour

#### Authentication
Protected routes require a Privy JWT token:
```
Authorization: Bearer <privy_jwt_token>
```

#### Example Endpoints

**Market Data**
```bash
# Get spot market data
GET /market/spot?sortBy=volume&limit=20&page=1

# Get perpetual market data
GET /market/perp?sortBy=openInterest&limit=20&page=1

# Get global spot statistics
GET /market/spot/globalstats

# Get auction data
GET /market/spot/auction
```

**User Management**
```bash
# Login/register user
POST /auth/login
Authorization: Bearer <privy_token>

# Get user profile
GET /auth/user
Authorization: Bearer <privy_token>
```

**Wallet Management**
```bash
# Add wallet to user
POST /wallet
Authorization: Bearer <privy_token>
Content-Type: application/json
{
  "address": "0x123...",
  "name": "My Wallet"
}

# Get user wallets
GET /wallet/user
Authorization: Bearer <privy_token>
```

### Database Schema

The application uses Prisma ORM with PostgreSQL. Key entities:

- **User** - User accounts with Privy integration
- **Wallet** - Ethereum wallet addresses
- **UserWallet** - User-wallet associations
- **WalletList** - Curated wallet collections
- **Project** - Ecosystem projects
- **EducationalContent** - Learning resources

### Caching Strategy

Redis is used extensively for caching:
- **Market Data**: 10-second cache with real-time updates
- **User Data**: 5-minute cache
- **Static Content**: 1-hour cache
- **Rate Limiting**: Real-time counters

### Error Handling

Standardized error responses:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Code Style

- **TypeScript** - Strict type checking
- **ESLint** - Code quality enforcement
- **Prettier** - Code formatting (when configured)
- **Conventional Commits** - Structured commit messages

## 🔒 Security

- **Rate Limiting** - Multi-tier protection
- **Input Validation** - Zod schema validation
- **Authentication** - Privy JWT verification
- **Authorization** - Role-based access control
- **CORS** - Configurable origin restrictions
- **Security Headers** - Helmet.js integration
- **SQL Injection** - Prisma ORM protection
- **Circuit Breaker** - External API fault tolerance

## 📊 Monitoring

- **Logging** - Comprehensive logging with deduplication
- **Health Checks** - `/health` endpoint
- **Performance** - Redis caching metrics
- **Error Tracking** - Structured error logging

## 🚀 Deployment

### Railway Deployment

1. **Connect Repository**
   - Link your GitHub repository to Railway
   - Set up automatic deployments

2. **Environment Variables**
   ```env
   DATABASE_URL=<railway_postgres_url>
   REDIS_URL=<railway_redis_url>
   PRIVY_APP_ID=<your_privy_app_id>
   PRIVY_APP_SECRET=<your_privy_app_secret>
   ALLOWED_ORIGINS=<your_frontend_domains>
   NODE_ENV=production
   ```

3. **Build Configuration**
   ```json
   {
     "build": {
       "commands": [
         "npm run build",
         "npx prisma migrate deploy"
       ]
     },
     "start": {
       "command": "npm start"
     }
   }
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3002
CMD ["npm", "start"]
```

## 📚 Documentation

- [Client Architecture](CLIENT_ARCHITECTURE.md) - System architecture overview
- [Environment Setup](ENVIRONMENT.md) - Development environment guide
- [API Implementation Guide](docs/API_IMPLEMENTATION.md) - Adding new endpoints

## 🔗 Related Projects

- **Frontend**: [LiquidTerminal_Front](https://github.com/Liquid-Terminal/LiquidTerminal_Front)

## 🔗 Links

- **Website**: [liquidterminal.xyz](https://liquidterminal.xyz)
- **X**: [@LiquidTerminal](https://x.com/liquidterminal)
- **API Documentation**: [liquid-terminal.gitbook.io](https://liquid-terminal.gitbook.io/liquid-terminal/liquid-api)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **HyperLiquid** - For providing the foundational trading and defi infrastructure
- **Privy** - For secure authentication services
- **Railway** - For reliable hosting infrastructure
- **Hypurrscan** - For providing HyperLiquid endpoints.

---

Built with ❤️ by the Liquid Terminal team