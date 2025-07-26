# Guide d'Upload de Fichiers

## Routes disponibles

### 1. Créer un projet avec upload de logo
```
POST /project/with-upload
```

**Headers requis :**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body (FormData) :**
- `title` (string) - Titre du projet
- `desc` (string) - Description du projet  
- `logo` (file) - Image du logo (JPG, PNG, GIF, WebP, max 5MB)
- `twitter` (string, optionnel) - URL Twitter
- `discord` (string, optionnel) - URL Discord
- `telegram` (string, optionnel) - URL Telegram
- `website` (string, optionnel) - URL du site web
- `categoryId` (number, optionnel) - ID de la catégorie

### 2. Créer un projet avec URL de logo
```
POST /project
```

**Headers requis :**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body (JSON) :**
```json
{
  "title": "Mon Projet",
  "desc": "Description du projet",
  "logo": "https://example.com/logo.png",
  "categoryId": 1
}
```

## Différence entre les routes

| Aspect | `/project/with-upload` | `/project` |
|--------|----------------------|------------|
| **Content-Type** | `multipart/form-data` | `application/json` |
| **Logo** | Fichier uploadé | URL de l'image |
| **Validation** | Scan de sécurité + validation | Validation standard |
| **Stockage** | Fichier sur serveur | URL externe |
| **Utilisation** | Upload direct | Lien vers image existante |

## Exemple d'utilisation côté frontend

### Avec FormData (upload de fichier)
```javascript
const formData = new FormData();
formData.append('title', 'Mon Projet');
formData.append('desc', 'Description du projet');
formData.append('logo', fileInput.files[0]); // Fichier sélectionné
formData.append('categoryId', '1');

const response = await fetch('/project/with-upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### Avec JSON (URL de logo)
```javascript
const response = await fetch('/project', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Mon Projet',
    desc: 'Description du projet',
    logo: 'https://example.com/logo.png',
    categoryId: 1
  })
});
```

## Formats de fichiers supportés
- JPG/JPEG
- PNG  
- GIF
- WebP

## Limitations
- Taille maximum : 5MB
- 1 fichier par requête
- Seules les images sont autorisées

## Sécurité

### Mesures de sécurité implémentées :

1. **Validation des types MIME** : Vérification stricte des types MIME autorisés
2. **Validation des extensions** : Seules les extensions d'images sont acceptées
3. **Vérification des signatures de fichiers** : Analyse des magic bytes pour détecter les faux positifs
4. **Scan de contenu malveillant** : Détection de code exécutable caché
5. **Noms de fichiers sécurisés** : Génération de noms uniques avec hash
6. **Nettoyage automatique** : Suppression des anciens fichiers (7 jours par défaut)
7. **Logging de sécurité** : Traçabilité complète des uploads

### Types de fichiers autorisés :
- JPG/JPEG (signature: FF D8 FF)
- PNG (signature: 89 50 4E 47)
- GIF (signature: 47 49 46)
- WebP (signature: 52 49 46 46)

### Contenu interdit :
- Code PHP (`<?php`)
- Scripts JavaScript (`<script`, `javascript:`)
- VBScript (`vbscript:`)
- Événements HTML (`onload=`, `onerror=`)

## Stockage
Les fichiers sont stockés dans `uploads/project-logos/` avec un nom unique généré automatiquement.

## URLs générées
Les URLs des fichiers uploadés suivent le format :
```
http://localhost:3000/uploads/project-logos/project-logo-1234567890-123456789.png
``` 