import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import Typesense from 'typesense';
import { Client } from 'typesense';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export interface EventDocument {
  id: string;
  name: string;
  description?: string;
  date: number; // Unix timestamp for sorting
  location: string;
  creatorId: string;
  creatorName?: string;
  imageCount: number;
  createdAt: number;
}

export interface CreatorDocument {
  id: string;
  name?: string;
  displayName?: string;
  email: string;
  photographyType?: string;
  location?: string;
  bio?: string;
  eventsCount: number;
  imagesCount: number;
  createdAt: number;
}

export interface ImageDocument {
  id: string;
  publicId: string;
  description?: string;
  bibNumber?: string;
  plateNumber?: string;
  eventId?: string;
  eventName?: string;
  creatorId: string;
  creatorName?: string;
  createdAt: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(@Inject('TYPESENSE_CLIENT') private readonly client: Client) {}

  async onModuleInit() {
    await this.setupCollections();
  }

  private async setupCollections() {
    // Events collection schema
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

    // Creators collection schema
    const creatorsSchema: CollectionCreateSchema = {
      name: 'creators',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string', optional: true },
        { name: 'displayName', type: 'string', optional: true },
        { name: 'email', type: 'string' },
        {
          name: 'photographyType',
          type: 'string',
          optional: true,
          facet: true,
        },
        { name: 'location', type: 'string', optional: true, facet: true },
        { name: 'bio', type: 'string', optional: true },
        { name: 'eventsCount', type: 'int32' },
        { name: 'imagesCount', type: 'int32' },
        { name: 'createdAt', type: 'int64' },
      ],
      default_sorting_field: 'createdAt',
    };

    // Images collection schema
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

