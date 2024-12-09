import { importJWK, jwtVerify } from "jose";
import prisma from "../lib/prisma";
import { PrivyPayload } from "../types/auth.types";

const JWKS_URL = process.env.JWKS_URL!;

export class AuthService {
  private async getSigningKey(header: any): Promise<CryptoKey> {
    const response = await fetch(JWKS_URL);
    if (!response.ok) throw new Error("Erreur lors de la récupération des JWKS.");

    const jwks = await response.json();
    const signingKey = jwks.keys.find((key: any) => key.kid === header.kid);

    if (!signingKey) throw new Error("Clé de signature introuvable.");

    return (await importJWK(signingKey, "ES256")) as CryptoKey;
  }

  public async verifyToken(token: string): Promise<PrivyPayload> {
    const decodedHeader = JSON.parse(Buffer.from(token.split(".")[0], "base64").toString());
    const signingKey = await this.getSigningKey(decodedHeader);

    const { payload } = await jwtVerify(token, signingKey, {
      issuer: "privy.io",
      audience: process.env.NEXT_PUBLIC_PRIVY_AUDIENCE!,
    });

    return payload as PrivyPayload;
  }

  public async findOrCreateUser(payload: PrivyPayload, username: string) {
    const privyUserId = payload.sub;

    if (!privyUserId) {
      throw new Error("PrivyUserId manquant.");
    }

    let user = await prisma.user.findUnique({
      where: { privyUserId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          privyUserId,
          name: username,
        },
      });
    }

    return user;
  }
}
