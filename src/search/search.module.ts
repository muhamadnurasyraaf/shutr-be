import { Module } from '@nestjs/common';
import Typesense from 'typesense';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  controllers: [SearchController],
  providers: [
    {
      provide: 'TYPESENSE_CLIENT',
      useFactory: () => {
        return new Typesense.Client({
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
      },
    },
    SearchService,
  ],
  exports: ['TYPESENSE_CLIENT', SearchService],
})
export class SearchModule {}
