import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Global search across events, creators, and images
   * GET /search?q=marathon&limit=10
   */
  @Get()
  async globalSearch(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.trim() === '') {
      return {
        events: [],
        creators: [],
        images: [],
      };
    }

    return this.searchService.globalSearch(query, {
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }

  /**
   * Search events only
   * GET /search/events?q=marathon&limit=20
   * Use q=* to list all documents
   */
  @Get('events')
  async searchEvents(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // Allow * for listing all, otherwise require query
    const searchQuery = query === '*' ? '' : query;
    if (!query || (query.trim() === '' && query !== '*')) {
      return { hits: [], estimatedTotalHits: 0 };
    }

    return this.searchService.searchEvents(searchQuery || '*', {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * Search creators/photographers only
   * GET /search/creators?q=john&limit=20
   * Use q=* to list all documents
   */
  @Get('creators')
  async searchCreators(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('photographyType') photographyType?: string,
  ) {
    const searchQuery = query === '*' ? '' : query;
    if (!query || (query.trim() === '' && query !== '*')) {
      return { hits: [], estimatedTotalHits: 0 };
    }

    const filter = photographyType
      ? `photographyType:${photographyType}`
      : undefined;

    return this.searchService.searchCreators(searchQuery || '*', {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      filter,
    });
  }

  /**
   * Search images by bib number, plate number, or description
   * GET /search/images?q=1234&limit=20
   * Use q=* to list all documents
   */
  @Get('images')
  async searchImages(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('eventId') eventId?: string,
  ) {
    const searchQuery = query === '*' ? '' : query;
    if (!query || (query.trim() === '' && query !== '*')) {
      return { hits: [], estimatedTotalHits: 0 };
    }

    const filter = eventId ? `eventId:${eventId}` : undefined;

    return this.searchService.searchImages(searchQuery || '*', {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      filter,
    });
  }

  /**
   * Get index stats (for debugging/monitoring)
   * GET /search/stats
   */
  @Get('stats')
  async getStats() {
    return this.searchService.getIndexStats();
  }
}
