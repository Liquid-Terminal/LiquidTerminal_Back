# 🎮 Système XP/Niveau - Guide d'intégration Frontend

## Contexte

Le backend expose un système XP/Niveau pour tracker la progression des utilisateurs. Ce document décrit les endpoints disponibles et ce qu'il faut implémenter côté frontend.

---

## Endpoints API disponibles

**Base URL:** Variable selon l'environnement  
**Headers requis pour routes protégées:**
```
Authorization: Bearer <privy_jwt_token>
```

---

### 1. GET /xp/stats (🔒 Authentifié)

Récupère les stats XP de l'utilisateur connecté.

**Response:**
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

---

### 2. POST /xp/daily-login (🔒 Authentifié)

Enregistre un login quotidien et attribue l'XP. **À appeler à chaque connexion de l'utilisateur.**

**Response (XP accordé):**
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

**Response (déjà connecté aujourd'hui):**
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

---

### 3. GET /xp/history (🔒 Authentifié)

Historique des transactions XP de l'utilisateur.

**Query params (optionnels):**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `actionType` (filtre par type d'action)

**Response:**
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
      },
      {
        "id": 2,
        "actionType": "DAILY_LOGIN",
        "xpAmount": 10,
        "description": null,
        "createdAt": "2025-11-27T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "totalPages": 1
    }
  }
}
```

---

### 4. GET /xp/leaderboard (🌐 Public)

Classement des utilisateurs par XP. Pas besoin d'authentification.

**Query params (optionnels):**
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      { "rank": 1, "userId": 5, "name": "alice", "totalXp": 1500, "level": 8 },
      { "rank": 2, "userId": 12, "name": "bob", "totalXp": 1200, "level": 7 },
      { "rank": 3, "userId": 3, "name": "charlie", "totalXp": 950, "level": 6 }
    ],
    "userRank": 15,
    "total": 100
  }
}
```

> Note: `userRank` n'est présent que si l'utilisateur est authentifié.

---

## Types d'actions XP (enum XpActionType)

| Action | XP | Condition |
|--------|-----|-----------|
| `REGISTRATION` | 100 | Une fois à l'inscription |
| `DAILY_LOGIN` | 10 | Une fois par jour |
| `LOGIN_STREAK_7` | 50 | Bonus à 7 jours consécutifs |
| `LOGIN_STREAK_30` | 200 | Bonus à 30 jours consécutifs |
| `REFERRAL_SUCCESS` | 200 | Quand un filleul s'inscrit |
| `CREATE_READLIST` | 15 | Créer une readlist |
| `MARK_RESOURCE_READ` | 5 | Marquer une ressource comme lue |
| `COPY_PUBLIC_READLIST` | 10 | Copier une readlist publique |
| `CREATE_WALLETLIST` | 15 | Créer une wallet list |
| `ADD_WALLET_TO_LIST` | 10 | Ajouter un wallet à une liste |
| `SUBMIT_PUBLIC_GOOD` | 100 | Soumettre un public good |
| `PUBLIC_GOOD_APPROVED` | 500 | Public good approuvé |

---

## Formule de niveau

```
XP requis pour niveau N = 100 × (N-1)^1.5
```

| Niveau | XP Total Requis |
|--------|-----------------|
| 1 | 0 |
| 2 | 100 |
| 3 | 283 |
| 5 | 800 |
| 10 | 2,700 |
| 20 | 8,500 |
| 50 | 34,000 |

---

## Implémentation Frontend demandée

### 1. Hook `useXp()`

Créer un hook React qui :
- Fetch les stats XP de l'utilisateur au chargement (si connecté)
- Appelle automatiquement `POST /xp/daily-login` à la première connexion du jour
- Expose `{ stats, history, isLoading, error, refetch }`
- Gère le cache/revalidation

