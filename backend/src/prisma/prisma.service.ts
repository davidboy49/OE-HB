import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: configService.get<string>('DATABASE_URL'),
        // pg.Pool's own default idleTimeoutMillis is already 10s - low enough that
        // ordinary page-to-page navigation (often >10s apart) was tearing the pooled
        // connection down and paying a fresh ~250ms TCP+TLS+auth handshake (this DB
        // is remote) on nearly every request. Widened to keep connections warm across
        // a realistic browsing gap; keepAlive still guards against the network path
        // (not just Postgres) silently dropping an idle TCP socket.
        keepAlive: true,
        idleTimeoutMillis: 120_000,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
