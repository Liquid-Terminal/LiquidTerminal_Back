# 📊 Migration de Pagination - Plan Complet

## 🎯 Objectif
Standardiser le format de pagination à travers toute l'API pour avoir une interface cohérente et prévisible.

## 🔄 Nouveau Format Standard

### Interface BasePagination
```typescript
// src/types/common.types.ts
export interface BasePagination {
  page: number;           // Numéro de page actuelle
  limit: number;          // Nombre d'éléments par page
  total: number;          // Total d'éléments
  totalPages: number;     // Total de pages
  hasNext: boolean;       // A une page suivante
  hasPrevious: boolean;   // A une page précédente
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: BasePagination;
  metadata?: {
    lastUpdate?: number;
    isFresh?: boolean;
    timeSinceLastUpdate?: number;
    totalVolume?: number;  // Pour les markets
    [key: string]: any;    // Extensible pour autres métadonnées
  };
}
```

## 📁 Fichiers à Modifier

### 1. Types (14 fichiers)

#### `src/types/common.types.ts`
- ✅ **AJOUTER** : `BasePagination` interface
- ✅ **AJOUTER** : `PaginatedResponse<T>` interface

#### `src/types/market.types.ts`
- 🔄 **MODIFIER** : `PaginatedResponse<T>` (lignes 225-239)
  ```diff
  - export interface PaginatedResponse<T> {
  -     data: T[];
  -     pagination: {
  -         total: number;
  -         page: number;
  -         limit: number;
  -         totalPages: number;
  -         totalVolume?: number;
  -     };
  -     metadata?: { ... };
  - }
  + // Supprimer cette interface, utiliser celle de common.types.ts
  ```

#### `src/types/staking.types.ts`
- 🔄 **MODIFIER** : `PaginatedResponse<T>` (lignes 103-113)
  ```diff
  - export interface PaginatedResponse<T> {
  -   data: T[];
  -   pagination: {
  -     currentPage: number;
  -     totalPages: number;
  -     totalItems: number;
  -     itemsPerPage: number;
  -     hasNextPage: boolean;
  -     hasPreviousPage: boolean;
  -   };
  - }
  + // Supprimer cette interface, utiliser celle de common.types.ts
  ```

#### `src/types/leaderboard.types.ts`
- 🔄 **MODIFIER** : `PaginatedLeaderboardResponse` (lignes 38-46)
  ```diff
  - export interface PaginatedLeaderboardResponse {
  -   data: ProcessedLeaderboardEntry[];
  -   pagination: {
  -     total: number;
  -     page: number;
  -     limit: number;
  -     pages: number;
  -   };
  - }
  + export interface PaginatedLeaderboardResponse {
  +   data: ProcessedLeaderboardEntry[];
  +   pagination: BasePagination;
  + }
  ```

#### `src/types/readlist.types.ts`
- 🔄 **MODIFIER** : Interfaces avec pagination (lignes 93-98, 107-112)
  ```diff
  - pagination?: {
  -   total: number;
  -   page: number;
  -   limit: number;
  -   totalPages: number;
  - };
  + pagination?: BasePagination;
  ```

#### `src/types/educational.types.ts`
- 🔄 **MODIFIER** : Interfaces avec pagination (lignes 90-95, 104-109)
  ```diff
  - pagination?: {
  -   total: number;
  -   page: number;
  -   limit: number;
  -   totalPages: number;
  - };
  + pagination?: BasePagination;
  ```

#### `src/types/vault.types.ts`
- 🔄 **VÉRIFIER** : Format de pagination actuel

### 2. Repository Interfaces (8 fichiers)

#### `src/repositories/interfaces/project.repository.interface.ts`
- 🔄 **MODIFIER** : `FindAllResult` (lignes 17-22)
  ```diff
  - pagination: {
  -   total: number;
  -   page: number;
  -   limit: number;
  -   totalPages: number;
  - };
  + pagination: BasePagination;
  ```

#### `src/repositories/interfaces/category.repository.interface.ts`
- 🔄 **MODIFIER** : Même changement que project

#### `src/repositories/interfaces/educational-resource.repository.interface.ts`
- 🔄 **MODIFIER** : `FindAllResult` (lignes 24-29)

#### `src/repositories/interfaces/educational-category.repository.interface.ts`
- 🔄 **MODIFIER** : `FindAllResult` (lignes 21-26)

#### `src/repositories/interfaces/linkPreview.repository.interface.ts`
- 🔄 **MODIFIER** : `FindAllResult` (lignes 20-25)

#### `src/repositories/interfaces/readlist.repository.interface.ts`
- 🔄 **MODIFIER** : Interfaces avec pagination

