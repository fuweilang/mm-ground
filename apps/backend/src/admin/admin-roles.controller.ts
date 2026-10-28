import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user';
import { AdminService } from './admin.service';
import { ListAdminRolesDto } from './dto/list-admin-roles.dto';
import { UpdateAdminRoleDto } from './dto/update-admin-role.dto';

@Controller('admin/roles')
@UseGuards(JwtGuard)
export class AdminRolesController {
  constructor(private admin: AdminService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: ListAdminRolesDto) {
    return this.admin.listRoles(user, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: User, @Param('id') id: string) {
    return this.admin.getRole(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateAdminRoleDto) {
    return this.admin.updateRole(user, id, dto);
  }
}
