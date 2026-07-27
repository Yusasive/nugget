import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TourPackageController } from './tour-package.controller';
import { TourPackageService } from './tour-package.service';

@Module({
  imports: [AuthModule],
  controllers: [TourPackageController],
  providers: [TourPackageService],
  exports: [TourPackageService],
})
export class TourPackageModule {}
