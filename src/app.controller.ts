import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/landing')
  async landingContent() {
    return this.appService.retrieveEventsAndCreators();
  }

  @Get('/search')
  async search(@Query('q') query: string) {
    return this.appService.search(query);
  }
}
