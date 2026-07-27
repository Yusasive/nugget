import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type {
  FolioChargeDto,
  FolioDto,
  InvoiceDto,
} from '@nugget/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ActorContext } from '../context/actor.types';
import { CreateFolioChargeDto } from './dto/create-folio-charge.dto';
import { FolioService } from './folio.service';
import { InvoiceService } from './invoice.service';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FolioController {
  constructor(
    private readonly folioService: FolioService,
    private readonly invoiceService: InvoiceService,
  ) {}

  @Get(':id/folio')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT')
  getFolio(@Param('id') id: string): Promise<FolioDto> {
    return this.folioService.getFolio(id);
  }

  @Post(':id/folio-charges')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  addCharge(
    @Param('id') id: string,
    @Body() dto: CreateFolioChargeDto,
    @CurrentUser() actor: ActorContext,
  ): Promise<FolioChargeDto> {
    return this.folioService.addCharge(id, dto, actor);
  }

  @Post(':id/invoices')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK')
  issueInvoice(
    @Param('id') id: string,
    @CurrentUser() actor: ActorContext,
  ): Promise<InvoiceDto> {
    return this.invoiceService.issueInvoice(id, actor);
  }
}
