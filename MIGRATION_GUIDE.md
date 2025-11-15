# 🔄 Guide de Migration des Images vers R2

## 🎯 Contexte

Ce guide explique comment migrer toutes les images existantes de Railway vers Cloudflare R2.

**Avant:**
```
https://liquidterminal.up.railway.app/uploads/logos/$XULIAN.jpg
```

**Après:**
```
https://pub-097cebbc75d04a3fbd5d0e416820c1a5.r2.dev/projects/logos/$XULIAN.jpg
```

---

## 📋 Prérequis

1. ✅ R2 configuré avec Public Development URL activé
2. ✅ Variables d'env R2 ajoutées sur Railway:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
   - `R2_PUBLIC_URL`
3. ✅ Code R2 déployé sur Railway

---

## 🔐 Étape 1: Générer un Token de Migration

Ajoute cette variable d'env sur Railway (et en local pour tester):

```bash
MIGRATION_SECRET_TOKEN=your-super-secret-token-here-change-me
```

**⚠️ IMPORTANT:** Utilise un token aléatoire fort:
```bash
# Générer un token sécurisé
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚀 Étape 2: Lancer la Migration

### **Via Postman/Insomnia/curl**

```bash
curl -X POST https://liquidterminal.up.railway.app/admin/migrate-images-to-r2 \
  -H "X-Migration-Token: your-super-secret-token-here-change-me"
```

### **Via fetch (navigateur)**

```javascript
fetch('https://liquidterminal.up.railway.app/admin/migrate-images-to-r2', {
  method: 'POST',
  headers: {
    'X-Migration-Token': 'your-super-secret-token-here-change-me'
  }
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## 📊 Response Attendue

```json
{
  "success": true,
  "data": {
    "message": "Migration completed",
    "stats": {
      "projects": {
        "total": 207,
        "migrated": 207,
        "failed": 0
      },
      "publicGoods": {
        "total": 15,
        "migrated": 15,
        "failed": 0
      }
    }
  }
}
```

---

## ⏱️ Durée Estimée

**Estimation:**
- 1 image = ~2-3 secondes (download + upload + DB update)
- 200 projets avec logo + banner = ~600 images
- **Durée totale: ~20-30 minutes**

**⚠️ Pendant la migration:**
- L'API reste accessible
- Les nouvelles créations fonctionnent normalement
- Les images en cours de migration peuvent être temporairement inaccessibles

---

## 🔍 Suivi de la Migration

Les logs sont visibles sur Railway:
```
🚀 Starting image migration to R2...
Found 207 projects to migrate
✅ Project 1 migrated
✅ Project 2 migrated
...
✅ Migration completed
```

---

## ✅ Étape 3: Vérification Post-Migration

### **1. Vérifier un projet au hasard**

```bash
curl https://liquidterminal.up.railway.app/project | jq '.data[0].logo'
```

**Résultat attendu:**
```
"https://pub-097cebbc75d04a3fbd5d0e416820c1a5.r2.dev/projects/logos/image.jpg"
```

### **2. Vérifier que l'image s'affiche**

Ouvre l'URL dans un navigateur, l'image doit s'afficher.

---

## 🗑️ Étape 4: Cleanup (Après Vérification)

Une fois que tout fonctionne:

### **1. Supprimer l'endpoint admin**

Commente ou supprime la route dans `app.ts`:
```typescript
// app.use('/admin', migrateRoutes); // Migration terminée
```

### **2. Supprimer la variable d'env**

Supprime `MIGRATION_SECRET_TOKEN` de Railway.

### **3. Redéployer**

Push le code pour retirer l'endpoint admin.

---

## 🚨 En Cas de Problème

### **Erreur: "Invalid migration token"**

✅ Vérifie que `MIGRATION_SECRET_TOKEN` est bien configuré sur Railway

### **Erreur: "Failed to migrate image"**

✅ Check les logs Railway pour voir quelle image a échoué
✅ L'image reste avec son ancienne URL (pas de perte de données)
✅ Tu peux relancer la migration, elle skip les images déjà migrées

### **Timeout / Trop long**

✅ La migration continue en background
✅ Check les logs Railway pour suivre le progrès
✅ Les images sont migrées une par une, pas de rollback nécessaire

---

## 📝 Ce que Fait le Script

1. **Fetch tous les projets** avec des URLs `/uploads/`
2. **Pour chaque projet:**
   - Télécharge le logo depuis Railway
   - Upload vers R2 (`projects/logos/`)
   - Télécharge le banner depuis Railway  
   - Upload vers R2 (`projects/banners/`)
   - Update la DB avec les nouvelles URLs R2
3. **Pareil pour les PublicGoods** (logo, banner, screenshots)

**Sécurité:**
- Si une image échoue → garde l'ancienne URL (pas de casse)
- Pas de suppression des anciennes images (safe)
- Transaction par projet (isolation des erreurs)

---

## ✨ Après la Migration

✅ Toutes les images sont sur R2 CDN  
✅ Plus de problème d'éphémère Railway  
✅ Performance CDN mondial  
✅ Pas de coût bandwidth  
✅ Nouveaux uploads vont direct sur R2

**Les anciennes images sur Railway:**
- Restent présentes (pas de suppression automatique)
- Seront perdues au prochain redeploy (normal, plus utilisées)

---

## 🎯 Checklist Complète

- [ ] Variables R2 ajoutées sur Railway
- [ ] Code R2 déployé
- [ ] `MIGRATION_SECRET_TOKEN` généré et ajouté
- [ ] Migration lancée via curl/Postman
- [ ] Attendre la fin (20-30 min)
- [ ] Vérifier les URLs des projets
- [ ] Vérifier que les images s'affichent
- [ ] Supprimer l'endpoint admin
- [ ] Supprimer `MIGRATION_SECRET_TOKEN`
- [ ] Redéployer

---

**Questions?** Check les logs Railway ou ping @dev! 🚀

