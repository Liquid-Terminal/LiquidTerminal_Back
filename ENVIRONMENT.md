# Configuration des Variables d'Environnement

Ce document décrit toutes les variables d'environnement requises pour faire fonctionner l'application.

## Variables Requises

### Base de Données
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/database_name?schema=public
```
- URL de connexion PostgreSQL avec Prisma
- Format: `postgresql://user:password@host:port/database?schema=public`

### Redis (Cache et Rate Limiting)
```bash
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```
- Configuration Redis pour le cache et le rate limiting
- `REDIS_URL` prend la priorité sur les autres variables Redis

### Authentification Privy
```bash
JWKS_URL=https://auth.privy.io/.well-known/jwks.json
NEXT_PUBLIC_PRIVY_AUDIENCE=your-privy-audience
```
- Configuration pour l'authentification JWT avec Privy
- `JWKS_URL`: URL des clés publiques Privy
- `NEXT_PUBLIC_PRIVY_AUDIENCE`: Audience de votre application Privy

### Configuration du Serveur
```bash
PORT=3002
NODE_ENV=development
BASE_URL=http://localhost:3002
```
- `PORT`: Port d'écoute du serveur (défaut: 3002)
- `NODE_ENV`: Environnement (development/production)
- `BASE_URL`: URL de base pour les uploads de fichiers

### Configuration Admin
```bash
FIRST_ADMIN_PRIVY_USER_ID=your-first-admin-privy-user-id
```
- ID Privy du premier administrateur
- Utilisé par le script `scripts/assign-first-admin.ts`

## Fichier .env

Créez un fichier `.env` à la racine du projet avec ces variables :

```bash
# Copiez ce fichier et remplissez vos valeurs
cp .env.example .env
```

## Sécurité

⚠️ **Important** :
- Ne jamais commiter le fichier `.env` dans Git
- Le fichier `.env` est déjà dans `.gitignore`
- Utilisez des mots de passe forts pour la base de données
- En production, utilisez des services de gestion de secrets

## Développement Local

Pour le développement local, vous pouvez utiliser :

```bash
# Base de données locale
DATABASE_URL=postgresql://yaugourt:password@localhost:5432/hyperinsight?schema=public

# Redis local
REDIS_URL=redis://localhost:6379

# Privy (créez un projet sur privy.io)
JWKS_URL=https://auth.privy.io/.well-known/jwks.json
NEXT_PUBLIC_PRIVY_AUDIENCE=your-project-id

# Serveur local
PORT=3002
NODE_ENV=development
BASE_URL=http://localhost:3002
``` 