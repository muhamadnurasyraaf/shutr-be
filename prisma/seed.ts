import { PrismaClient, UserType, photographyType } from '@prisma/client';
import { seedUsers } from '../src/seeds/user.seed';
import { seedCreatorInfos } from '../src/seeds/creator.seed';
import { seedBankingInfos } from '../src/seeds/banking.seed';
import { seedEvents } from '../src/seeds/event.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const users = await seedUsers(prisma);
  await seedCreatorInfos(prisma, users.creators);
  await seedBankingInfos(prisma, users.creators);
  await seedEvents(prisma, users.creators);

  console.log('✔️ Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
