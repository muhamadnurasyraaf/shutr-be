import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
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
  type GetPhotographersDto,
  GetPhotographersSchema,
  type GetPhotographerProfileDto,
} from './creator.dto';
import { CreatorService } from './creator.service';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';

@Controller('creator')
export class CreatorController {
  constructor(private creatorService: CreatorService) {}

  @Get('profile')
  @UsePipes(new ZodValidationPipe(GetCreatorProfileSchema))
  async getCreatorProfile(@Query() query: GetCreatorProfileDto) {
    return this.creatorService.getCreatorProfile(query.userId);
  }

  @Get('photographers')
  async getPhotographers(@Query() query: GetPhotographersDto) {
    return this.creatorService.getPhotographers(query);
  }

  @Get('photographer/:id')
  async getPhotographerPublicProfile(
    @Param('id') id: string,
    @Query('eventId') eventId?: string,
  ) {
    if (!id) {
      throw new BadRequestException('Photographer ID is required');
    }
    const result = await this.creatorService.getPhotographerPublicProfile(
      id,
      eventId,
    );
    if (!result) {
      throw new BadRequestException('Photographer not found');
    }
    return result;
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

  @Post('upload-with-variants')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'variant0', maxCount: 1 },
      { name: 'variant1', maxCount: 1 },
      { name: 'variant2', maxCount: 1 },
    ]),
  )
  async uploadContentWithVariants(
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      variant0?: Express.Multer.File[];
      variant1?: Express.Multer.File[];
      variant2?: Express.Multer.File[];
    },
    @Body('creatorId') creatorId: string,
    @Body('eventId') eventId?: string,
    @Body('description') description?: string,
    @Body('variants') variantsJson?: string,
  ) {
    console.log('Received files:', files);
    console.log('Variants JSON:', variantsJson);

    if (!files.file || files.file.length === 0) {
      throw new BadRequestException('No main file uploaded');
    }

    if (!creatorId) {
      throw new BadRequestException('Creator ID is required');
    }

    // Parse variants metadata
    let variantsData: Array<{
      name: string;
      description?: string;
      price: number;
    }> = [];

    if (variantsJson) {
      try {
        variantsData = JSON.parse(variantsJson);
      } catch {
        throw new BadRequestException('Invalid variants JSON');
      }
    }

    // Map variant files to variant data
    const variants: Array<{
      name: string;
      description?: string;
      price: number;
      file: Express.Multer.File;
    }> = [];

    const variantFiles = [files.variant0, files.variant1, files.variant2];

    for (let i = 0; i < variantsData.length && i < 3; i++) {
      const variantFile = variantFiles[i];
      if (variantFile && variantFile.length > 0) {
        variants.push({
          ...variantsData[i],
          file: variantFile[0],
        });
      }
    }

    return this.creatorService.uploadContentWithVariants(
      files.file[0],
      creatorId,
      eventId,
      description,
      variants,
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

  @Get('/image/:imageId')
  async getImageWithVariants(
    @Param('imageId') imageId: string,
    @Query('creatorId') creatorId: string,
  ) {
    if (!imageId) {
      throw new BadRequestException('Image ID is required');
    }
    if (!creatorId) {
      throw new BadRequestException('Creator ID is required');
    }
    const image = await this.creatorService.getImageWithVariants(
      imageId,
      creatorId,
    );
    if (!image) {
      throw new BadRequestException('Image not found');
    }
    return image;
  }

  @Put('/variant/:variantId')
  async updateVariant(
    @Param('variantId') variantId: string,
    @Body('creatorId') creatorId: string,
    @Body('name') name?: string,
    @Body('description') description?: string,
    @Body('price') price?: number,
  ) {
    if (!variantId) {
      throw new BadRequestException('Variant ID is required');
    }
    if (!creatorId) {
      throw new BadRequestException('Creator ID is required');
    }
    try {
      return await this.creatorService.updateImageVariant(
        variantId,
        creatorId,
        {
          name,
          description,
          price,
        },
      );
    } catch {
      throw new BadRequestException('Variant not found or unauthorized');
    }
  }

  @Post('/variant/:variantId/delete')
  async deleteVariant(
    @Param('variantId') variantId: string,
    @Body('creatorId') creatorId: string,
  ) {
    if (!variantId) {
      throw new BadRequestException('Variant ID is required');
    }
    if (!creatorId) {
      throw new BadRequestException('Creator ID is required');
    }
    try {
      await this.creatorService.deleteVariant(variantId, creatorId);
      return { success: true };
    } catch {
      throw new BadRequestException('Variant not found or unauthorized');
    }
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
