// import { importJWK, jwtVerify } from "jose"; // Supprimé pour import dynamique
import { prisma } from "../../core/prisma.service";
import { PrivyPayload } from "../../types/auth.types";
import { JWKSError, SigningKeyError, TokenValidationError, UserNotFoundError } from "../../errors/auth.errors";
import { logDeduplicator } from "../../utils/logDeduplicator";

const JWKS_URL = process.env.JWKS_URL!;

export class AuthService {
  private static instance: AuthService;

  private constructor() { }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private async getSigningKey(header: { kid: string }): Promise<CryptoKey> {
    try {
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
      const { importJWK } = await import('jose'); // Import dynamique de importJWK
      return (await importJWK(signingKey, "ES256")) as CryptoKey;
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

      const { jwtVerify } = await import('jose'); // Import dynamique de jwtVerify
      const { payload } = await jwtVerify(token, signingKey, {
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

  public async findOrCreateUser(payload: PrivyPayload, username: string) {
    const privyUserId = payload.sub;

    if (!privyUserId) {
      logDeduplicator.error('Missing Privy User ID in token', {
        payload,
        username
      });
      throw new TokenValidationError("Missing Privy User ID in token");
    }

    try {
      logDeduplicator.info('Finding or creating user', {
        privyUserId,
        username
      });

      const user = await prisma.user.upsert({
        where: { privyUserId },
        update: {
          name: username,
        },
        create: {
          privyUserId,
          name: username,
        },
      });

      logDeduplicator.info('User found or created', {
        userId: user.id,
        privyUserId,
        username,
        isNewUser: user.createdAt === user.createdAt
      });

      return user;
    } catch (error) {
      logDeduplicator.error('Error finding or creating user', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        privyUserId,
        username
      });
      throw new UserNotFoundError("Error finding or creating user");
    }
  }
}
