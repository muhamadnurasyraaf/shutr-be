import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

export async function seedEvents(prisma: PrismaClient, creators) {
  console.log('➕ Seeding events...');

  for (const creator of creators) {
    const totalEvents = Math.floor(Math.random() * 3) + 1; // 1–3 events

    for (let i = 0; i < totalEvents; i++) {
      await prisma.event.create({
        data: {
          name: faker.commerce.productName(),
          description: faker.lorem.sentence(),
          date: faker.date.future(),
          location: faker.location.streetAddress(),
          createdBy: creator.id,
        },
      });
    }
  }
}
