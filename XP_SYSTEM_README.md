# 🎮 Système XP/Niveau - Documentation Backend

> **Version:** 1.1  
> **Date:** 29 Novembre 2025  
> **Status:** ✅ Implémenté et testé - Prêt pour production

---

## 📋 Résumé

Le backend expose un système complet de points d'expérience (XP) et de niveaux pour gamifier l'expérience utilisateur. L'XP est attribué automatiquement lors de certaines actions et peut être consulté via des endpoints dédiés.

---

## 🔗 Endpoints XP

### Base URL
```
Production: https://api.votre-domaine.com   
Development: http://localhost:3002
```

---

### 1️⃣ GET /xp/stats
> Récupère les statistiques XP de l'utilisateur connecté

**Authentification:** 🔒 Requise (Bearer Token)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "totalXp": 150,
    "level": 2,
    "currentLevelXp": 100,
    "nextLevelXp": 283,
    "progressPercent": 27,
    "xpToNextLevel": 133,
    "loginStreak": 3,
    "lastLoginAt": "2025-11-27T10:00:00.000Z"
  }
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `totalXp` | number | Total d'XP accumulé |
| `level` | number | Niveau actuel (1+) |
| `currentLevelXp` | number | XP requis pour le niveau actuel |
| `nextLevelXp` | number | XP requis pour le prochain niveau |
| `progressPercent` | number | Progression vers le prochain niveau (0-100) |
| `xpToNextLevel` | number | XP restant pour level up |
| `loginStreak` | number | Jours consécutifs de connexion |
| `lastLoginAt` | string \| null | Date du dernier login |

---

### 2️⃣ POST /xp/daily-login
> Enregistre un login quotidien et attribue l'XP

**Authentification:** 🔒 Requise (Bearer Token)

**Body:** Aucun (vide)

**⚠️ IMPORTANT:** Appeler cet endpoint **une fois par session** lors de la connexion de l'utilisateur.

**Response 200 (XP accordé):**
```json
{
  "success": true,
  "message": "Daily login XP granted",
  "data": {
    "xpGranted": 10,
    "streakBonus": 0,
    "newStreak": 4
  }
}
```

