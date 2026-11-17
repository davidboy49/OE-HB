import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Authenticated } from './common/decorators/authenticated.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Authenticated()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
