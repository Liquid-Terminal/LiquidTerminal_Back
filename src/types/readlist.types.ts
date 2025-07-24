import { BaseResponse } from './common.types';

// Types de base pour les ReadLists
export interface ReadListResponse {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  isPublic: boolean;
  creator: {
    id: number;
    name: string | null;
    email: string | null;
  };
  items: ReadListItemResponse[];
}

// Types pour les opérations CRUD des ReadLists
export interface ReadListCreateInput {
  name: string;
  description?: string;
  userId: number;
  isPublic?: boolean;
}

export interface ReadListUpdateInput {
  name?: string;
  description?: string;
  isPublic?: boolean;
}

// Types de base pour les ReadListItems
export interface ReadListItemResponse {
  id: number;
  readListId: number;
  resourceId: number;
  addedAt: Date;
  isRead: boolean;
  notes: string | null;
  order: number | null;
  resource: {
    id: number;
    url: string;
    createdAt: Date;
    creator: {
      id: number;
      name: string | null;
      email: string | null;
    };
  };
}

// Types pour les opérations CRUD des ReadListItems
export interface ReadListItemCreateInput {
  readListId?: number;
  resourceId: number;
  notes?: string;
  order?: number;
}

export interface ReadListItemUpdateInput {
  isRead?: boolean;
  notes?: string;
  order?: number;
}

// Types pour les réponses simplifiées (sans items pour les listes)
export interface ReadListSummaryResponse {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  isPublic: boolean;
  creator: {
    id: number;
    name: string | null;
    email: string | null;
  };
  itemsCount: number;
}

// Types de réponse API
export interface ReadListResponseWrapper extends BaseResponse {
  data: ReadListResponse;
}

export interface ReadListsResponseWrapper extends BaseResponse {
  data: ReadListSummaryResponse[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ReadListItemResponseWrapper extends BaseResponse {
  data: ReadListItemResponse;
}

export interface ReadListItemsResponseWrapper extends BaseResponse {
  data: ReadListItemResponse[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
} 