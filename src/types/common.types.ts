export interface BaseResponse {
  success: boolean;
  error?: string;
}

export interface TimeRange {
  startTime?: number;
  endTime?: number;
}

export interface TokenAmount {
  amount: string;
  decimals: number;
}

export interface SocialLinks {
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
  github?: string;
  farcaster?: string;
}

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