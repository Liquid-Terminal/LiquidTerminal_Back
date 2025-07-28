# Environment Variables Configuration

This document describes all the environment variables required to run the application.

## Required Variables

### Database
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/database_name?schema=public
```
- PostgreSQL connection URL with Prisma
- Format: `postgresql://user:password@host:port/database?schema=public`

### Redis (Cache and Rate Limiting)
```bash
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```
- Redis configuration for cache and rate limiting
- `REDIS_URL` takes priority over other Redis variables

### Privy Authentication
```bash
JWKS_URL=https://auth.privy.io/.well-known/jwks.json
NEXT_PUBLIC_PRIVY_AUDIENCE=your-privy-audience
```
- Configuration for JWT authentication with Privy
- `JWKS_URL`: URL of Privy public keys
- `NEXT_PUBLIC_PRIVY_AUDIENCE`: Your Privy application audience

### Server Configuration
```bash
PORT=3002
NODE_ENV=development
BASE_URL=http://localhost:3002
```
- `PORT`: Server listening port (default: 3002)
- `NODE_ENV`: Environment (development/production)
- `BASE_URL`: Base URL for file uploads

### Admin Configuration
```bash
FIRST_ADMIN_PRIVY_USER_ID=your-first-admin-privy-user-id
```
- Privy ID of the first administrator
- Used by the `scripts/assign-first-admin.ts` script

## .env File

Create a `.env` file at the project root with these variables:

```bash
# Copy this file and fill in your values
cp .env.example .env
```

## Security

⚠️ **Important**:
- Never commit the `.env` file to Git
- The `.env` file is already in `.gitignore`
- Use strong passwords for the database
- In production, use secret management services

## Local Development

For local development, you can use:

```bash
# Local database
DATABASE_URL=postgresql://yaugourt:password@localhost:5432/hyperinsight?schema=public

# Local Redis
REDIS_URL=redis://localhost:6379

# Privy (create a project on privy.io)
JWKS_URL=https://auth.privy.io/.well-known/jwks.json
NEXT_PUBLIC_PRIVY_AUDIENCE=your-project-id

# Local server
PORT=3002
NODE_ENV=development
BASE_URL=http://localhost:3002
``` 