#### `src/repositories/interfaces/readlist-item.repository.interface.ts`
- 🔄 **MODIFIER** : `FindAllResult` (lignes 22-27, 61-66)

#### `src/repositories/interfaces/user.repository.interface.ts`
- 🔄 **VÉRIFIER** : Format de pagination actuel

### 3. Repository Implementations (8 fichiers)

#### `src/repositories/prisma/prisma.project.repository.ts`
- 🔄 **MODIFIER** : `findAll` méthode (lignes 107-112)
  ```diff
  - pagination: {
  -   total,
  -   page,
  -   limit,
  -   totalPages: Math.ceil(total / limit)
  - }
  + pagination: {
  +   total,
  +   page,
  +   limit,
  +   totalPages: Math.ceil(total / limit),
  +   hasNext: page < Math.ceil(total / limit),
  +   hasPrevious: page > 1
  + }
  ```

#### `src/repositories/prisma/prisma.category.repository.ts`
- 🔄 **MODIFIER** : Même changement (lignes 75-80)

#### `src/repositories/prisma/prisma.educational-resource.repository.ts`
- 🔄 **MODIFIER** : `findAll` méthode (lignes 143-148)

#### `src/repositories/prisma/prisma.educational-category.repository.ts`
- 🔄 **MODIFIER** : `findAll` méthode (lignes 92-97)

#### `src/repositories/prisma/prisma.linkPreview.repository.ts`
- 🔄 **MODIFIER** : `findAll` méthode (lignes 84-89)

#### `src/repositories/prisma/prisma.readlist.repository.ts`
- 🔄 **MODIFIER** : Méthodes avec pagination (lignes 156-161, etc.)

#### `src/repositories/prisma/prisma.readlist-item.repository.ts`
- 🔄 **MODIFIER** : `findAll` méthode (lignes 128-133)

#### `src/repositories/prisma/prisma.user.repository.ts`
- 🔄 **VÉRIFIER** : Implémentation actuelle

### 4. Services (9 fichiers)

#### `src/services/wallet/wallet.service.ts`
- 🔄 **MODIFIER** : `getWalletsByUser` méthode (lignes 190-195)
  ```diff
  - pagination: {
  -   total: result.total,
  -   page,
  -   limit,
  -   pages: Math.ceil(result.total / limit)
  - }
  + pagination: {
  +   total: result.total,
  +   page,
  +   limit,
  +   totalPages: Math.ceil(result.total / limit),
  +   hasNext: page < Math.ceil(result.total / limit),
  +   hasPrevious: page > 1
  + }
  ```

#### `src/services/leaderboard/leaderboard.service.ts`
- 🔄 **MODIFIER** : `getLeaderboard` méthode
  ```diff
  - pages: Math.ceil(totalEntries / limit)
  + totalPages: Math.ceil(totalEntries / limit),
  + hasNext: page < Math.ceil(totalEntries / limit),
  + hasPrevious: page > 1
  ```

#### `src/services/staking/validation.service.ts`
- 🔄 **MODIFIER** : `getAllValidations` méthode
  ```diff
  - pagination: {
  -   currentPage: page,
  -   totalPages: Math.ceil(totalCount / limit),
  -   totalItems: totalCount,
  -   itemsPerPage: limit,
  -   hasNextPage: page < Math.ceil(totalCount / limit),
  -   hasPreviousPage: page > 1
  - }
  + pagination: {
  +   page,
  +   totalPages: Math.ceil(totalCount / limit),
  +   total: totalCount,
  +   limit,
  +   hasNext: page < Math.ceil(totalCount / limit),
  +   hasPrevious: page > 1
  + }
  ```

#### `src/services/staking/unstaking.service.ts`
- 🔄 **MODIFIER** : Même changement que validation.service.ts

#### `src/services/staking/stakedHolders.service.ts`
- 🔄 **MODIFIER** : Même changement que validation.service.ts

#### `src/services/spot/marketData.service.ts`
- 🔄 **VÉRIFIER** : Format de pagination actuel

#### `src/services/perp/perpAssetContext.service.ts`
- 🔄 **VÉRIFIER** : Format de pagination actuel

#### `src/services/vault/vaults.service.ts`
- 🔄 **VÉRIFIER** : Format de pagination actuel

#### `src/services/auth/user.service.ts`
- 🔄 **MODIFIER** : Format "pages" → "totalPages"

## 🛣️ Routes à Vérifier (14 endpoints)

### Routes avec pagination confirmée :

1. **`GET /project`** - `src/routes/project/project.routes.ts`
   - ✅ Déjà compatible (utilise `projectService.getAll()`)

2. **`GET /category`** - `src/routes/project/category.routes.ts`  
   - ✅ Déjà compatible (utilise `categoryService.getAll()`)

