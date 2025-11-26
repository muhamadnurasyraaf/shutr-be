import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  type GetCreatorProfileDto,
  GetCreatorProfileSchema,
} from './creator.dto';
import { CreatorService } from './creator.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('creator')
export class CreatorController {
  constructor(private creatorService: CreatorService) {}

  @Get('profile')
  @UsePipes(new ZodValidationPipe(GetCreatorProfileSchema))
  async getCreatorProfile(@Query() query: GetCreatorProfileDto) {
    return this.creatorService.getCreatorProfile(query.userId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadContent(@UploadedFile() file: Express.Multer.File) {
    console.log('Received file:', file);

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.creatorService.uploadContent(file);
  }

  @Get('/contents')
  async getContents(@Query('userId') userId: string) {
    return this.creatorService.getCreatorContents(userId);
  }
}
