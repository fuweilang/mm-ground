import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './admin.service';
import { AdminUserController } from './admin-user.controller';
import { AdminEnterpriseController } from './admin-enterprise.controller';
import { AdminPermissionsController } from './admin-permissions.controller';
import { AdminRolesController } from './admin-roles.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminUserController, AdminEnterpriseController, AdminPermissionsController, AdminRolesController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
