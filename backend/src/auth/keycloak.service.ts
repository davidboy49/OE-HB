import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface KeycloakClaims {
  /** Keycloak's permanent id for the person. Unlike the email, it never changes or gets reused. */
  sub: string;
  email: string;
  /** Whether Keycloak has confirmed the person owns this email address. */
  emailVerified: boolean;
  name: string | null;
  preferredUsername: string | null;
  /** Group names from the token's "groups" claim (needs a Group Membership mapper); [] if absent. */
  groups: string[];
}

/**
 * Verifies access tokens issued by the company's Keycloak realm so they can be exchanged for
 * our own JWT (used by the mobile app and the web "Sign in with SSO" button).
 *
 * Configuration:
 *   KEYCLOAK_ISSUER     realm base, e.g. https://sso.example.com/realms/company   (required)
 *   KEYCLOAK_CLIENT_ID  when set, the token must have been issued to (azp) or for (aud) this
 *                       client, so a token minted for some other app in the realm is refused
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

    const sub = payload.sub;
    if (!sub) {
      throw new UnauthorizedException('Keycloak token has no subject');
    }

    this.assertIssuedForThisApp(payload);

    const email = payload.email as string | undefined;
    if (!email) {
      throw new UnauthorizedException(
        'Keycloak token has no email claim - check the client scopes include "email"',
      );
    }

    const rawGroups = payload.groups;
    const groups = Array.isArray(rawGroups)
      ? rawGroups.filter((g): g is string => typeof g === 'string')
      : [];

    return {
      sub,
      email,
      emailVerified: payload.email_verified === true,
      name: (payload.name as string | undefined) ?? null,
      preferredUsername:
        (payload.preferred_username as string | undefined) ?? null,
      groups,
    };
  }

  private assertIssuedForThisApp(payload: {
    azp?: unknown;
    aud?: unknown;
  }): void {
    const clientId = this.config.get<string>('KEYCLOAK_CLIENT_ID');
    if (!clientId) return;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.azp !== clientId && !aud.includes(clientId)) {
      throw new UnauthorizedException(
        'This Keycloak token was not issued for the OE Portal',
      );
    }
  }
}
