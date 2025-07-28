# File Upload Guide

## Available Routes

### 1. Create a project with logo upload
```
POST /project/with-upload
```

**Required Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body (FormData):**
- `title` (string) - Project title
- `desc` (string) - Project description  
- `logo` (file) - Logo image (JPG, PNG, GIF, WebP, max 5MB)
- `twitter` (string, optional) - Twitter URL
- `discord` (string, optional) - Discord URL
- `telegram` (string, optional) - Telegram URL
- `website` (string, optional) - Website URL
- `categoryId` (number, optional) - Category ID

### 2. Create a project with logo URL
```
POST /project
```

**Required Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "title": "My Project",
  "desc": "Project description",
  "logo": "https://example.com/logo.png",
  "categoryId": 1
}
```

## Difference between routes

| Aspect | `/project/with-upload` | `/project` |
|--------|----------------------|------------|
| **Content-Type** | `multipart/form-data` | `application/json` |
| **Logo** | Uploaded file | Image URL |
| **Validation** | Security scan + validation | Standard validation |
| **Storage** | File on server | External URL |
| **Usage** | Direct upload | Link to existing image |

## Frontend usage example

### With FormData (file upload)
```javascript
const formData = new FormData();
formData.append('title', 'My Project');
formData.append('desc', 'Project description');
formData.append('logo', fileInput.files[0]); // Selected file
formData.append('categoryId', '1');

const response = await fetch('/project/with-upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### With JSON (logo URL)
```javascript
const response = await fetch('/project', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'My Project',
    desc: 'Project description',
    logo: 'https://example.com/logo.png',
    categoryId: 1
  })
});
```

## Supported file formats
- JPG/JPEG
- PNG  
- GIF
- WebP

## Limitations
- Maximum size: 5MB
- 1 file per request
- Only images are allowed

## Security

### Implemented security measures:

1. **MIME type validation**: Strict verification of allowed MIME types
2. **Extension validation**: Only image extensions are accepted
3. **File signature verification**: Magic bytes analysis to detect false positives
4. **Malicious content scanning**: Detection of hidden executable code
5. **Secure filenames**: Generation of unique names with hash
6. **Automatic cleanup**: Deletion of old files (7 days by default)
7. **Security logging**: Complete traceability of uploads

### Allowed file types:
- JPG/JPEG (signature: FF D8 FF)
- PNG (signature: 89 50 4E 47)
- GIF (signature: 47 49 46)
- WebP (signature: 52 49 46 46)

### Forbidden content:
- PHP code (`<?php`)
- JavaScript scripts (`<script`, `javascript:`)
- VBScript (`vbscript:`)
- HTML events (`onload=`, `onerror=`)

## Storage
Files are stored in `uploads/project-logos/` with a unique name generated automatically.

## Generated URLs
Uploaded file URLs follow the format:
```
http://localhost:3000/uploads/project-logos/project-logo-1234567890-123456789.png
``` 