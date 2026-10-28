import { IsString, Matches, MinLength } from 'class-validator';

const PHONE = /^1\d{10}$/;

export class LoginDto {
  @Matches(PHONE, { message: '请输入正确的手机号' })
  phone!: string;

  @IsString()
  password!: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Matches(PHONE, { message: '请输入正确的手机号' })
  phone!: string;

  @IsString()
  password!: string;

  @IsString()
  @MinLength(1)
  enterpriseName!: string;

  /** 品牌标识：中英文/数字/短横线/下划线，1～40 位，全局唯一。 */
  @Matches(/^[\u4e00-\u9fa5a-zA-Z0-9\-_]{1,40}$/, {
    message: '品牌只能包含中英文、数字、短横线或下划线，1～40 位',
  })
  slug!: string;
}

export class SwitchTenantDto {
  @IsString()
  tenantId!: string;
}

export class ConsumeBrowserSsoDto {
  @IsString()
  ticket!: string;
}
