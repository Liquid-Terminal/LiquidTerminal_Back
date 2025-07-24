import { BaseResponse } from './common.types';

// Types de base pour les LinkPreviews
export interface LinkPreviewResponse {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Types pour les opérations CRUD des LinkPreviews
export interface LinkPreviewCreateInput {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

export interface LinkPreviewUpdateInput {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

// Type pour les paramètres de requête
export interface LinkPreviewQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

// Type pour les réponses d'API
export interface LinkPreviewApiResponse extends BaseResponse {
  data: LinkPreviewResponse;
}

export interface LinkPreviewBatchResponse extends BaseResponse {
  results: Array<{
    url: string;
    success: boolean;
    data: LinkPreviewResponse | null;
    error: string | null;
  }>;
}

// Type pour les données extraites d'une page web
export interface ExtractedPreviewData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
} 