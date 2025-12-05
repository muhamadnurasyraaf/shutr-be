import { Injectable } from '@nestjs/common';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchService } from 'src/search/search.service';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  UpdatePersonalInfoDto,
  UpdateProfessionalInfoDto,
  UpdateBankingInfoDto,
  GetPhotographersDto,
} from './creator.dto';
import { photographyType } from '@prisma/client';

interface JinaEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

interface ExtractedNumbers {
  bibNumber: string | null;
  plateNumber: string | null;
}

interface VariantInput {
  name: string;
  description?: string;
  price: number;
  file: Express.Multer.File;
}

@Injectable()
export class CreatorService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private http: HttpService,
    private searchService: SearchService,
  ) {}

  async getCreatorProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        creatorInfo: true,
        bankingInfo: true,
      },
    });
  }

  async getImageWithVariants(imageId: string, creatorId: string) {
    const image = await this.prisma.image.findFirst({
      where: {
        id: imageId,
        creatorId: creatorId,
      },
      select: {
        id: true,
        publicId: true,
        description: true,
        bibNumber: true,
        plateNumber: true,
        creatorId: true,
        eventId: true,
        createdAt: true,
        updatedAt: true,
        event: {
          select: {
            id: true,
            name: true,
            date: true,
            location: true,
          },
        },
        variants: {
          select: {
            id: true,
            publicId: true,
            name: true,
            description: true,
            price: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!image) return null;

    // Transform to include signed URLs for API response
    return {
      ...image,
      url: this.cloudinary.getSignedUrl(image.publicId),
      variants: image.variants.map((variant) => ({
        ...variant,
        url: this.cloudinary.getSignedUrl(variant.publicId),
      })),
    };
  }

  async updateImageVariant(
    variantId: string,
    creatorId: string,
    data: { name?: string; description?: string; price?: number },
  ) {
    // Verify the variant belongs to an image owned by the creator
    const variant = await this.prisma.variant.findFirst({
      where: {
        id: variantId,
        image: {
          creatorId: creatorId,
        },
      },
    });

    if (!variant) {
      throw new Error('Variant not found or unauthorized');
    }

    return this.prisma.variant.update({
      where: { id: variantId },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
      },
    });
  }

  async deleteVariant(variantId: string, creatorId: string) {
    // Verify the variant belongs to an image owned by the creator
    const variant = await this.prisma.variant.findFirst({
      where: {
        id: variantId,
        image: {
          creatorId: creatorId,
        },
      },
    });

    if (!variant) {
      throw new Error('Variant not found or unauthorized');
    }

    return this.prisma.variant.delete({
      where: { id: variantId },
    });
  }

  async getPhotographers(query: GetPhotographersDto) {
    const { photographyType: type, page = 1, limit = 9 } = query;

    const whereClause: any = {
      type: 'Creator',
      creatorInfo: {
        isNot: null,
      },
    };

    if (type) {
      whereClause.creatorInfo = {
        photographyType: type as photographyType,
      };
    }

    const skip = (page - 1) * limit;

    const [photographers, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        include: {
          creatorInfo: true,
          _count: {
            select: {
              images: true,
              events: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: Number(limit),
      }),
      this.prisma.user.count({ where: whereClause }),
    ]);

    const data = photographers.map((photographer) => ({
      id: photographer.id,
      name: photographer.name,
      displayName: photographer.displayName,
      avatar: photographer.image,
      email: photographer.email,
      photographyType: photographer.creatorInfo?.photographyType,
      location: photographer.creatorInfo?.location,
      bio: photographer.creatorInfo?.bio,
      eventsCount: photographer._count.events,
      imagesCount: photographer._count.images,
    }));

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + photographers.length < total,
    };
  }

  async updatePersonalInfo(payload: UpdatePersonalInfoDto) {
    const { userId, name, displayName, phoneNumber } = payload;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name,
        displayName,
        phoneNumber,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        phoneNumber: true,
        email: true,
      },
    });
  }

  async updateProfessionalInfo(payload: UpdateProfessionalInfoDto) {
    const { userId, photographyType, location } = payload;

    return this.prisma.creatorInfo.upsert({
      where: { userId },
      update: {
        photographyType,
        location,
      },
      create: {
        userId,
        photographyType,
        location,
      },
    });
  }

  async updateBankingInfo(payload: UpdateBankingInfoDto) {
    const { userId, bankName, accountNumber, holderName } = payload;

    return this.prisma.bankingInfo.upsert({
      where: { userId },
      update: {
        bankName,
        accountNumber,
        holderName,
      },
      create: {
        userId,
        bankName,
        accountNumber,
        holderName,
      },
    });
  }

  async getCreatorContents(userId: string, eventId?: string) {
    const where: any = { creatorId: userId };

    if (eventId) {
      where.eventId = eventId;
    }

    const images = await this.prisma.image.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        publicId: true,
        description: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            name: true,
            date: true,
            location: true,
          },
        },
      },
    });

    // Group images by event
    const grouped: Record<
      string,
      {
        event: {
          id: string;
          name: string;
          date: Date;
          location: string;
        } | null;
        images: Array<{
          id: string;
          url: string;
          description: string | null;
          createdAt: Date;
        }>;
      }
    > = {};

    for (const image of images) {
      const eventKey = image.event?.id || 'uncategorized';
      if (!grouped[eventKey]) {
        grouped[eventKey] = {
          event: image.event,
          images: [],
        };
      }
      grouped[eventKey].images.push({
        id: image.id,
        url: this.cloudinary.getSignedUrl(image.publicId),
        description: image.description,
        createdAt: image.createdAt,
      });
    }

    // Convert to array and sort by event date (most recent first)
    const result = Object.values(grouped).sort((a, b) => {
      if (!a.event) return 1;
      if (!b.event) return -1;
      return (
        new Date(b.event.date).getTime() - new Date(a.event.date).getTime()
      );
    });

    return {
      totalImages: images.length,
      eventGroups: result,
    };
  }

  async getPhotographerPublicProfile(photographerId: string, eventId?: string) {
    const photographer = await this.prisma.user.findUnique({
      where: { id: photographerId, type: 'Creator' },
      include: {
        creatorInfo: true,
        _count: {
          select: {
            images: true,
            events: true,
          },
        },
      },
    });

    if (!photographer) {
      return null;
    }

    // Get events by this photographer
    const events = await this.prisma.event.findMany({
      where: { createdBy: photographerId },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        thumbnailUrl: true,
        _count: {
          select: {
            images: true,
          },
        },
      },
    });

    // Get images with optional event filter
    const imageWhere: any = { creatorId: photographerId };
    if (eventId) {
      imageWhere.eventId = eventId;
    }

    const images = await this.prisma.image.findMany({
      where: imageWhere,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        publicId: true,
        description: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            name: true,
            date: true,
            location: true,
          },
        },
      },
    });

    // Group images by event
    const grouped: Record<
      string,
      {
        event: {
          id: string;
          name: string;
          date: Date;
          location: string;
        } | null;
        images: Array<{
          id: string;
          url: string;
          description: string | null;
          createdAt: Date;
        }>;
      }
    > = {};

    for (const image of images) {
      const eventKey = image.event?.id || 'uncategorized';
      if (!grouped[eventKey]) {
        grouped[eventKey] = {
          event: image.event,
          images: [],
        };
      }
      grouped[eventKey].images.push({
        id: image.id,
        url: this.cloudinary.getSignedUrl(image.publicId),
        description: image.description,
        createdAt: image.createdAt,
      });
    }

    // Convert to array and sort by event date
    const eventGroups = Object.values(grouped).sort((a, b) => {
      if (!a.event) return 1;
      if (!b.event) return -1;
      return (
        new Date(b.event.date).getTime() - new Date(a.event.date).getTime()
      );
    });

    return {
      photographer: {
        id: photographer.id,
        name: photographer.name,
        displayName: photographer.displayName,
        avatar: photographer.image,
        email: photographer.email,
        photographyType: photographer.creatorInfo?.photographyType,
        location: photographer.creatorInfo?.location,
        bio: photographer.creatorInfo?.bio,
        eventsCount: photographer._count.events,
        imagesCount: photographer._count.images,
        memberSince: photographer.createdAt,
      },
      events: events.map((e) => ({
        id: e.id,
        name: e.name,
        date: e.date,
        location: e.location,
        thumbnailUrl: e.thumbnailUrl,
        photoCount: e._count.images,
      })),
      totalImages: images.length,
      eventGroups,
    };
  }

  /**
   * Extract bib number and plate number from image using Gemini Vision API
   */
  private async extractNumbersFromImage(
    imageUrl: string,
  ): Promise<ExtractedNumbers> {
    try {
      console.log('Extracting numbers from image using Gemini...');

      const prompt = `Analyze this image and extract the following information if visible:
1. BIB NUMBER: Look for race bib numbers typically worn by runners/participants in marathons or running events. These are usually large numbers on the chest or back.
2. PLATE NUMBER: Look for the most front vehicle license plate numbers or racing car numbers.

Respond ONLY in this exact JSON format, nothing else:
{"bibNumber": "extracted_number_or_null", "plateNumber": "extracted_number_or_null"}

If a number type is not found or not applicable, use null.
Only extract clear, readable numbers. Do not guess.`;

      const response = await firstValueFrom(
        this.http.post<GeminiResponse>(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: await this.getBase64FromUrl(imageUrl),
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1000,
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      console.log(`RESPONSE : ${JSON.stringify(response.data, null, 2)}`);

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        // Clean the response and parse JSON
        const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanedText);
        console.log('Extracted numbers:', parsed);
        return {
          bibNumber: parsed.bibNumber || null,
          plateNumber: parsed.plateNumber || null,
        };
      }

      return { bibNumber: null, plateNumber: null };
    } catch (error) {
      console.error('Error extracting numbers from image:', error);
      return { bibNumber: null, plateNumber: null };
    }
  }

  /**
   * Convert image URL to base64
   */
  private async getBase64FromUrl(url: string): Promise<string> {
    const response = await firstValueFrom(
      this.http.get(url, { responseType: 'arraybuffer' }),
    );
    return Buffer.from(response.data).toString('base64');
  }

  async uploadContent(
    file: Express.Multer.File,
    creatorId: string,
    eventId?: string,
    description?: string,
  ) {
    try {
      // Verify creator exists before uploading
      const creator = await this.prisma.user.findUnique({
        where: { id: creatorId },
        include: { creatorInfo: true },
      });

      if (!creator) {
        throw new Error(`Creator with ID '${creatorId}' not found`);
      }

      console.log('Uploading to Cloudinary...');
      const uploadResult = await this.cloudinary.uploadImage(file);
      const publicId = uploadResult.public_id;
      const tempUrl = uploadResult.secure_url;

      // Extract bib/plate numbers using Gemini (use temp URL for analysis)
      const extractedNumbers = await this.extractNumbersFromImage(tempUrl);

      console.log('Generating embedding...');

      const response = await firstValueFrom(
        this.http.post<JinaEmbeddingResponse>(
          'https://api.jina.ai/v1/embeddings',
          {
            model: 'jina-clip-v2',
            input: [
              {
                image: tempUrl,
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.JINA_API_KEY}`,
            },
          },
        ),
      );

      const embedding = response.data.data[0].embedding;
      const vectorStr = `[${embedding.join(',')}]`;

      console.log(`Generated ${embedding.length}-dimensional embedding`);

      const created = await this.prisma.$queryRawUnsafe<any>(
        `
      INSERT INTO images (
        id,
        "publicId",
        provider,
        description,
        embedding,
        "bibNumber",
        "plateNumber",
        "creatorId",
        "eventId",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        $1,
        'cloudinary',
        $2,
        $3::vector,
        $4,
        $5,
        $6,
        $7,
        NOW()
      )
      RETURNING id, "publicId", description, "bibNumber", "plateNumber", "creatorId", "eventId", "createdAt", "updatedAt";
    `,
        publicId,
        description || null,
        vectorStr,
        extractedNumbers.bibNumber,
        extractedNumbers.plateNumber,
        creatorId,
        eventId || null,
      );

      console.log('Upload complete!');

      // Get event name for indexing
      let eventName: string | undefined;
      if (eventId) {
        const event = await this.prisma.event.findUnique({
          where: { id: eventId },
          select: { name: true },
        });
        eventName = event?.name;
      }

      // Index in Typesense
      await this.searchService.indexImage({
        id: created[0].id,
        publicId: publicId,
        description: description || undefined,
        bibNumber: extractedNumbers.bibNumber || undefined,
        plateNumber: extractedNumbers.plateNumber || undefined,
        eventId: eventId || undefined,
        eventName: eventName,
        creatorId: creatorId,
        creatorName: creator.displayName || creator.name || undefined,
        createdAt: new Date(created[0].createdAt).getTime(),
      });

      // Update event image count in Typesense
      if (eventId) {
        const imageCount = await this.prisma.image.count({
          where: { eventId },
        });
        await this.searchService.updateEvent({
          id: eventId,
          imageCount,
        });
      }

      // Return with signed URL for API response consistency
      return {
        ...created[0],
        url: this.cloudinary.getSignedUrl(publicId),
      };
    } catch (error) {
      console.error('Error uploading content:', error);
      throw error;
    }
  }

  /**
   * Upload content with variants
   */
  async uploadContentWithVariants(
    mainFile: Express.Multer.File,
    creatorId: string,
    eventId?: string,
    description?: string,
    variants?: VariantInput[],
  ) {
    try {
      // First upload the main image
      const mainImage = await this.uploadContent(
        mainFile,
        creatorId,
        eventId,
        description,
      );

      // If no variants, return just the main image
      if (!variants || variants.length === 0) {
        return {
          ...mainImage,
          variants: [],
        };
      }

      // Upload variants
      const createdVariants: Array<{
        id: string;
        publicId: string;
        url: string;
        name: string;
        description: string | null;
        price: any;
        createdAt: Date;
        updatedAt: Date;
      }> = [];

      for (const variant of variants) {
        // Upload variant image to Cloudinary
        const variantPublicId = await this.cloudinary.uploadImageReturnPublicId(
          variant.file,
        );

        // Create variant record
        const createdVariant = await this.prisma.variant.create({
          data: {
            imageId: mainImage.id,
            publicId: variantPublicId,
            name: variant.name,
            description: variant.description || null,
            price: variant.price,
          },
        });

        createdVariants.push({
          ...createdVariant,
          url: this.cloudinary.getSignedUrl(variantPublicId),
        });
      }

      return {
        ...mainImage,
        variants: createdVariants,
      };
    } catch (error) {
      console.error('Error uploading content with variants:', error);
      throw error;
    }
  }
}
