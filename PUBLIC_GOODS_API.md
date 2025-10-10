# 📋 Public Goods API - Documentation Frontend

## 🎯 Base URL
```
/publicgoods
```

---

## 📊 Enums & Types

### ProjectStatus
```typescript
enum ProjectStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}
```

### DevelopmentStatus
```typescript
enum DevelopmentStatus {
  IDEA = 'IDEA',
  DEVELOPMENT = 'DEVELOPMENT',
  BETA = 'BETA',
  PRODUCTION = 'PRODUCTION'
}
```

### TeamSize
```typescript
enum TeamSize {
  SOLO = 'SOLO',
  SMALL = 'SMALL',
  LARGE = 'LARGE'
}
```

### ExperienceLevel
```typescript
enum ExperienceLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  EXPERT = 'EXPERT'
}
```

### SupportType
```typescript
enum SupportType {
  PROMOTION = 'PROMOTION',
  SERVICES = 'SERVICES',
  FUNDING = 'FUNDING'
}
```

### BudgetRange
```typescript
enum BudgetRange {
  RANGE_0_5K = 'RANGE_0_5K',           // $0-5K
  RANGE_5_15K = 'RANGE_5_15K',         // $5-15K
  RANGE_15_30K = 'RANGE_15_30K',       // $15-30K
  RANGE_30_50K = 'RANGE_30_50K',       // $30-50K
  RANGE_50K_PLUS = 'RANGE_50K_PLUS'    // $50K+
}
```

### Timeline
```typescript
enum Timeline {
  THREE_MONTHS = 'THREE_MONTHS',
  SIX_MONTHS = 'SIX_MONTHS',
  TWELVE_MONTHS = 'TWELVE_MONTHS'
}
```

---

## 🔗 Routes API

### 1. GET /publicgoods - Liste paginée avec filtres
**Auth:** Non requise (mais filtre sur APPROVED par défaut)

**Query Params:**
```typescript
{
  page?: number              // Défaut: 1
  limit?: number             // Défaut: 50
  status?: 'pending' | 'approved' | 'rejected' | 'all'  // Défaut: 'approved'
  category?: string          // Filtrer par catégorie
  search?: string            // Recherche dans name, description, problemSolved, technologies
  developmentStatus?: 'IDEA' | 'DEVELOPMENT' | 'BETA' | 'PRODUCTION'
  sort?: 'submittedAt' | 'name' | 'updatedAt' | 'createdAt'  // Défaut: 'submittedAt'
  order?: 'asc' | 'desc'     // Défaut: 'desc'
}
```

**Response:**
```typescript
{
  success: true,
  data: PublicGood[],
  pagination: {
    total: number,
    page: number,
    limit: number,
    totalPages: number,
    hasNext: boolean,
    hasPrevious: boolean
  }
}
```

**Exemple:**
```bash
GET /publicgoods?page=1&limit=20&status=approved&category=DeFi&search=wallet
```

---

### 2. GET /publicgoods/:id - Détail d'un projet
**Auth:** Non requise

**Response:**
```typescript
{
  success: true,
  data: {
    id: number,
    createdAt: string,
    updatedAt: string,
    
    // Section 1: Le projet
    name: string,
    description: string,
    githubUrl: string,
    demoUrl: string | null,
    websiteUrl: string | null,
    category: string,
    discordContact: string | null,
    telegramContact: string | null,
    
    // Visuels
    logo: string | null,
    banner: string | null,
    screenshots: string[],
    
    // Section 2: Impact HyperLiquid
    problemSolved: string,
    targetUsers: string[],
    hlIntegration: string,
    developmentStatus: DevelopmentStatus,
    
    // Section 3: Équipe & Technique
    leadDeveloperName: string,
    leadDeveloperContact: string,
    teamSize: TeamSize,
    experienceLevel: ExperienceLevel,
    technologies: string[],
    
    // Section 4: Soutien demandé
    supportTypes: SupportType[],
    budgetRange: BudgetRange | null,
    timeline: Timeline | null,
    
    // Métadonnées
    status: ProjectStatus,
    submittedAt: string,
    reviewedAt: string | null,
    reviewNotes: string | null,
    submitterId: number,
    reviewerId: number | null,
    
    // Relations
    submittedBy: {
      id: number,
      name: string | null,
      email: string | null
    },
    reviewedBy: {
      id: number,
      name: string | null,
      email: string | null
    } | null
  }
}
```

---

### 3. GET /publicgoods/my-submissions - Mes projets
**Auth:** JWT required

**Query Params:** Identique à GET /publicgoods (page, limit, sort, order)

**Response:** Identique à GET /publicgoods

---

### 4. POST /publicgoods - Créer un projet
**Auth:** JWT required  
**Content-Type:** `multipart/form-data`

