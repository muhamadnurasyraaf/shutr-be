import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}
  getHello(): string {
    return 'Hello World!';
  }

  async retrieveEventsAndCreators() {
    const recentEvents = await this.prisma.event.findMany({
      select: {
        id: true,
        name: true,
        date: true,
        thumbnailUrl: true,
        location: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 6,
    });

    const topPhotographers = await this.prisma.user.findMany({
      where: {
        type: 'Creator',
      },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        creatorInfo: {
          select: {
            location: true,
          },
        },
      },

      take: 5,
    });

    return {
      recentEvents,
      topPhotographers,
    };
  }

  async search(query: string) {
    if (!query || query.trim() === '') {
      return {
        events: [],
        photographers: [],
      };
    }

    const searchTerm = query.trim();

    const [events, photographers] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { location: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          date: true,
          thumbnailUrl: true,
          location: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.user.findMany({
        where: {
          type: 'Creator',
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { displayName: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          creatorInfo: {
            select: {
              location: true,
            },
          },
        },
      }),
    ]);

    return {
      events,
      photographers,
    };
  }
}
