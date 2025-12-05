import { PrismaClient } from '@prisma/client';
import { MeiliSearch } from 'meilisearch';

const prisma = new PrismaClient();
const meili = new MeiliSearch({
  host: process.env.MEILI_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY,
});

async function setupIndexes() {
  console.log('Setting up Meilisearch indexes...');

  // Create indexes
  const indexes = ['events', 'creators', 'images'];
  for (const indexName of indexes) {
    try {
      await meili.createIndex(indexName, { primaryKey: 'id' });
      console.log(`  Created index: ${indexName}`);
    } catch (e) {
      console.log(`  Index ${indexName} already exists`);
    }
  }

  // Configure events index
  const eventsIndex = meili.index('events');
  await eventsIndex.updateSearchableAttributes([
    'name',
    'description',
    'location',
    'creatorName',
  ]);
  await eventsIndex.updateFilterableAttributes(['creatorId', 'date', 'location']);
  await eventsIndex.updateSortableAttributes(['date', 'createdAt', 'name']);

  // Configure creators index
  const creatorsIndex = meili.index('creators');
  await creatorsIndex.updateSearchableAttributes([
    'name',
    'displayName',
    'email',
    'location',
    'bio',
    'photographyType',
  ]);
  await creatorsIndex.updateFilterableAttributes(['photographyType', 'location']);
  await creatorsIndex.updateSortableAttributes(['createdAt', 'name']);

  // Configure images index
  const imagesIndex = meili.index('images');
  await imagesIndex.updateSearchableAttributes([
    'description',
    'bibNumber',
    'plateNumber',
    'eventName',
    'creatorName',
  ]);
  await imagesIndex.updateFilterableAttributes([
    'eventId',
    'creatorId',
    'bibNumber',
    'plateNumber',
  ]);
  await imagesIndex.updateSortableAttributes(['createdAt']);

  console.log('Indexes configured successfully');
}

async function seedCreators() {
  console.log('Syncing creators to Meilisearch...');

  const creators = await prisma.user.findMany({
    where: { type: 'Creator' },
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

  if (creators.length === 0) {
    console.log('  No creators found to sync');
    return;
  }

  const documents = creators.map((creator) => ({
    id: creator.id,
    name: creator.name || undefined,
    displayName: creator.displayName || undefined,
    email: creator.email,
    photographyType: creator.creatorInfo?.photographyType || undefined,
    location: creator.creatorInfo?.location || undefined,
    bio: creator.creatorInfo?.bio || undefined,
    eventsCount: creator._count.events,
    imagesCount: creator._count.images,
    createdAt: creator.createdAt.toISOString(),
  }));

  const creatorsIndex = meili.index('creators');
  await creatorsIndex.addDocuments(documents);

  console.log(`  Synced ${creators.length} creators`);
}

async function seedEvents() {
  console.log('Syncing events to Meilisearch...');

  const events = await prisma.event.findMany({
    include: {
      creator: {
        select: {
          name: true,
          displayName: true,
        },
      },
      _count: {
        select: {
          images: true,
        },
      },
    },
  });

  if (events.length === 0) {
    console.log('  No events found to sync');
    return;
  }

  const documents = events.map((event) => ({
    id: event.id,
    name: event.name,
    description: event.description || undefined,
    date: event.date.toISOString(),
    location: event.location,
    creatorId: event.createdBy,
    creatorName: event.creator.displayName || event.creator.name || undefined,
    imageCount: event._count.images,
    createdAt: event.createdAt.toISOString(),
  }));

  const eventsIndex = meili.index('events');
  await eventsIndex.addDocuments(documents);

  console.log(`  Synced ${events.length} events`);
}

async function seedImages() {
  console.log('Syncing images to Meilisearch...');

  const images = await prisma.image.findMany({
    include: {
      event: {
        select: {
          name: true,
        },
      },
      creator: {
        select: {
          name: true,
          displayName: true,
        },
      },
    },
  });

  if (images.length === 0) {
    console.log('  No images found to sync');
    return;
  }

  const documents = images.map((image) => ({
    id: image.id,
    publicId: image.publicId,
    description: image.description || undefined,
    bibNumber: image.bibNumber || undefined,
    plateNumber: image.plateNumber || undefined,
    eventId: image.eventId || undefined,
    eventName: image.event?.name || undefined,
    creatorId: image.creatorId,
    creatorName: image.creator.displayName || image.creator.name || undefined,
    createdAt: image.createdAt.toISOString(),
  }));

  const imagesIndex = meili.index('images');

  // Batch insert in chunks of 1000 to avoid memory issues
  const chunkSize = 1000;
  for (let i = 0; i < documents.length; i += chunkSize) {
    const chunk = documents.slice(i, i + chunkSize);
    await imagesIndex.addDocuments(chunk);
    console.log(`  Synced ${Math.min(i + chunkSize, documents.length)}/${documents.length} images`);
  }

  console.log(`  Synced ${images.length} images total`);
}

async function clearAllIndexes() {
  console.log('Clearing all Meilisearch indexes...');

  const indexes = ['events', 'creators', 'images'];
  for (const indexName of indexes) {
    try {
      const index = meili.index(indexName);
      await index.deleteAllDocuments();
      console.log(`  Cleared index: ${indexName}`);
    } catch (e) {
      console.log(`  Could not clear index ${indexName}`);
    }
  }
}

export async function seedMeilisearch(options?: { clear?: boolean }) {
  console.log('Starting Meilisearch sync...');

  await setupIndexes();

  if (options?.clear) {
    await clearAllIndexes();
  }

  await seedCreators();
  await seedEvents();
  await seedImages();

  console.log('Meilisearch sync completed!');
}

// Run directly if called as script
if (require.main === module) {
  const shouldClear = process.argv.includes('--clear');

  seedMeilisearch({ clear: shouldClear })
    .catch((e) => {
      console.error('Error syncing Meilisearch:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
