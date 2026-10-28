import { IsBoolean, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { BUILTIN_ROLE_KEYS } from '../../permissions/catalog';

export class CreateAdminUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Matches(/^1\d{10}$/, { message: '请输入正确的手机号' })
  phone!: string;

  @IsString()
  @MinLength(1, { message: '请输入密码' })
  password!: string;

  @IsBoolean()
  isPlatformAdmin!: boolean;

  @IsOptional()
  @IsString()
  tenantId?: string;

  /** Optional Role.key; when isPlatformAdmin and omitted, defaults to platform_admin. */
  @IsOptional()
  @IsIn([...BUILTIN_ROLE_KEYS])
  platformRoleKey?: (typeof BUILTIN_ROLE_KEYS)[number];
}
