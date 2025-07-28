# Sécurité

Ce document décrit les mesures de sécurité implémentées dans ce projet.

## 🔒 Mesures de Sécurité Implémentées

### Authentification
- **JWT Privy** : Authentification sécurisée avec validation cryptographique
- **Middleware d'authentification** : Toutes les routes sensibles protégées
- **Gestion des rôles** : Système de permissions USER/MODERATOR/ADMIN
- **Validation des tokens** : Vérification cryptographique des signatures

### Protection des Données
- **Validation Zod** : Validation stricte de toutes les entrées utilisateur
- **Sanitization** : Nettoyage des inputs avec `sanitize-html`
- **Masquage des données sensibles** : Emails et Privy IDs masqués dans les réponses API
- **Logs sécurisés** : Aucune donnée sensible dans les logs

### Sécurité Web
- **Headers de sécurité** : CSP, HSTS, XSS Protection, etc.
- **CORS configuré** : Origines autorisées strictement définies
- **Rate limiting** : Protection contre les attaques par déni de service
- **Validation des uploads** : Scan de sécurité des fichiers uploadés

### Base de Données
- **Prisma ORM** : Protection contre les injections SQL
- **Transactions** : Intégrité des données garantie
- **Paramètres validés** : Toutes les requêtes utilisent des paramètres
- **Pas de requêtes brutes** : Aucune requête SQL directe

## 🛡️ Routes Protégées

### Routes Publiques
- `GET /health` - Santé de l'application
- `GET /market/*` - Données de marché (lecture seule)
- `GET /vaults/*` - Données de vaults (lecture seule)
- `GET /staking/*` - Données de staking (lecture seule)

### Routes Authentifiées
- `POST /auth/login` - Connexion utilisateur
- `GET /auth/me` - Informations utilisateur connecté
- `GET /auth/user/:id` - Informations utilisateur (propriétaire uniquement)
- `GET /wallet/my-wallets` - Wallets de l'utilisateur
- `POST /wallet/*` - Gestion des wallets
- `GET /readlist/*` - Listes de lecture
- `POST /readlist/*` - Gestion des listes de lecture

### Routes Admin (ADMIN uniquement)
- `GET /auth/admin/users` - Liste des utilisateurs
- `GET /auth/admin/users/:id` - Détails utilisateur
- `PUT /auth/admin/users/:id` - Modification utilisateur
- `DELETE /auth/admin/users/:id` - Suppression utilisateur

## 🔐 Variables d'Environnement Sécurisées

Toutes les données sensibles sont stockées dans des variables d'environnement :

```bash
# Base de données
DATABASE_URL=postgresql://user:password@host:port/db

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# Authentification
JWKS_URL=https://auth.privy.io/.well-known/jwks.json
NEXT_PUBLIC_PRIVY_AUDIENCE=your_audience

# Admin
FIRST_ADMIN_PRIVY_USER_ID=admin_user_id
```

## 🚨 Reporting de Vulnérabilités

Si vous découvrez une vulnérabilité de sécurité :

1. **Ne pas ouvrir d'issue publique**
2. **Contacter directement** : [votre-email@domain.com]
3. **Décrire la vulnérabilité** avec des détails techniques
4. **Attendre la réponse** avant de divulguer publiquement

## 🔍 Audit de Sécurité

### Vérifications Automatiques
- **ESLint** : Détection de patterns dangereux
- **TypeScript** : Vérification de types pour éviter les erreurs
- **Prisma** : Validation des schémas de base de données
- **Zod** : Validation runtime des données

### Tests de Sécurité
```bash
# Lancer les tests
npm test

# Vérification des types
npm run type-check

# Linting
npm run lint
```

## 📋 Checklist de Sécurité

- [x] Authentification JWT sécurisée
- [x] Validation des entrées utilisateur
- [x] Protection contre les injections SQL
- [x] Headers de sécurité configurés
- [x] Rate limiting implémenté
- [x] CORS configuré
- [x] Logs sans données sensibles
- [x] Variables d'environnement pour les secrets
- [x] Uploads de fichiers sécurisés
- [x] Gestion des erreurs sécurisée

## 🔄 Mises à Jour de Sécurité

- **Dépendances** : Mises à jour régulières via `npm audit`
- **Base de données** : Migrations sécurisées avec Prisma
- **Code** : Reviews de sécurité avant merge
- **Infrastructure** : Monitoring des logs et métriques

## 📞 Support Sécurité

Pour toute question concernant la sécurité :
- **Email** : [security@domain.com]
- **Documentation** : Consultez ce fichier et `ENVIRONMENT.md`
- **Issues** : Utilisez le template "Security Issue" si disponible 