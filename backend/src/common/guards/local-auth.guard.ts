import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Runs the LocalStrategy (email+password) on POST /auth/login only. */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
