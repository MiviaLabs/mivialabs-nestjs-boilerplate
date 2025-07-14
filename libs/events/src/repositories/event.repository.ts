import { Inject, Injectable } from '@nestjs/common';

import { PostgresDb } from '@db';

@Injectable()
export class EventRepository {
  constructor(@Inject('DB') private readonly db: PostgresDb) {}
}
