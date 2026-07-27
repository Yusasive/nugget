import { IsUUID } from 'class-validator';
import type { PublicTourDeparturesQuery } from '@nugget/shared-types';

export class PublicTourDeparturesQueryDto
  implements PublicTourDeparturesQuery
{
  @IsUUID()
  tourPackageId: string;
}