```typescript
interface UseXpReturn {
  stats: XpStats | null;
  history: XpTransaction[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

### 2. Composant `<XpBadge />`

Affiche de manière compacte :
- Le niveau actuel (avec icône/badge visuel)
- Une barre de progression circulaire ou linéaire vers le prochain niveau
- Le streak de connexion avec icône 🔥
- Animation satisfaisante quand l'XP augmente

**Props:**
```typescript
interface XpBadgeProps {
  compact?: boolean; // Version mini pour header
  showStreak?: boolean;
  onClick?: () => void; // Pour ouvrir un modal détaillé
}
```

### 3. Composant `<XpLeaderboard />`

Affiche :
- Top 10 (ou configurable) des utilisateurs
- Highlight de l'utilisateur actuel si dans le top
- Position de l'utilisateur actuel si pas dans le top visible
- Pagination ou infinite scroll

**Props:**
```typescript
interface XpLeaderboardProps {
  limit?: number;
  showCurrentUser?: boolean;
}
```

### 4. Composant `<XpHistoryList />`

Affiche l'historique des gains XP avec :
- Icône par type d'action
- Date relative (il y a 2h, hier, etc.)
- Pagination

### 5. Toast/Notification XP

Système de notification quand l'utilisateur gagne de l'XP :
- Animation de "+10 XP" qui monte et disparaît
- Son optionnel (désactivable)
- Affichage du nouveau niveau si level up

---

## Authentification

L'application utilise **Privy** pour l'authentification.

Le token JWT est récupéré via :
```typescript
import { usePrivy } from '@privy-io/react-auth';

const { getAccessToken } = usePrivy();
const token = await getAccessToken();

// Utiliser dans les headers
fetch('/xp/stats', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Design Guidelines

- **Couleurs XP:** Gradient doré/violet pour les éléments XP
- **Animations:** 
  - Barre de progression animée
  - Particles/confetti au level up
  - Bounce effect sur gain d'XP
- **Icônes suggérées:**
  - ⭐ Niveau/Level
  - 🔥 Streak
  - 📈 XP gain
  - 🏆 Leaderboard

---

## Exemple d'utilisation

```tsx
// Dans le layout principal
function AppLayout({ children }) {
  const { authenticated } = usePrivy();
  
  return (
    <div>
      <Header>
        {authenticated && <XpBadge compact onClick={openXpModal} />}
      </Header>
      {children}
      <XpNotificationProvider />
    </div>
  );
}

// Dans une page profil
function ProfilePage() {
  const { stats, history, isLoading } = useXp();
  
  return (
    <div>
      <XpBadge showStreak />
      <XpHistoryList transactions={history} />
    </div>
  );
}

// Page leaderboard
function LeaderboardPage() {
  return <XpLeaderboard limit={50} showCurrentUser />;
}
```

---

## Notes techniques

- Le daily login est idempotent : plusieurs appels le même jour ne donnent de l'XP qu'une fois
- Le streak se reset si l'utilisateur ne se connecte pas pendant 1 jour
- Les bonus de streak (7j, 30j) sont donnés automatiquement
- L'XP des actions (readlist, wallet, etc.) est attribuée automatiquement par le backend lors des actions

---

## Endpoints qui retournent `xpGranted`

Les endpoints suivants incluent `xpGranted` dans leur réponse pour permettre au frontend d'afficher des notifications :

| Endpoint | xpGranted |
|----------|-----------|
| `POST /readlists` | 15 (CREATE_READLIST) |
| `POST /readlists/copy/:id` | 25 (COPY + CREATE) |
| `PATCH /readlists/items/:itemId/read-status` | 5 si marqué lu pour la 1ère fois |
| `POST /walletlists` | 15 (CREATE_WALLETLIST) |
| `POST /walletlists/:id/items` | 10 (ADD_WALLET_TO_LIST) |
| `POST /xp/daily-login` | 10 + bonus streak éventuel |

**Exemple de réponse avec XP :**
```json
{
  "success": true,
  "data": { ... },
  "xpGranted": 15
}
```

