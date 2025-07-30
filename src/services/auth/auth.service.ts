// import { importJWK, jwtVerify } from "jose"; // Supprimé pour import dynamique
import { PrivyPayload } from "../../types/auth.types";
import { JWKSError, SigningKeyError, TokenValidationError, UserNotFoundError } from "../../errors/auth.errors";
import { logDeduplicator } from "../../utils/logDeduplicator";
import { userRepository } from "../../repositories/user.repository";
import { ReferralService } from "./referral.service";

const JWKS_URL = process.env.JWKS_URL!;

export class AuthService {
  private static instance: AuthService;
  private referralService = ReferralService.getInstance();
  private jwksCache = new Map<string, { key: CryptoKey; expiresAt: number }>();

  private constructor() { }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private async loadJose(): Promise<any> {
    return await import('jose');
  }

  private async getSigningKey(header: { kid: string }): Promise<CryptoKey> {
    try {
      // Vérifier le cache d'abord
      const cached = this.jwksCache.get(header.kid);
      if (cached && cached.expiresAt > Date.now()) {
        logDeduplicator.info('Using cached JWKS', { kid: header.kid });
        return cached.key;
      }

      logDeduplicator.info('Fetching JWKS', { kid: header.kid });

      const response = await fetch(JWKS_URL);
      if (!response.ok) {
        logDeduplicator.error('Error fetching JWKS', {
          status: response.status,
          statusText: response.statusText,
          kid: header.kid
        });
        throw new JWKSError("Error fetching JWKS");
      }

      const jwks = await response.json();
      const signingKey = jwks.keys.find((key: { kid: string }) => key.kid === header.kid);

      if (!signingKey) {
        logDeduplicator.error('Signing key not found', {
          kid: header.kid,
          availableKids: jwks.keys.map((k: { kid: string }) => k.kid)
        });
        throw new SigningKeyError("Signing key not found");
      }

      logDeduplicator.info('Signing key found', { kid: header.kid });
      const jose = await this.loadJose();
      const key = (await jose.importJWK(signingKey, "ES256")) as CryptoKey;
      
      // Mettre en cache pour 1 heure
      this.jwksCache.set(header.kid, {
        key,
        expiresAt: Date.now() + 60 * 60 * 1000 // 1 heure
      });
      
      return key;
    } catch (error) {
      if (error instanceof JWKSError || error instanceof SigningKeyError) {
        throw error;
      }
      logDeduplicator.error('Unexpected error during JWKS retrieval', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        kid: header.kid
      });
      throw new JWKSError("Unexpected error during JWKS retrieval");
    }
  }

  public async verifyToken(token: string): Promise<PrivyPayload> {
    try {
      logDeduplicator.info('Verifying token');

      const decodedHeader = JSON.parse(Buffer.from(token.split(".")[0], "base64").toString());
      const signingKey = await this.getSigningKey(decodedHeader);

      const jose = await this.loadJose();
      const { payload } = await jose.jwtVerify(token, signingKey, {
        issuer: "privy.io",
        audience: [process.env.NEXT_PUBLIC_PRIVY_AUDIENCE!, "https://auth.privy.io"],
      });

      logDeduplicator.info('Token verified successfully', {
        sub: payload.sub,
        iss: payload.iss
      });

      return payload as PrivyPayload;
    } catch (error) {
      logDeduplicator.error('Token validation error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new TokenValidationError("Invalid or expired token");
    }
  }

  public async findOrCreateUser(payload: PrivyPayload, name: string, referrerName?: string) {
    const privyUserId = payload.sub;

    if (!privyUserId) {
      logDeduplicator.error('Missing Privy User ID in token', {
        payload,
        name
      });
      throw new TokenValidationError("Missing Privy User ID in token");
    }

    try {
      logDeduplicator.info('Finding or creating user', {
        privyUserId,
        name,
        referrerName
      });

      const user = await userRepository.findOrCreate(privyUserId, {
        name: name,
      });

      // Associer le parrain si fourni
      if (referrerName && referrerName !== name) {
        try {
          await this.referralService.assignReferrer(user.id, referrerName);
          logDeduplicator.info('Referrer assigned successfully', { 
            userId: user.id, 
            referrerName 
          });
        } catch (error) {
          // Log l'erreur mais ne pas faire échouer la création de l'utilisateur
          logDeduplicator.warn('Failed to assign referrer', {
            userId: user.id,
            referrerName,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Vérifier si l'utilisateur vient d'être créé (dans les 5 dernières secondes)
      const isNewUser = (Date.now() - user.createdAt.getTime()) < 5000;
      
      logDeduplicator.info('User found or created', {
        userId: user.id,
        privyUserId,
        name,
        referrerName,
        isNewUser
      });

      return user;
    } catch (error) {
      logDeduplicator.error('Error finding or creating user', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        privyUserId,
        name,
        referrerName
      });
      throw new UserNotFoundError("Error finding or creating user");
    }
  }
}
