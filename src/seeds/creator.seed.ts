import { PrismaClient, photographyType } from '@prisma/client';
import { faker } from '@faker-js/faker';

export async function seedCreatorInfos(prisma: PrismaClient, creators) {
  console.log('➕ Seeding creator infos...');

  const types = [
    photographyType.Marathon,
    photographyType.Wildlife,
    photographyType.Motorsports,
  ];

  for (const creator of creators) {
    await prisma.creatorInfo.create({
      data: {
        userId: creator.id,
        bio: faker.lorem.paragraph(),
        location: faker.location.city(),
        photographyType: faker.helpers.arrayElement(types),
      },
    });
  }
}
