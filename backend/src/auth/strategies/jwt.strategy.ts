import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ?? 'change-me-in-production',
    });
  }

  /**
   * Whatever this returns becomes `req.user`. The token only proves who signed in; whether they
   * may still use the system is decided here on EVERY request from the database, so
   * deactivating or deleting an account locks the person out at once instead of at token expiry
   * (up to 12h later). The profile fields are also taken fresh, so a renamed or moved user is
   * never recorded under their old name or department.
   */
  async validate(payload: AuthenticatedUser): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        departmentId: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('This account is no longer active');
    }
    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      departmentId: user.departmentId,
    };
  }
}
