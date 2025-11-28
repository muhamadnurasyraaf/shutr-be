import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { EventService } from './event.service';

@Controller('event')
export class EventController {
  constructor(private eventService: EventService) {}

  @Get()
  async getEvents(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
    @Query('sortBy') sortBy: 'event' | 'date' | 'name' = 'date',
    @Query('sortDirection') sortDirection: 'asc' | 'desc' = 'desc',
  ) {
    return this.eventService.getEvents({
      page,
      limit,
      sortBy,
      sortDirection,
    });
  }
}
