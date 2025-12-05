import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { HttpModule } from '@nestjs/axios';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [HttpModule, CloudinaryModule, SearchModule],
  providers: [EventService],
  controllers: [EventController],
})
export class EventModule {}