3. **`GET /market/spot`** - `src/routes/spot/marketSpot.routes.ts`
   - 🔄 **VÉRIFIER** : Response format (ligne 55)

4. **`GET /market/perp`** - `src/routes/perp/marketPerp.routes.ts`
   - 🔄 **VÉRIFIER** : Response format (ligne 43)

5. **`GET /leaderboard`** - `src/routes/leaderboard/leaderboard.routes.ts`
   - 🔄 **VÉRIFIER** : Response format (ligne 44)

6. **`GET /market/vaults`** - `src/routes/vault/vaults.routes.ts`
   - 🔄 **VÉRIFIER** : Response format

7. **`GET /staking/validations`** - `src/routes/staking/validation.routes.ts`
   - 🔄 **MODIFIER** : Logs de pagination (lignes 38-40)
   ```diff
   - page: result.pagination.currentPage,
   + page: result.pagination.page,
   ```

8. **`GET /staking/unstaking-queue`** - `src/routes/staking/unstaking.routes.ts`
   - 🔄 **MODIFIER** : Même changement que validations

9. **`GET /staking/holders`** - `src/routes/staking/stakedHolders.routes.ts`
   - 🔄 **MODIFIER** : Même changement que validations

10. **`GET /educational/resources`** - `src/routes/educational/educational-resource.routes.ts`
    - ✅ Déjà compatible (utilise `educationalResourceService.getAll()`)

11. **`GET /educational/categories`** - `src/routes/educational/educational-category.routes.ts`
    - ✅ Déjà compatible (utilise `educationalCategoryService.getAll()`)

12. **`GET /readlists`** - `src/routes/readlist/readlist.routes.ts`
    - ✅ Déjà compatible (utilise `readlistService.getAll()`)

13. **`GET /wallet`** - `src/routes/wallet/wallet.routes.ts`
    - 🔄 **VÉRIFIER** : Response format (lignes 113, 141)

14. **`GET /user`** - `src/routes/auth/user.auth.routes.ts`
    - 🔄 **MODIFIER** : Response format (lignes 38-43)
    ```diff
    - pagination: {
    -   page,
    -   limit,
    -   total: result.total,
    -   pages: result.pages
    - }
    + pagination: {
    +   page,
    +   limit,
    +   total: result.total,
    +   totalPages: result.pages,
    +   hasNext: page < result.pages,
    +   hasPrevious: page > 1
    + }
    ```

## 🧪 Tests à Effectuer

### Tests Unitaires
- [ ] Vérifier que tous les repositories retournent le bon format
- [ ] Tester les calculs `hasNext` et `hasPrevious`
- [ ] Vérifier la compatibilité avec les anciens clients

### Tests d'Intégration
- [ ] Tester chaque endpoint avec pagination
- [ ] Vérifier que le frontend reçoit le bon format
- [ ] Tester les cas limites (page 1, dernière page, pas de résultats)

## ⚡ Ordre de Migration Recommandé

### Phase 1 - Base (1 jour)
1. Créer `BasePagination` dans `common.types.ts`
2. Mettre à jour les imports dans tous les fichiers types

### Phase 2 - Repositories (1 jour)  
3. Modifier toutes les interfaces repository
4. Adapter toutes les implémentations repository
5. Ajouter les calculs `hasNext`/`hasPrevious`

### Phase 3 - Services (1 jour)
6. Adapter les services qui ne passent pas par BaseService
7. Vérifier les services market/leaderboard/staking

### Phase 4 - Routes & Tests (1 jour)
8. Vérifier toutes les routes
9. Corriger les logs de pagination  
10. Tests complets

## 🚨 Points d'Attention

### Breaking Changes
- ⚠️ `pages` → `totalPages`
- ⚠️ `currentPage` → `page`  
- ⚠️ `totalItems` → `total`
- ⚠️ `itemsPerPage` → `limit`
- ⚠️ `hasNextPage` → `hasNext`
- ⚠️ `hasPreviousPage` → `hasPrevious`

### Compatibilité Frontend
- Le frontend devra être mis à jour en parallèle
- Considérer une période de transition avec les deux formats

### Performance
- Les calculs `hasNext`/`hasPrevious` sont légers
- Pas d'impact sur les performances existantes

## 📊 Résumé des Modifications

| Type | Nombre de fichiers | Effort |
|------|-------------------|--------|
| Types | 6 fichiers | 🟡 Moyen |
| Repository Interfaces | 8 fichiers | 🟢 Facile |  
| Repository Implémentations | 8 fichiers | 🟡 Moyen |
| Services | 9 fichiers | 🟡 Moyen |
| Routes | 14 fichiers | 🟢 Facile |
| **TOTAL** | **45 fichiers** | **🔴 Important** |

**Durée estimée : 4 jours** (1 développeur expérimenté)
