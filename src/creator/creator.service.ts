import { Injectable } from '@nestjs/common';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

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
      },
    });
  }

  async getCreatorContents(userId: string) {
    return this.prisma.image.findMany({
      where: {
        creatorId: userId,
      },
      select: {
        id: true,
        url: true,
        description: true,
        event: true,
      },
    });
  }

  async uploadContent(file: Express.Multer.File) {
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
        embedding,
        "creatorId",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2::vector,
        $3,
        NOW()
      )
      RETURNING id, url, description, "creatorId", "eventId", "createdAt", "updatedAt";
    `,
        cloudinaryUrl,
        vectorStr,
        '6640bff6-895d-4205-8ecc-0db6c8ddeaf2',
      );

      console.log('Upload complete!');
      return created[0];
    } catch (error) {
      console.error('Error uploading content:', error);
      throw error;
    }
  }
}
