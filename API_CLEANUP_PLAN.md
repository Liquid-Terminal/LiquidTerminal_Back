# 🛠️ Plan de Correction API - Hyperinsight Backend

## 📋 Vue d'ensemble
Ce document détaille le plan de correction pour standardiser l'API backend et corriger toutes les violations des conventions HTTP identifiées.

---

## 🔴 **PHASE 1 - CRITIQUE (À faire immédiatement)**

### 1.1 Routes GET manquantes - Validation manquante
**Statut:** 🔴 Critique  
**Temps estimé:** 2-3h

#### Routes à corriger:
- [ ] `src/routes/project/project.routes.ts`
  - Route `GET /` - Ajouter `validateGetRequest`
  - Route `GET /:id` - Ajouter `validateGetRequest`
- [ ] `src/routes/project/category.routes.ts`
  - Route `GET /` - Ajouter `validateGetRequest`
  - Route `GET /:id` - Ajouter `validateGetRequest`
- [ ] `src/routes/readlist/readlist.routes.ts`
  - Route `GET /` - Ajouter `validateGetRequest`
  - Route `GET /:id` - Ajouter `validateGetRequest`
  - Route `GET /user/:userId` - Ajouter `validateGetRequest`
- [ ] `src/routes/readlist/readlist-item.routes.ts`
  - Route `GET /` - Ajouter `validateGetRequest`
  - Route `GET /:id` - Ajouter `validateGetRequest`

#### Actions:
1. Créer les schémas GET manquants dans les fichiers de schémas appropriés
2. Remplacer les routes GET sans validation par `validateGetRequest`
3. Tester que les routes fonctionnent correctement

---

### 1.2 Correction du middleware de validation incorrect
**Statut:** 🔴 Critique  
**Temps estimé:** 30min

#### Routes à corriger:
- [ ] `src/routes/project/project.routes.ts`
  - Route `PUT /:id/category` - Remplacer `validateRequest` par middleware approprié

#### Actions:
1. Identifier si c'est une route PUT qui doit garder `validateRequest`
2. Ou corriger si c'est une erreur

---

## 🟡 **PHASE 2 - IMPORTANT (À faire cette semaine)**

### 2.1 Uniformisation des formats de réponse d'erreur
**Statut:** 🟡 Important  
**Temps estimé:** 4-5h

#### Format cible (standardisé):
```json
{
  "success": false,
  "error": "Human readable message",
  "code": "ERROR_CODE"
}
```

#### Routes avec formats incohérents:
- [ ] `src/routes/perp/marketPerp.routes.ts`
  - Ligne 64-67: Format `{ error: code, message }` → Format standard
- [ ] `src/routes/spot/marketSpot.routes.ts`
  - Ligne 74-77: Format `{ error: code, message }` → Format standard
- [ ] `src/routes/perp/perpStats.routes.ts`
  - Ligne 25-28: Format `{ error: code, message }` → Format standard
  - Ligne 30-34: Format sans `success` → Format standard
- [ ] `src/routes/globalStats.routes.ts`
  - Ligne 20-24: Format sans `success` → Format standard
- [ ] `src/routes/vault/vaults.routes.ts`
  - Ligne 54-57: Format `{ error: code, message }` → Format standard
- [ ] `src/routes/fees/fees.routes.ts`
  - Ligne 18-24: Format avec objet `error` imbriqué → Format standard

#### Actions:
1. Identifier tous les formats d'erreur non-standard
2. Les remplacer par le format cible
3. Vérifier la cohérence dans tout le projet

---

### 2.2 Standardisation des status codes HTTP
**Statut:** 🟡 Important  
**Temps estimé:** 2-3h

#### Problèmes identifiés:
- [ ] **DELETE routes** - Retournent `200` au lieu de `204`
  - Toutes les routes DELETE devraient retourner `204 No Content`
- [ ] **Gestion 404** - Manque dans certaines routes GET par ID
- [ ] **Validation des IDs** - Incohérence dans les messages d'erreur

#### Actions:
1. Auditer tous les status codes
2. Corriger les DELETE pour retourner 204
3. Standardiser les messages de validation d'ID

---

## 🟢 **PHASE 3 - AMÉLIORATIONS (Nice to have)**

### 3.1 Cohérence dans les logs d'erreur
**Statut:** 🟢 Amélioration  
**Temps estimé:** 2h

#### Problèmes identifiés:
- Format incohérent: `{ error }` vs `{ error: error.message }`
- Manque d'informations de contexte dans certains logs

#### Format cible:
```typescript
logDeduplicator.error('Error description:', { 
  error: error instanceof Error ? error.message : String(error),
  context: { /* relevant context */ }
});
```

---

### 3.2 Structure de réponse inconsistante
**Statut:** 🟢 Amélioration  
**Temps estimé:** 3-4h

#### Formats actuels (incohérents):
1. `{ data, pagination }` - Routes simples
2. `{ success, data, pagination }` - Routes avec gestion d'erreur
3. `data` directement - Quelques routes legacy

#### Format cible (standardisé):
```json
{
  "success": true,
  "data": "...",
  "pagination": "...", // si applicable
  "message": "..." // optionnel
}
```

---

### 3.3 Middleware de rate limiting manquants
**Statut:** 🟢 Amélioration  
**Temps estimé:** 1h

#### Routes sans rate limiting:
- Identifier les routes sensibles sans protection
- Ajouter `marketRateLimiter` où nécessaire

---

## 📊 **CHECKLIST DE VALIDATION**

### ✅ Tests à effectuer après chaque phase:

#### Phase 1:
- [ ] Toutes les routes GET ont une validation appropriée
- [ ] Aucune route GET n'accepte de body
- [ ] Les schémas GET sont corrects

#### Phase 2:
- [ ] Format d'erreur uniforme dans toute l'API
- [ ] Status codes HTTP appropriés
- [ ] Messages d'erreur cohérents

#### Phase 3:
- [ ] Logs uniformes et informatifs
- [ ] Structure de réponse cohérente
- [ ] Rate limiting approprié

---

## 🎯 **CRITÈRES DE SUCCÈS**

### Conventions HTTP:
- ✅ Aucune route GET n'accepte de request body
- ✅ Toutes les routes GET utilisent `validateGetRequest`
- ✅ Status codes appropriés (200, 201, 204, 400, 404, 500)

### Cohérence API:
- ✅ Format de réponse uniforme
- ✅ Gestion d'erreur standardisée
- ✅ Logs informatifs et cohérents

### Sécurité:
- ✅ Validation appropriée sur toutes les routes
- ✅ Rate limiting sur les routes sensibles

---

## 📝 **NOTES D'IMPLÉMENTATION**

### Schémas à créer:
```typescript
// project.schemas.ts
export const projectsGetSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    // autres paramètres de query
  }).optional(),
  params: z.object({}).optional()
});

export const projectByIdGetSchema = z.object({
  params: z.object({
    id: z.string()
  }),
  query: z.object({}).optional()
});
```

### Format d'erreur standard:
```typescript
// Remplacer:
res.status(500).json({
  error: 'ERROR_CODE',
  message: 'Human message'
});

// Par:
res.status(500).json({
  success: false,
  error: 'Human message',
  code: 'ERROR_CODE'
});
```

---

## ⏰ **PLANNING SUGGÉRÉ**

- **Jour 1-2:** Phase 1 (Critique)
- **Jour 3-5:** Phase 2 (Important)  
- **Jour 6-7:** Phase 3 (Améliorations)
- **Jour 8:** Tests et validation finale

**Temps total estimé:** 15-20h sur 1-2 semaines 