**Body (FormData):**
```typescript
{
  // Section 1: Le projet (REQUIRED)
  name: string,                    // min 3 chars, max 255
  description: string,             // min 100 chars
  githubUrl: string,               // must contain 'github.com'
  demoUrl?: string,                // valid URL
  websiteUrl?: string,             // valid URL
  category: string,                // min 3 chars, max 100
  discordContact?: string,
  telegramContact?: string,
  
  // Visuels (OPTIONAL - fichiers)
  logo?: File,                     // Image max 2MB (jpg/png/webp)
  banner?: File,                   // Image max 5MB (jpg/png/webp)
  screenshots?: File[],            // Max 5 images de 2MB chacune
  
  // Section 2: Impact HyperLiquid (REQUIRED)
  problemSolved: string,           // min 50 chars
  targetUsers: string,             // JSON array: '["developers","traders"]'
  hlIntegration: string,           // min 50 chars
  developmentStatus: 'IDEA' | 'DEVELOPMENT' | 'BETA' | 'PRODUCTION',
  
  // Section 3: Équipe & Technique (REQUIRED)
  leadDeveloperName: string,       // min 2 chars, max 255
  leadDeveloperContact: string,    // valid email
  teamSize: 'SOLO' | 'SMALL' | 'LARGE',
  experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT',
  technologies: string,            // JSON array: '["Python","React"]'
  
  // Section 4: Soutien demandé (OPTIONAL)
  supportTypes?: string,           // JSON array: '["PROMOTION","FUNDING"]'
  budgetRange?: 'RANGE_0_5K' | 'RANGE_5_15K' | 'RANGE_15_30K' | 'RANGE_30_50K' | 'RANGE_50K_PLUS',
  timeline?: 'THREE_MONTHS' | 'SIX_MONTHS' | 'TWELVE_MONTHS'
}
```

**Exemple JS/TS:**
```typescript
const formData = new FormData();

// Champs texte
formData.append('name', 'My Awesome DeFi Tool');
formData.append('description', 'A comprehensive tool for...');
formData.append('githubUrl', 'https://github.com/user/repo');
formData.append('category', 'DeFi');
formData.append('problemSolved', 'This tool solves the problem of...');
formData.append('targetUsers', JSON.stringify(['developers', 'traders']));
formData.append('hlIntegration', 'Integrates with HyperLiquid API to...');
formData.append('developmentStatus', 'BETA');
formData.append('leadDeveloperName', 'John Doe');
formData.append('leadDeveloperContact', 'john@example.com');
formData.append('teamSize', 'SMALL');
formData.append('experienceLevel', 'INTERMEDIATE');
formData.append('technologies', JSON.stringify(['React', 'Node.js', 'TypeScript']));

// Fichiers (optionnels)
if (logoFile) formData.append('logo', logoFile);
if (bannerFile) formData.append('banner', bannerFile);
if (screenshotFiles.length > 0) {
  screenshotFiles.forEach(file => formData.append('screenshots', file));
}

// Optionnels
formData.append('supportTypes', JSON.stringify(['FUNDING', 'PROMOTION']));
formData.append('budgetRange', 'RANGE_15_30K');
formData.append('timeline', 'SIX_MONTHS');

const response = await fetch('/publicgoods', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Response:**
```typescript
{
  success: true,
  message: "Project submitted successfully",
  data: PublicGood  // Objet complet avec status: PENDING
}
```

---

### 5. PUT /publicgoods/:id - Modifier un projet
**Auth:** JWT required  
**Authorization:** Owner OU ADMIN  
**Content-Type:** `multipart/form-data`

**Body:** Identique au POST, tous les champs optionnels

**Business Logic:**
⚠️ Si le projet était `APPROVED` et qu'on le modifie, il sera automatiquement reset à `PENDING`

**Response:**
```typescript
{
  success: true,
  message: "Project updated successfully",
  data: PublicGood
}
```

---

### 6. DELETE /publicgoods/:id - Supprimer un projet
**Auth:** JWT required  
**Authorization:** Owner OU ADMIN

**Response:**
```typescript
{
  success: true,
  message: "Project deleted successfully"
}
```

---

### 7. PATCH /publicgoods/:id/review - Review un projet
**Auth:** JWT required  
**Authorization:** MODERATOR ou ADMIN

**Body:**
```typescript
{
  status: 'APPROVED' | 'REJECTED',  // Required
  reviewNotes?: string
}
```

**Response:**
```typescript
{
  success: true,
  message: "Project reviewed successfully",
  data: PublicGood  // Avec reviewedAt, reviewerId, reviewNotes mis à jour
}
```

---

### 8. GET /publicgoods/pending - Liste des projets en attente
**Auth:** JWT required  
**Authorization:** MODERATOR ou ADMIN

**Query Params:** page, limit, sort, order (comme GET /publicgoods)

**Response:** Identique à GET /publicgoods (filtrés status=PENDING)

---

## 🔒 Authentification

Toutes les routes protégées nécessitent un header Authorization :
```typescript
headers: {
  'Authorization': `Bearer ${privyToken}`
}
```

---

## ⚠️ Validations Frontend

### Champs Required
- `name` (3-255 chars)
- `description` (min 100 chars)
- `githubUrl` (doit contenir 'github.com')
- `category` (3-100 chars)
- `problemSolved` (min 50 chars)
- `targetUsers` (array min 1 élément)
- `hlIntegration` (min 50 chars)
- `developmentStatus`
- `leadDeveloperName` (2-255 chars)
- `leadDeveloperContact` (email valide)
- `teamSize`
- `experienceLevel`
- `technologies` (array min 1 élément)

### Upload Limits
- **Logo:** Max 2MB, formats: jpg/jpeg/png/gif/webp
- **Banner:** Max 5MB, formats: jpg/jpeg/png/gif/webp
- **Screenshots:** Max 5 fichiers de 2MB chacun, formats: jpg/jpeg/png/gif/webp

---

## 🎨 Exemples de Filtres

### Tous les projets APPROVED
```bash
GET /publicgoods?status=approved
```

### Projets en BETA dans la catégorie DeFi
```bash
GET /publicgoods?developmentStatus=BETA&category=DeFi
```

### Recherche "wallet"
```bash
GET /publicgoods?search=wallet
```

### Tous les projets (ADMIN)
```bash
GET /publicgoods?status=all
```

### Projets en attente (MODERATOR)
```bash
GET /publicgoods/pending
```

---

## 📝 Notes Importantes

1. **Par défaut**, GET /publicgoods retourne seulement les projets `APPROVED`
2. Les fichiers uploadés sont accessibles via : `BASE_URL/uploads/publicgoods/{logos|banners|screenshots}/filename.jpg`
3. Les arrays (`targetUsers`, `technologies`, `supportTypes`) doivent être stringify en JSON pour FormData
4. Après modification d'un projet `APPROVED`, il repasse automatiquement en `PENDING`
5. Les `screenshots` sont un array d'URLs (pas de limite côté backend une fois uploadé)

---

## 🚨 Codes d'Erreur

```typescript
// 400 Bad Request
'INVALID_JSON_FORMAT'        // JSON mal formé dans targetUsers/technologies/supportTypes
'INVALID_FILE_TYPE'          // Type de fichier non supporté
'FILE_TOO_LARGE'             // Fichier trop volumineux
'TOO_MANY_FILES'             // Trop de fichiers uploadés
'MALICIOUS_FILE'             // Fichier détecté comme malveillant
'PUBLIC_GOOD_ALREADY_EXISTS' // Nom de projet déjà utilisé
'PUBLIC_GOOD_VALIDATION_ERROR' // Validation Zod échouée
'INVALID_ID_FORMAT'          // ID invalide

