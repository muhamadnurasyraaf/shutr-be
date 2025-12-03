import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  type GetCreatorProfileDto,
  GetCreatorProfileSchema,
  type UpdatePersonalInfoDto,
  UpdatePersonalInfoSchema,
  type UpdateProfessionalInfoDto,
  UpdateProfessionalInfoSchema,
  type UpdateBankingInfoDto,
  UpdateBankingInfoSchema,
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
  async uploadContent(
    @UploadedFile() file: Express.Multer.File,
    @Body('creatorId') creatorId: string,
    @Body('eventId') eventId?: string,
    @Body('description') description?: string,
  ) {
    console.log('Received file:', file);

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!creatorId) {
      throw new BadRequestException('Creator ID is required');
    }

    return this.creatorService.uploadContent(
      file,
      creatorId,
      eventId,
      description,
    );
  }

  @Get('/contents')
  async getContents(
    @Query('userId') userId: string,
    @Query('eventId') eventId?: string,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.creatorService.getCreatorContents(userId, eventId);
  }

  @Put('personal')
  @UsePipes(new ZodValidationPipe(UpdatePersonalInfoSchema))
  async updatePersonalInfo(@Body() payload: UpdatePersonalInfoDto) {
    return this.creatorService.updatePersonalInfo(payload);
  }

  @Put('professional')
  @UsePipes(new ZodValidationPipe(UpdateProfessionalInfoSchema))
  async updateProfessionalInfo(@Body() payload: UpdateProfessionalInfoDto) {
    return this.creatorService.updateProfessionalInfo(payload);
  }

  @Put('banking')
  @UsePipes(new ZodValidationPipe(UpdateBankingInfoSchema))
  async updateBankingInfo(@Body() payload: UpdateBankingInfoDto) {
    return this.creatorService.updateBankingInfo(payload);
  }
}
