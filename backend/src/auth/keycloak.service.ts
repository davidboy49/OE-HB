import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface KeycloakClaims {
  email: string;
  name: string | null;
  preferredUsername: string | null;
}

/**
 * Verifies access tokens issued by the company's Keycloak realm (used by the
 * mobile app's existing SSO login) so they can be exchanged for our own JWT.
 * KEYCLOAK_ISSUER is the realm base, e.g. https://sso.example.com/realms/company.
 */
@Injectable()
export class KeycloakService {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {}

  /** Lazy so a backend without Keycloak configured still boots fine. */
  private getJwks() {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(
        new URL(`${this.getIssuer()}/protocol/openid-connect/certs`),
      );
    }
    return this.jwks;
  }

  private getIssuer(): string {
    const issuer = this.config.get<string>('KEYCLOAK_ISSUER');
    if (!issuer) {
      throw new Error('KEYCLOAK_ISSUER is not configured');
    }
    return issuer;
  }

  async verify(token: string): Promise<KeycloakClaims> {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, this.getJwks(), {
        issuer: this.getIssuer(),
      }));
    } catch {
      throw new UnauthorizedException('Invalid or expired Keycloak token');
    }

    const email = payload.email as string | undefined;
    if (!email) {
      throw new UnauthorizedException(
        'Keycloak token has no email claim - check the client scopes include "email"',
      );
    }

    return {
      email,
      name: (payload.name as string | undefined) ?? null,
      preferredUsername:
        (payload.preferred_username as string | undefined) ?? null,
    };
  }
}
