import { importJWK, jwtVerify } from "jose";
import prisma from "../../lib/prisma";
import { PrivyPayload } from "../../types/auth.types";
import { JWKSError, SigningKeyError, TokenValidationError, UserNotFoundError } from "../../errors/auth.errors";
import { logger } from "../../utils/logger";
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
      logger.info(message, metadata);
      this.lastLogTimestamp[key] = now;
    }
  }

  private async getSigningKey(header: any): Promise<CryptoKey> {
    try {
      const response = await fetch(JWKS_URL);
      if (!response.ok) {
        logger.error('Error fetching JWKS', { status: response.status, statusText: response.statusText });
        throw new JWKSError("Error fetching JWKS");
      }

      const jwks = await response.json();
      const signingKey = jwks.keys.find((key: any) => key.kid === header.kid);

      if (!signingKey) {
        logger.error('Signing key not found', { kid: header.kid });
        throw new SigningKeyError("Signing key not found");
      }

      return (await importJWK(signingKey, "ES256")) as CryptoKey;
    } catch (error) {
      if (error instanceof JWKSError || error instanceof SigningKeyError) {
        throw error;
      }
      logger.error('Unexpected error during JWKS retrieval', { error });
      throw new JWKSError("Unexpected error during JWKS retrieval");
    }
  }

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
      logger.error('Token validation error', { error });
      throw new TokenValidationError("Invalid or expired token");
    }
  }

  public async findOrCreateUser(payload: PrivyPayload, username: string) {
    const privyUserId = payload.sub;

    if (!privyUserId) {
      logger.error('Missing Privy User ID in token');
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
      logger.error('Error finding or creating user', { error, privyUserId, username });
      throw new UserNotFoundError("Error finding or creating user");
    }
  }
}