// 401 Unauthorized
'UNAUTHENTICATED'            // Token JWT manquant
'USER_NOT_FOUND'             // User non trouvé en DB
'MISSING_TOKEN'              // Bearer token manquant
'INVALID_PAYLOAD'            // Token payload invalide

// 403 Forbidden
'PUBLIC_GOOD_PERMISSION_ERROR' // Pas les droits (ownership)
'INSUFFICIENT_PERMISSIONS'   // Pas le role requis (MODERATOR/ADMIN)

// 404 Not Found
'PUBLIC_GOOD_NOT_FOUND'      // Projet non trouvé

// 500 Internal Server Error
'INTERNAL_SERVER_ERROR'      // Erreur serveur générique
'INTERNAL_UPLOAD_ERROR'      // Erreur lors de l'upload
'SECURITY_SCAN_ERROR'        // Erreur scan sécurité
```

---

## 🎯 Use Cases Frontend

### Afficher la liste publique
```typescript
const { data, pagination } = await fetch('/publicgoods?status=approved&page=1&limit=20');
// Afficher data (tous APPROVED)
```

### Soumettre un projet
```typescript
// 1. Créer FormData
// 2. POST /publicgoods avec JWT
// 3. Projet créé avec status: PENDING
// 4. Rediriger vers "My Submissions" ou afficher success
```

### Mes soumissions
```typescript
const { data } = await fetch('/publicgoods/my-submissions', {
  headers: { Authorization: `Bearer ${token}` }
});
// Afficher tous les projets de l'user (PENDING/APPROVED/REJECTED)
```

### Review (Moderator)
```typescript
// 1. GET /publicgoods/pending (liste)
// 2. GET /publicgoods/:id (détail)
// 3. PATCH /publicgoods/:id/review avec status + notes
```

---

Bonne intégration ! 🚀

