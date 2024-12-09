export interface PrivyPayload {
    sub: string; // ID utilisateur unique (Privy DID)
    linked_accounts?: {
      farcaster?: { username: string };
      github?: { username: string };
      twitter?: { username: string };
    };
    custom_metadata?: string;
    [key: string]: any;
  }
  