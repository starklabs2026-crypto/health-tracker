import { Module } from '@nestjs/common';

import { ReadingsController } from './readings.controller.js';
import { ReadingsService } from './readings.service.js';

@Module({
  controllers: [ReadingsController],
  providers: [ReadingsService],
})
export class ReadingsModule {}
