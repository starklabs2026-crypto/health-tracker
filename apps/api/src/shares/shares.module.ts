import { Module } from '@nestjs/common';

import { PublicShareController, SharesController } from './shares.controller.js';
import { SharesService } from './shares.service.js';

@Module({
  controllers: [SharesController, PublicShareController],
  providers: [SharesService],
})
export class SharesModule {}
