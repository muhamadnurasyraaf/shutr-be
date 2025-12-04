import { Injectable } from '@nestjs/common';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';

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

@Injectable()
export class CreatorService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private http: HttpService,
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
        url: true,
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
        url: image.url,
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
        url: true,
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
        url: image.url,
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

  async uploadContent(
    file: Express.Multer.File,
    creatorId: string,
    eventId?: string,
    description?: string,
  ) {
    try {
      console.log('Uploading to Cloudinary...');
      const cloudinaryUrl = await this.cloudinary.uploadImageReturnUrl(file);

      console.log('Generating embedding...');

      const response = await firstValueFrom(
        this.http.post<JinaEmbeddingResponse>(
          'https://api.jina.ai/v1/embeddings',
          {
            model: 'jina-clip-v2',
            input: [
              {
                image: cloudinaryUrl,
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
        url,
        description,
        embedding,
        "creatorId",
        "eventId",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3::vector,
        $4,
        $5,
        NOW()
      )
      RETURNING id, url, description, "creatorId", "eventId", "createdAt", "updatedAt";
    `,
        cloudinaryUrl,
        description || null,
        vectorStr,
        creatorId,
        eventId || null,
      );

      console.log('Upload complete!');
      return created[0];
    } catch (error) {
      console.error('Error uploading content:', error);
      throw error;
    }
  }
}
