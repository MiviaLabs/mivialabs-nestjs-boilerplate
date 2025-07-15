import { Global, Module } from '@nestjs/common';

import { EventsService } from './events.service';
import { EventRepository } from './repositories';

@Global()
@Module({
  providers: [EventsService, EventRepository],
  exports: [EventsService, EventRepository],
})
export class EventsModule {}
