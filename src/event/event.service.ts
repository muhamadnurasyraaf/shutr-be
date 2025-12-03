import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

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

interface FindSimilarImagesParams {
  eventId: string;
  imageBase64: string;
  limit?: number;
}

interface GetEventsParams {
  page: number;
  limit: number;
  eventId?: string;
  sortBy: 'event' | 'date' | 'name';
  sortDirection: 'asc' | 'desc';
}

interface GetEventImagesParams {
  eventId: string;
  page: number;
  limit: number;
}

interface GetAllEventsSimpleParams {
  search?: string;
}

interface CreateEventParams {
  name: string;
  date: Date;
  location: string;
  description?: string;
  createdBy: string;
}

@Injectable()
export class EventService {
  constructor(
    private prisma: PrismaService,
    private http: HttpService,
  ) {}

  async getEvents(params: GetEventsParams) {
    const { page, limit, sortBy, sortDirection } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};

    // Map sortBy to actual field names
    const orderByField = sortBy === 'event' ? 'name' : sortBy;
    const orderBy = { [orderByField]: sortDirection };

    // Get total count for pagination
    const total = await this.prisma.event.count({ where });

    // Get events with images
    const events = await this.prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        _count: {
          select: {
            images: true,
          },
        },
      },
    });

    return {
      data: events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getEventImages(params: GetEventImagesParams) {
    const { eventId, page, limit } = params;
    const skip = (page - 1) * limit;

    // First check if event exists and get event details
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            displayName: true,
            image: true,
          },
        },
        _count: {
          select: {
            images: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Get total count of images for this event
    const total = event._count.images;

    // Get images for this event
    const images = await this.prisma.image.findMany({
      where: { eventId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        description: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            name: true,
            displayName: true,
            image: true,
          },
        },
      },
    });

    return {
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        date: event.date,
        location: event.location,
        thumbnailUrl: event.thumbnailUrl,
        creator: event.creator,
        imageCount: total,
      },
      images,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getAllEventsSimple(params: GetAllEventsSimpleParams) {
    const { search } = params;

    const where: any = {};

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const events = await this.prisma.event.findMany({
      where,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        _count: {
          select: {
            images: true,
          },
        },
      },
    });

    return events.map((event) => ({
      id: event.id,
      name: event.name,
      date: event.date,
      location: event.location,
      imageCount: event._count.images,
    }));
  }

  async createEvent(params: CreateEventParams) {
    const { name, date, location, description, createdBy } = params;

    return this.prisma.event.create({
      data: {
        name,
        date,
        location,
        description,
        createdBy,
      },
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        description: true,
      },
    });
  }

  async findSimilarImages(params: FindSimilarImagesParams) {
    const { eventId, imageBase64, limit = 20 } = params;

    // Check if event exists
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Generate embedding for the uploaded image using Jina API
    const response = await firstValueFrom(
      this.http.post<JinaEmbeddingResponse>(
        'https://api.jina.ai/v1/embeddings',
        {
          model: 'jina-clip-v2',
          input: [
            {
              image: imageBase64,
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

    // Perform vector similarity search using cosine distance
    const similarImages = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        url: string;
        description: string | null;
        createdAt: Date;
        creatorId: string;
        creatorName: string | null;
        creatorDisplayName: string | null;
        creatorImage: string | null;
        similarity: number;
      }>
    >(
      `
      SELECT
        i.id,
        i.url,
        i.description,
        i."createdAt",
        i."creatorId",
        u.name as "creatorName",
        u."displayName" as "creatorDisplayName",
        u.image as "creatorImage",
        1 - (i.embedding <=> $1::vector) as similarity
      FROM images i
      JOIN users u ON i."creatorId" = u.id
      WHERE i."eventId" = $2
        AND i.embedding IS NOT NULL
      ORDER BY i.embedding <=> $1::vector
      LIMIT $3
      `,
      vectorStr,
      eventId,
      limit,
    );

    // Transform results to match expected format
    return {
      images: similarImages.map((img) => ({
        id: img.id,
        url: img.url,
        description: img.description,
        createdAt: img.createdAt,
        similarity: img.similarity,
        creator: {
          id: img.creatorId,
          name: img.creatorName,
          displayName: img.creatorDisplayName,
          image: img.creatorImage,
        },
      })),
    };
  }
}