**Response 200 (déjà connecté aujourd'hui):**
```json
{
  "success": true,
  "message": "Already logged in today",
  "data": {
    "xpGranted": 0,
    "streakBonus": 0,
    "newStreak": 4
  }
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `xpGranted` | number | XP accordé pour le login (10 ou 0) |
| `streakBonus` | number | Bonus streak (50 pour 7j, 200 pour 30j) |
| `newStreak` | number | Nouveau compteur de streak |

---

### 3️⃣ GET /xp/history
> Historique des transactions XP

**Authentification:** 🔒 Requise (Bearer Token)

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page courante |
| `limit` | number | 20 | Éléments par page (max 100) |
| `actionType` | string | - | Filtre par type d'action |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 1,
        "actionType": "REGISTRATION",
        "xpAmount": 100,
        "description": "Welcome bonus for registration",
        "createdAt": "2025-11-27T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

### 4️⃣ GET /xp/leaderboard
> Classement des utilisateurs par XP

**Authentification:** 🌐 Optionnelle (si fournie, retourne `userRank`)

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page courante |
| `limit` | number | 20 | Éléments par page (max 100) |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      { "rank": 1, "userId": 5, "name": "alice", "totalXp": 1500, "level": 8 },
      { "rank": 2, "userId": 12, "name": "bob", "totalXp": 1200, "level": 7 }
    ],
    "userRank": 15,
    "total": 100
  }
}
```

> ℹ️ `userRank` n'est présent que si l'utilisateur est authentifié

---

## 🎁 Endpoints qui retournent `xpGranted`

Les endpoints suivants incluent **automatiquement** un champ `xpGranted` dans leur réponse :

| Endpoint | Méthode | xpGranted | Condition |
|----------|---------|-----------|-----------|
| `/readlists` | POST | 15 | Toujours |
| `/readlists/copy/:id` | POST | 25 | Toujours (copy + create) |
| `/readlists/items/:itemId/read-status` | PATCH | 5 | Seulement si marqué lu pour la 1ère fois |
| `/walletlists` | POST | 15 | Toujours |
| `/walletlists/:id/items` | POST | 10 | Toujours |
| `/xp/daily-login` | POST | 10 | Seulement si pas déjà login aujourd'hui |

**Exemple de réponse avec XP:**
```json
{
  "success": true,
  "data": { ... },
  "xpGranted": 15
}
```

**⚠️ Pour les notifications XP :**
- Vérifier que `xpGranted > 0` avant d'afficher une notification
- Le champ peut être `0` si l'action ne donne pas d'XP (déjà effectuée, etc.)

---

## 📊 Types d'actions XP

| Action | XP | Trigger |
|--------|-----|---------|
| `REGISTRATION` | 100 | Automatique à l'inscription |
| `DAILY_LOGIN` | 10 | Via POST /xp/daily-login |
| `LOGIN_STREAK_7` | 50 | Automatique au 7ème jour consécutif |
| `LOGIN_STREAK_30` | 200 | Automatique au 30ème jour consécutif |
| `REFERRAL_SUCCESS` | 200 | Automatique quand un filleul s'inscrit |
| `CREATE_READLIST` | 15 | Via POST /readlists |
| `MARK_RESOURCE_READ` | 5 | Via PATCH /readlists/items/:id/read-status |
| `COPY_PUBLIC_READLIST` | 10 | Via POST /readlists/copy/:id |
| `CREATE_WALLETLIST` | 15 | Via POST /walletlists |
| `ADD_WALLET_TO_LIST` | 10 | Via POST /walletlists/:id/items |
| `SUBMIT_PUBLIC_GOOD` | 100 | Via POST /publicgoods |
| `PUBLIC_GOOD_APPROVED` | 500 | Automatique quand admin approuve |

---

## 📈 Formule de niveau

```javascript
// XP requis pour atteindre le niveau N
xpForLevel(N) = 100 × (N - 1)^1.5

// Exemples:
// Niveau 1:  0 XP
// Niveau 2:  100 XP
// Niveau 3:  283 XP
// Niveau 5:  800 XP
// Niveau 10: 2,700 XP
// Niveau 20: 8,500 XP
```

---

## 🔄 Flow d'intégration recommandé

### 1. Au login/refresh de l'app
```typescript
// Appeler une seule fois par session
const loginResult = await api.post('/xp/daily-login');
if (loginResult.data.xpGranted > 0) {
  showXpNotification(loginResult.data.xpGranted);
  if (loginResult.data.streakBonus > 0) {
    showStreakBonus(loginResult.data.streakBonus);
  }
}
```

### 2. Récupérer les stats XP
```typescript
const stats = await api.get('/xp/stats');
// Utiliser pour afficher le badge XP dans le header
```

### 3. Gérer les notifications XP sur les actions
```typescript
const response = await api.post('/readlists', data);
if (response.xpGranted > 0) {
  showXpNotification(response.xpGranted);
  // Optionnel: refetch les stats pour mettre à jour le badge
  refetchXpStats();
}
```

---

## ⚠️ Points d'attention

### 1. Idempotence
- `POST /xp/daily-login` est idempotent : plusieurs appels le même jour retournent `xpGranted: 0`
- Les actions avec `referenceId` unique ne donnent l'XP qu'une fois

### 2. Streak
- Le streak se reset à 1 si l'utilisateur ne se connecte pas pendant un jour
- Les bonus streak (7j, 30j) ne sont donnés qu'une seule fois par milestone

### 3. XP conditionnel
- `MARK_RESOURCE_READ` ne donne de l'XP que si la ressource n'était pas déjà lue
- Toujours vérifier `xpGranted > 0` avant d'afficher une notification

### 4. Erreurs
- Les erreurs d'attribution XP sont silencieuses côté backend (l'action principale réussit quand même)
- Si `xpGranted` est absent de la réponse, considérer comme `0`

---

## 🧪 Tester l'intégration

### Via cURL
```bash
# Leaderboard (public)
curl http://localhost:3002/xp/leaderboard

# Stats (auth required)
curl http://localhost:3002/xp/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Daily login (auth required)
curl -X POST http://localhost:3002/xp/daily-login \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Via Postman
1. Importer la collection
2. Configurer la variable `{{token}}` avec un JWT Privy valide
3. Tester les endpoints dans l'ordre : daily-login → stats → history

---

## 📝 Changelog

### v1.1 (29/11/2025)
- 🐛 Fix: Routes XP utilisaient `req.currentUser` qui n'était jamais défini
- ✅ Ajout helper `getUserFromRequest()` pour récupérer l'utilisateur depuis le token Privy
- ✅ Toutes les routes XP fonctionnent maintenant correctement avec l'authentification

### v1.0 (27/11/2025)
- ✅ Implémentation initiale du système XP
- ✅ Endpoints /xp/stats, /xp/daily-login, /xp/history, /xp/leaderboard
- ✅ Attribution automatique d'XP sur les actions existantes
- ✅ Champ `xpGranted` ajouté aux réponses des endpoints concernés
- ✅ Système de streak avec bonus 7j et 30j

---

## 🗂️ Fichiers du système XP

```
src/
├── constants/
│   └── xp.constants.ts        # Config XP rewards + formules niveau
├── types/
│   └── xp.types.ts            # Types TypeScript
├── repositories/
│   └── xp.repository.ts       # Accès base de données
├── services/
│   └── xp/
│       └── xp.service.ts      # Logique métier XP
├── routes/
│   └── xp/
│       └── xp.routes.ts       # Endpoints API
└── prisma/
    └── schema.prisma          # Modèles User (champs XP) + XpTransaction
```

---

## 🆘 Support

Pour toute question sur l'intégration, contacter l'équipe backend ou ouvrir une issue.



