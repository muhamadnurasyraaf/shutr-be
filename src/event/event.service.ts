import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
interface GetEventsParams {
  page: number;
  limit: number;
  eventId?: string;
  sortBy: 'event' | 'date' | 'name';
  sortDirection: 'asc' | 'desc';
}

@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) {}

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
}
