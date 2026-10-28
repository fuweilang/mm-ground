import { IsBoolean, IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MinLength(1, { message: '请输入密码' })
  password?: string;

  /** Set platform role; null clears platform admin. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(['super_admin', 'platform_admin'])
  platformRoleKey?: 'super_admin' | 'platform_admin' | null;
}
