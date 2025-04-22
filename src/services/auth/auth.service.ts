import { importJWK, jwtVerify } from "jose";
import { prisma } from "../../core/prisma.service";
import { PrivyPayload } from "../../types/auth.types";
import { JWKSError, SigningKeyError, TokenValidationError, UserNotFoundError } from "../../errors/auth.errors";
import { logDeduplicator } from "../../utils/logDeduplicator";

const JWKS_URL = process.env.JWKS_URL!;

export class AuthService {
  private static instance: AuthService;
  
  // Système de déduplication des logs
  private lastLogTimestamp: Record<string, number> = {};
  private readonly LOG_THROTTLE_MS = 1000;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Log un message une seule fois dans un intervalle de temps défini
   */
  private logOnce(message: string, metadata: Record<string, any> = {}): void {
    const now = Date.now();
    const key = `${message}:${JSON.stringify(metadata)}`;
    
    if (!this.lastLogTimestamp[key] || now - this.lastLogTimestamp[key] > this.LOG_THROTTLE_MS) {
      logDeduplicator.info(message, metadata);
      this.lastLogTimestamp[key] = now;
    }
  }

  /**
   * Récupère la clé de signature pour la vérification du token
   */
  private async getSigningKey(header: { kid: string }): Promise<CryptoKey> {
    try {
      const response = await fetch(JWKS_URL);
      if (!response.ok) {
        logDeduplicator.error('Error fetching JWKS', { status: response.status, statusText: response.statusText });
        throw new JWKSError("Error fetching JWKS");
      }

      const jwks = await response.json();
      const signingKey = jwks.keys.find((key: { kid: string }) => key.kid === header.kid);

      if (!signingKey) {
        logDeduplicator.error('Signing key not found', { kid: header.kid });
        throw new SigningKeyError("Signing key not found");
      }

      return (await importJWK(signingKey, "ES256")) as CryptoKey;
    } catch (error) {
      if (error instanceof JWKSError || error instanceof SigningKeyError) {
        throw error;
      }
      logDeduplicator.error('Unexpected error during JWKS retrieval', { error });
      throw new JWKSError("Unexpected error during JWKS retrieval");
    }
  }

  /**
   * Vérifie la validité d'un token JWT
   */
  public async verifyToken(token: string): Promise<PrivyPayload> {
    try {
      const decodedHeader = JSON.parse(Buffer.from(token.split(".")[0], "base64").toString());
      const signingKey = await this.getSigningKey(decodedHeader);

      const { payload } = await jwtVerify(token, signingKey, {
        issuer: "privy.io",
        audience: process.env.NEXT_PUBLIC_PRIVY_AUDIENCE!,
      });

      return payload as PrivyPayload;
    } catch (error) {
      logDeduplicator.error('Token validation error', { error });
      throw new TokenValidationError("Invalid or expired token");
    }
  }

  /**
   * Trouve un utilisateur existant ou en crée un nouveau
   */
  public async findOrCreateUser(payload: PrivyPayload, username: string) {
    const privyUserId = payload.sub;

    if (!privyUserId) {
      logDeduplicator.error('Missing Privy User ID in token');
      throw new TokenValidationError("Missing Privy User ID in token");
    }

    try {
      let user = await prisma.user.findUnique({
        where: { privyUserId },
      });

      if (!user) {
        logDeduplicator.info('Creating new user', { privyUserId, username });
        user = await prisma.user.create({
          data: {
            privyUserId,
            name: username,
          },
        });
      } else {
        logDeduplicator.info('User found', { privyUserId, username });
      }

      return user;
    } catch (error) {
      logDeduplicator.error('Error finding or creating user', { error, privyUserId, username });
      throw new UserNotFoundError("Error finding or creating user");
    }
  }
}
