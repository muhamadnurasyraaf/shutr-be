import { PrismaClient } from '@prisma/client';
import Typesense from 'typesense';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

const prisma = new PrismaClient();
const typesense = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || 'localhost',
      port: parseInt(process.env.TYPESENSE_PORT || '8108', 10),
      protocol: process.env.TYPESENSE_PROTOCOL || 'http',
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || 'xyz123',
  connectionTimeoutSeconds: 2,
});

async function setupCollections() {
  console.log('Setting up Typesense collections...');

  const eventsSchema: CollectionCreateSchema = {
    name: 'events',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string', optional: true },
      { name: 'date', type: 'int64' },
      { name: 'location', type: 'string', facet: true },
      { name: 'creatorId', type: 'string', facet: true },
      { name: 'creatorName', type: 'string', optional: true },
      { name: 'imageCount', type: 'int32' },
      { name: 'createdAt', type: 'int64' },
    ],
    default_sorting_field: 'date',
  };

  const creatorsSchema: CollectionCreateSchema = {
    name: 'creators',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string', optional: true },
      { name: 'displayName', type: 'string', optional: true },
      { name: 'email', type: 'string' },
      { name: 'photographyType', type: 'string', optional: true, facet: true },
      { name: 'location', type: 'string', optional: true, facet: true },
      { name: 'bio', type: 'string', optional: true },
      { name: 'eventsCount', type: 'int32' },
      { name: 'imagesCount', type: 'int32' },
      { name: 'createdAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  };

  const imagesSchema: CollectionCreateSchema = {
    name: 'images',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'publicId', type: 'string' },
      { name: 'description', type: 'string', optional: true },
      { name: 'bibNumber', type: 'string', optional: true, facet: true },
      { name: 'plateNumber', type: 'string', optional: true, facet: true },
      { name: 'eventId', type: 'string', optional: true, facet: true },
      { name: 'eventName', type: 'string', optional: true },
      { name: 'creatorId', type: 'string', facet: true },
      { name: 'creatorName', type: 'string', optional: true },
      { name: 'createdAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  };

  for (const schema of [eventsSchema, creatorsSchema, imagesSchema]) {
    try {
      await typesense.collections(schema.name).retrieve();
      console.log(`  Collection '${schema.name}' already exists`);
    } catch (e: any) {
      if (e.httpStatus === 404) {
        await typesense.collections().create(schema);
        console.log(`  Created collection '${schema.name}'`);
      } else {
        console.error(`  Error checking collection '${schema.name}':`, e.message);
      }
    }
  }

  console.log('Collections setup complete');
}

async function seedCreators() {
  console.log('Syncing creators to Typesense...');

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
    name: creator.name || '',
    displayName: creator.displayName || '',
    email: creator.email,
    photographyType: creator.creatorInfo?.photographyType || '',
    location: creator.creatorInfo?.location || '',
    bio: creator.creatorInfo?.bio || '',
    eventsCount: creator._count.events,
    imagesCount: creator._count.images,
    createdAt: creator.createdAt.getTime(),
  }));

  try {
    await typesense.collections('creators').documents().import(documents, { action: 'upsert' });
    console.log(`  Synced ${creators.length} creators`);
  } catch (e: any) {
    console.error('  Error syncing creators:', e.message);
  }
}

async function seedEvents() {
  console.log('Syncing events to Typesense...');

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
    description: event.description || '',
    date: event.date.getTime(),
    location: event.location,
    creatorId: event.createdBy,
    creatorName: event.creator.displayName || event.creator.name || '',
    imageCount: event._count.images,
    createdAt: event.createdAt.getTime(),
  }));

  try {
    await typesense.collections('events').documents().import(documents, { action: 'upsert' });
    console.log(`  Synced ${events.length} events`);
  } catch (e: any) {
    console.error('  Error syncing events:', e.message);
  }
}

async function seedImages() {
  console.log('Syncing images to Typesense...');

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
    description: image.description || '',
    bibNumber: image.bibNumber || '',
    plateNumber: image.plateNumber || '',
    eventId: image.eventId || '',
    eventName: image.event?.name || '',
    creatorId: image.creatorId,
    creatorName: image.creator.displayName || image.creator.name || '',
    createdAt: image.createdAt.getTime(),
  }));

  // Batch insert in chunks of 1000
  const chunkSize = 1000;
  for (let i = 0; i < documents.length; i += chunkSize) {
    const chunk = documents.slice(i, i + chunkSize);
    try {
      await typesense.collections('images').documents().import(chunk, { action: 'upsert' });
      console.log(`  Synced ${Math.min(i + chunkSize, documents.length)}/${documents.length} images`);
    } catch (e: any) {
      console.error(`  Error syncing images chunk:`, e.message);
    }
  }

  console.log(`  Synced ${images.length} images total`);
}

async function clearAllCollections() {
  console.log('Clearing all Typesense collections...');

  const collections = ['events', 'creators', 'images'];
  for (const name of collections) {
    try {
      await typesense.collections(name).delete();
      console.log(`  Deleted collection '${name}'`);
    } catch (e: any) {
      console.log(`  Collection '${name}' does not exist or already deleted`);
    }
  }
}

export async function seedTypesense(options?: { clear?: boolean }) {
  console.log('Starting Typesense sync...');

  if (options?.clear) {
    await clearAllCollections();
  }

  await setupCollections();
  await seedCreators();
  await seedEvents();
  await seedImages();

  console.log('Typesense sync completed!');
}

// Run directly if called as script
if (require.main === module) {
  const shouldClear = process.argv.includes('--clear');

  seedTypesense({ clear: shouldClear })
    .catch((e) => {
      console.error('Error syncing Typesense:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