    // Create collections if they don't exist
    for (const schema of [eventsSchema, creatorsSchema, imagesSchema]) {
      try {
        await this.client.collections(schema.name).retrieve();
        this.logger.log(`Collection '${schema.name}' already exists`);
      } catch (e) {
        if (e.httpStatus === 404) {
          await this.client.collections().create(schema);
          this.logger.log(`Created collection '${schema.name}'`);
        } else {
          this.logger.error(`Error checking collection '${schema.name}':`, e);
        }
      }
    }
  }

  // ==================== Events ====================

  async indexEvent(event: EventDocument) {
    try {
      await this.client.collections('events').documents().upsert(event);
    } catch (e) {
      this.logger.error('Error indexing event:', e);
    }
  }

  async indexEvents(events: EventDocument[]) {
    try {
      await this.client
        .collections('events')
        .documents()
        .import(events, { action: 'upsert' });
    } catch (e) {
      this.logger.error('Error indexing events:', e);
    }
  }

  async updateEvent(event: Partial<EventDocument> & { id: string }) {
    try {
      await this.client.collections('events').documents(event.id).update(event);
    } catch (e) {
      this.logger.error('Error updating event:', e);
    }
  }

  async deleteEvent(eventId: string) {
    try {
      await this.client.collections('events').documents(eventId).delete();
    } catch (e) {
      this.logger.error('Error deleting event:', e);
    }
  }

  async searchEvents(
    query: string,
    options?: { limit?: number; offset?: number; filter?: string },
  ) {
    try {
      const result = await this.client
        .collections('events')
        .documents()
        .search({
          q: query,
          query_by: 'name,description,location,creatorName',
          per_page: options?.limit || 20,
          page: Math.floor((options?.offset || 0) / (options?.limit || 20)) + 1,
          filter_by: options?.filter,
          sort_by: 'date:desc',
        });

      return {
        hits: result.hits?.map((hit) => hit.document) || [],
        estimatedTotalHits: result.found || 0,
      };
    } catch (e) {
      this.logger.error('Error searching events:', e);
      return { hits: [], estimatedTotalHits: 0 };
    }
  }

  // ==================== Creators ====================

  async indexCreator(creator: CreatorDocument) {
    try {
      await this.client.collections('creators').documents().upsert(creator);
    } catch (e) {
      this.logger.error('Error indexing creator:', e);
    }
  }

  async indexCreators(creators: CreatorDocument[]) {
    try {
      await this.client
        .collections('creators')
        .documents()
        .import(creators, { action: 'upsert' });
    } catch (e) {
      this.logger.error('Error indexing creators:', e);
    }
  }

  async updateCreator(creator: Partial<CreatorDocument> & { id: string }) {
    try {
      await this.client
        .collections('creators')
        .documents(creator.id)
        .update(creator);
    } catch (e) {
      this.logger.error('Error updating creator:', e);
    }
  }

  async deleteCreator(creatorId: string) {
    try {
      await this.client.collections('creators').documents(creatorId).delete();
    } catch (e) {
      this.logger.error('Error deleting creator:', e);
    }
  }

  async searchCreators(
    query: string,
    options?: { limit?: number; offset?: number; filter?: string },
  ) {
    try {
      const result = await this.client
        .collections('creators')
        .documents()
        .search({
          q: query,
          query_by: 'name,displayName,email,location,bio,photographyType',
          per_page: options?.limit || 20,
          page: Math.floor((options?.offset || 0) / (options?.limit || 20)) + 1,
          filter_by: options?.filter,
        });

      return {
        hits: result.hits?.map((hit) => hit.document) || [],
        estimatedTotalHits: result.found || 0,
      };
    } catch (e) {
      this.logger.error('Error searching creators:', e);
      return { hits: [], estimatedTotalHits: 0 };
    }
  }

  // ==================== Images ====================

  async indexImage(image: ImageDocument) {
    try {
      await this.client.collections('images').documents().upsert(image);
    } catch (e) {
      this.logger.error('Error indexing image:', e);
    }
  }

  async indexImages(images: ImageDocument[]) {
    try {
      await this.client
        .collections('images')
        .documents()
        .import(images, { action: 'upsert' });
    } catch (e) {
      this.logger.error('Error indexing images:', e);
    }
  }

  async updateImage(image: Partial<ImageDocument> & { id: string }) {
    try {
      await this.client.collections('images').documents(image.id).update(image);
    } catch (e) {
      this.logger.error('Error updating image:', e);
    }
  }

  async deleteImage(imageId: string) {
    try {
      await this.client.collections('images').documents(imageId).delete();
    } catch (e) {
      this.logger.error('Error deleting image:', e);
    }
  }

  async searchImages(
    query: string,
    options?: { limit?: number; offset?: number; filter?: string },
  ) {
    try {
      const result = await this.client
        .collections('images')
        .documents()
        .search({
          q: query,
          query_by: 'description,bibNumber,plateNumber,eventName,creatorName',
          per_page: options?.limit || 20,
          page: Math.floor((options?.offset || 0) / (options?.limit || 20)) + 1,
          filter_by: options?.filter,
          sort_by: 'createdAt:desc',
        });

      return {
        hits: result.hits?.map((hit) => hit.document) || [],
        estimatedTotalHits: result.found || 0,
      };
    } catch (e) {
      this.logger.error('Error searching images:', e);
      return { hits: [], estimatedTotalHits: 0 };
    }
  }

  // ==================== Global Search ====================

  async globalSearch(query: string, options?: { limit?: number }) {
    const limit = options?.limit || 10;

    try {
      const [events, creators, images] = await Promise.all([
        this.client.collections('events').documents().search({
          q: query,
          query_by: 'name,description,location,creatorName',
          per_page: limit,
        }),
        this.client.collections('creators').documents().search({
          q: query,
          query_by: 'name,displayName,email,location,bio,photographyType',
          per_page: limit,
        }),
        this.client.collections('images').documents().search({
          q: query,
          query_by: 'description,bibNumber,plateNumber,eventName,creatorName',
          per_page: limit,
        }),
      ]);

      return {
        events: events.hits?.map((hit) => hit.document) || [],
        creators: creators.hits?.map((hit) => hit.document) || [],
        images: images.hits?.map((hit) => hit.document) || [],
      };
    } catch (e) {
      this.logger.error('Error in global search:', e);
      return { events: [], creators: [], images: [] };
    }
  }

  // ==================== Bulk Operations ====================

  async clearAllCollections() {
    const collections = ['events', 'creators', 'images'];
    for (const name of collections) {
      try {
        await this.client.collections(name).delete();
        this.logger.log(`Deleted collection '${name}'`);
      } catch (e) {
        this.logger.warn(`Could not delete collection '${name}'`);
      }
    }
    // Re-create collections
    await this.setupCollections();
  }

  async getIndexStats() {
    try {
      const [events, creators, images] = await Promise.all([
        this.client.collections('events').retrieve(),
        this.client.collections('creators').retrieve(),
        this.client.collections('images').retrieve(),
      ]);

      return {
        events: { numberOfDocuments: events.num_documents },
        creators: { numberOfDocuments: creators.num_documents },
        images: { numberOfDocuments: images.num_documents },
      };
    } catch (e) {
      this.logger.error('Error getting index stats:', e);
      return {
        events: { numberOfDocuments: 0 },
        creators: { numberOfDocuments: 0 },
        images: { numberOfDocuments: 0 },
      };
    }
  }
}
