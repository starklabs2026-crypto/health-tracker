import { Module } from '@nestjs/common';

import { FamilyController } from './family.controller.js';
import { FamilyService } from './family.service.js';

@Module({
  controllers: [FamilyController],
  providers: [FamilyService],
  exports: [FamilyService],
})
export class FamilyModule {}
