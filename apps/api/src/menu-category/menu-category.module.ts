import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MenuCategoryController } from './menu-category.controller';
import { MenuCategoryService } from './menu-category.service';

@Module({
  imports: [AuthModule],
  controllers: [MenuCategoryController],
  providers: [MenuCategoryService],
  exports: [MenuCategoryService],
})
export class MenuCategoryModule {}
