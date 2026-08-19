import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import type { AuthenticatedUser } from '../auth.types';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  // Whatever this returns becomes `req.user` for the route guarded by LocalAuthGuard.
  async validate(email: string, password: string): Promise<AuthenticatedUser> {
    return this.authService.validateUser(email, password);
  }
}
