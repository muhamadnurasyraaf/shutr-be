import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

export async function seedBankingInfos(prisma: PrismaClient, creators) {
  console.log('➕ Seeding banking info...');

  for (const creator of creators) {
    await prisma.bankingInfo.create({
      data: {
        userId: creator.id,
        bankName: faker.finance.accountName(),
        accountNumber: faker.finance.accountNumber(),
        holderName: creator.name || faker.person.fullName(),
      },
    });
  }
}
