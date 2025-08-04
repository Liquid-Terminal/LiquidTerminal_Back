# Guide d'Upload CSV pour les Ressources Éducatives

## Vue d'ensemble

Ce système permet d'importer des ressources éducatives en lot via un fichier CSV. Le système créera automatiquement les catégories si elles n'existent pas et assignera les ressources aux catégories appropriées.

## Format du CSV

Le fichier CSV doit contenir les colonnes suivantes :

| Colonne | Description | Obligatoire | Format |
|---------|-------------|-------------|---------|
| `link` | URL de la ressource | ✅ | URL valide (HTTPS) |
| `category` | Nom de la catégorie | ✅ | Texte (max 100 caractères) |

### Exemple de fichier CSV

```csv
link,category
https://ethereum.org/en/developers/docs/,Blockchain Development
https://docs.soliditylang.org/,Smart Contracts
https://web3js.readthedocs.io/,Web3 Development
https://docs.openzeppelin.com/,DeFi Security
```

## Endpoints API

### 1. Upload CSV

**POST** `/api/educational/csv/upload`

**Headers requis :**
- `Authorization: Bearer <token>` (Token d'authentification)
- `Content-Type: multipart/form-data`

**Body :**
- `csv` : Fichier CSV (max 10MB)

**Permissions :** Modérateur ou Admin

**Réponse de succès :**
```json
{
  "success": true,
  "message": "Import CSV terminé avec succès",
  "data": {
    "totalRows": 8,
    "successfulImports": 7,
    "failedImports": 1,
    "errors": [
      {
        "row": 5,
        "error": "Le lien doit être une URL valide",
        "data": {
          "link": "invalid-url",
          "category": "Test Category"
        }
      }
    ],
    "createdCategories": ["Blockchain Development", "Smart Contracts"]
  }
}
```

### 2. Télécharger le Template

**GET** `/api/educational/csv/template`

**Réponse :**
- Fichier CSV avec des exemples de données

## Fonctionnalités

### ✅ Création automatique des catégories

Si une catégorie n'existe pas dans la base de données, elle sera automatiquement créée avec :
- Le nom fourni dans le CSV
- Une description par défaut : "Catégorie créée automatiquement lors de l'import CSV"
- L'utilisateur qui fait l'upload comme créateur

### ✅ Gestion des doublons

- Si une ressource existe déjà (même URL), elle sera assignée à la nouvelle catégorie si pas déjà fait
- Les ressources ne sont pas dupliquées

### ✅ Validation des données

- **URLs** : Doivent être des URLs HTTPS valides
- **Catégories** : Maximum 100 caractères
- **Liens** : Maximum 500 caractères
- **Fichier** : Maximum 10MB

### ✅ Gestion des erreurs

- Chaque ligne est traitée individuellement
- Les erreurs sont collectées et rapportées
- Le traitement continue même en cas d'erreur sur certaines lignes

## Utilisation côté Frontend

### Exemple avec JavaScript

```javascript
async function uploadCsvFile(file) {
  const formData = new FormData();
  formData.append('csv', file);
  
  try {
    const response = await fetch('/api/educational/csv/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`Import réussi : ${result.data.successfulImports}/${result.data.totalRows} ressources importées`);
      
      if (result.data.errors.length > 0) {
        console.log('Erreurs rencontrées :', result.data.errors);
      }
      
      if (result.data.createdCategories.length > 0) {
        console.log('Nouvelles catégories créées :', result.data.createdCategories);
      }
    } else {
      console.error('Erreur lors de l\'import :', result.error);
    }
  } catch (error) {
    console.error('Erreur réseau :', error);
  }
}
```

### Exemple avec React

```jsx
import { useState } from 'react';

function CsvUploadComponent() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('csv', file);
      
      const response = await fetch('/api/educational/csv/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Erreur :', error);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div>
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileUpload}
        disabled={uploading}
      />
      
      {uploading && <p>Upload en cours...</p>}
      
      {result && (
        <div>
          <h3>Résultat de l'import</h3>
          <p>Total : {result.data.totalRows}</p>
          <p>Succès : {result.data.successfulImports}</p>
          <p>Échecs : {result.data.failedImports}</p>
          
          {result.data.errors.length > 0 && (
            <div>
              <h4>Erreurs :</h4>
              <ul>
                {result.data.errors.map((error, index) => (
                  <li key={index}>
                    Ligne {error.row} : {error.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Codes d'erreur

| Code | Description |
|------|-------------|
| `NO_FILE_PROVIDED` | Aucun fichier CSV fourni |
| `FILE_TOO_LARGE` | Fichier trop volumineux (>10MB) |
| `INVALID_FILE_TYPE` | Format de fichier non supporté |
| `EMPTY_FILE` | Fichier CSV vide |
| `UNAUTHENTICATED` | Utilisateur non authentifié |
| `CSV_PROCESSING_ERROR` | Erreur lors du traitement du CSV |

## Sécurité

- ✅ Validation des types de fichiers
- ✅ Limitation de la taille des fichiers
- ✅ Nettoyage automatique des fichiers temporaires
- ✅ Validation des URLs
- ✅ Authentification et autorisation requises
- ✅ Logging détaillé des opérations

## Logs

Le système génère des logs détaillés pour :
- Le début et la fin du traitement
- Chaque ressource créée
- Chaque catégorie créée
- Les erreurs rencontrées
- Le nettoyage des fichiers

## Tests

Pour tester l'upload CSV :

1. Créez un fichier CSV avec le format approprié
2. Utilisez l'endpoint `/api/educational/csv/upload`
3. Vérifiez la réponse pour les statistiques d'import
4. Consultez les logs pour plus de détails

Exemple de test avec curl :
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "csv=@test-resources.csv" \
  http://localhost:3000/api/educational/csv/upload
``` 