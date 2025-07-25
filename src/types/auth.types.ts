import { JWTPayload } from 'jose';
import { UserRole } from '@prisma/client';

export interface PrivyPayload extends JWTPayload {
  sub: string; // ID utilisateur unique (Privy DID)
  role?: UserRole; // ← NOUVEAU
  linked_accounts?: {
    farcaster?: { username: string };
    github?: { username: string };
    twitter?: { username: string };
  };
  custom_metadata?: string;
  [key: string]: any;
}
  