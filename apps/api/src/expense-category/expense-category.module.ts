import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExpenseCategoryController } from './expense-category.controller';
import { ExpenseCategoryService } from './expense-category.service';

@Module({
  imports: [AuthModule],
  controllers: [ExpenseCategoryController],
  providers: [ExpenseCategoryService],
  exports: [ExpenseCategoryService],
})
export class ExpenseCategoryModule {}
