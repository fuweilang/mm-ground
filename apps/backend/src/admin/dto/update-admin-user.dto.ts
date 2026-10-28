import { IsBoolean, IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { BUILTIN_ROLE_KEYS } from '../../permissions/catalog';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPlatformAdmin?: boolean;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;

  /** Bind any built-in Role by key; null clears. isPlatformAdmin syncs from role.scope === PLATFORM. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn([...BUILTIN_ROLE_KEYS])
  platformRoleKey?: (typeof BUILTIN_ROLE_KEYS)[number] | null;

  /** 所属企业；null = 解绑全部企业，string = 只保留该企业。 */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  tenantId?: string | null;
}
