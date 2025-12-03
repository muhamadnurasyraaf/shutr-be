import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  ParseIntPipe,
  DefaultValuePipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Get('list')
  async getAllEventsSimple(@Query('search') search?: string) {
    return this.eventService.getAllEventsSimple({ search });
  }

  @Post()
  async createEvent(
    @Body()
    body: {
      name: string;
      date: string;
      location: string;
      description?: string;
      createdBy: string;
    },
  ) {
    return this.eventService.createEvent({
      name: body.name,
      date: new Date(body.date),
      location: body.location,
      description: body.description,
      createdBy: body.createdBy,
    });
  }

  @Get(':id/images')
  async getEventImages(
    @Param('id') eventId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.eventService.getEventImages({
      eventId,
      page,
      limit,
    });
  }

  @Post(':id/search-similar')
  @UseInterceptors(FileInterceptor('image'))
  async findSimilarImages(
    @Param('id') eventId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    // Convert file buffer to base64 data URI
    const base64 = file.buffer.toString('base64');
    const mimeType = file.mimetype;
    const imageBase64 = `data:${mimeType};base64,${base64}`;

    return this.eventService.findSimilarImages({
      eventId,
      imageBase64,
      limit,
    });
  }
}
