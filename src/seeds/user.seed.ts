import { PrismaClient, User, UserType } from '@prisma/client';
import { faker } from '@faker-js/faker';

export async function seedUsers(prisma: PrismaClient) {
  console.log('➕ Seeding users...');

  const creators: User[] = [];
  const customers: User[] = [];

  // Create 5 creators
  for (let i = 0; i < 5; i++) {
    const creator = await prisma.user.create({
      data: {
        email: faker.internet.email(),
        name: faker.person.fullName(),
        displayName: faker.internet.displayName(),
        phoneNumber: faker.phone.number(),
        type: UserType.Creator,
        googleId: faker.string.uuid(),
      },
    });
    creators.push(creator);
  }

  // Create 10 customers
  for (let i = 0; i < 10; i++) {
    const customer = await prisma.user.create({
      data: {
        email: faker.internet.email(),
        name: faker.person.fullName(),
        displayName: faker.internet.displayName(),
        phoneNumber: faker.phone.number(),
        type: UserType.Customer,
        googleId: faker.string.uuid(),
      },
    });
    customers.push(customer);
  }

  return { creators, customers };
}
