import { Module } from '@nestjs/common';
import { CreatorService } from './creator.service';
import { CreatorController } from './creator.controller';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { HttpModule } from '@nestjs/axios';
import { SearchModule } from 'src/search/search.module';

@Module({
  imports: [CloudinaryModule, HttpModule, SearchModule],
  providers: [CreatorService],
  controllers: [CreatorController],
})
export class CreatorModule {}
