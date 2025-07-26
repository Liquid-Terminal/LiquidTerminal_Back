// Types pour les uploads de fichiers
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
}

// Type pour les requêtes avec fichiers uploadés
export interface RequestWithFile extends Express.Request {
  file?: Express.Multer.File;
}

// Type pour les réponses d'upload
export interface UploadResponse {
  success: boolean;
  filename?: string;
  url?: string;
  error?: string;
  code?: string;
}

// Types pour les validations de fichiers
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  code?: string;
}

// Configuration des uploads
export interface UploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  uploadPath: string;
} 