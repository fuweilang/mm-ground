<template>
  <section class="user-page">
    <div class="user-toolbar">
      <div class="user-search-wrap">
        <el-input
          v-model="nameDraft"
          class="user-search-keyword"
          clearable
          placeholder="搜索姓名"
          :prefix-icon="Search"
          @clear="onSearchNow"
          @input="onSearchInput"
          @keyup.enter="onSearchNow"
        />
        <el-input
          v-model="phoneDraft"
          class="user-search"
          clearable
          placeholder="搜索手机号"
          :prefix-icon="Search"
          @clear="onSearchNow"
          @input="onPhoneInput"
          @keyup.enter="onSearchNow"
        />
        <el-select
          v-model="roleFilter"
          class="role-filter"
          clearable
          placeholder="筛选角色"
          @change="onSearchNow"
          @clear="onSearchNow"
        >
          <el-option
            v-for="role in roleOptions"
            :key="role.key"
            :label="role.name"
            :value="role.key"
          />
          <el-option label="无角色" value="none" />
        </el-select>
        <el-select
          v-model="statusFilter"
          class="status-filter"
          clearable
          placeholder="账号状态"
          @change="onSearchNow"
          @clear="onSearchNow"
        >
          <el-option label="激活" value="active" />
          <el-option label="停用" value="inactive" />
        </el-select>
        <el-select
          v-model="enterpriseFilter"
          class="enterprise-filter"
          clearable
          filterable
          placeholder="筛选所属企业"
          @change="onEnterpriseChange"
          @clear="onEnterpriseChange"
        >
          <el-option
            v-for="item in enterprises"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </div>
      <el-button class="toolbar-button" :loading="loading" type="primary" @click="onSearchNow">
        搜索
      </el-button>
      <el-button class="toolbar-button" @click="onReset">
        重置
      </el-button>
      <div class="user-actions">
        <el-button type="primary" @click="openCreate">新建</el-button>
      </div>
    </div>

    <el-alert
      v-if="loadError"
      class="page-alert"
      type="error"
      show-icon
      :closable="false"
      :title="loadError"
    >
      <template #default>
        <el-button text type="primary" @click="load">
          重试
        </el-button>
      </template>
    </el-alert>

    <el-table
      v-loading="loading"
      :data="pagedRows"
      border
      class="user-table"
      header-cell-class-name="user-table-header"
    >
      <el-table-column label="用户名/姓名" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.name }}
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" width="120" />
      <el-table-column label="角色" min-width="180">
        <template #default="{ row }">
          <div class="role-tags">
            <el-tag
              v-for="tag in roleTags(row)"
              :key="tag.label"
              class="identity-tag"
              size="small"
              :style="roleTagStyle(tag.color)"
            >
              <span class="visual-dot" :style="{ backgroundColor: tag.color }" />
              {{ tag.label }}
            </el-tag>
            <span v-if="roleTags(row).length === 0" class="muted">普通用户</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="所属企业" min-width="220">
        <template #default="{ row }">
          <span v-if="row.tenants.length === 0" class="muted">-</span>
          <span
            v-for="tenant in row.tenants"
            :key="tenant.id"
            class="subject-label"
          >
            <span class="visual-dot" :style="{ backgroundColor: tenantColor(tenant.id) }" />
            <span>{{ tenant.name }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="账号状态" width="100">
        <template #default="{ row }">
          <el-tooltip
            v-if="row.blockedByTenant"
            content="所属企业已停用，请先在企业管理中启用该企业"
            placement="top"
          >
            <el-tag size="small" type="info">停用</el-tag>
          </el-tooltip>
          <el-tag v-else size="small" :type="row.status === 'active' ? 'success' : 'info'">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="330" fixed="right" align="center">
        <template #default="{ row }">
          <div class="operation-buttons">
            <el-button text type="primary" @click="openView(row)">
              查看
            </el-button>
            <el-button text type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button
              v-if="canChangePassword(row)"
              text
              type="primary"
              @click="openChangePassword(row)"
            >
              修改密码
            </el-button>
            <el-button
              v-if="row.status === 'active' && !row.blockedByTenant && !isSuperAdminRow(row)"
              text
              type="warning"
              :disabled="row.id === currentUserId"
              :loading="statusChangingId === row.id"
              @click="onDeactivate(row)"
            >
              停用
            </el-button>
            <el-button
              v-if="row.status !== 'active' && !row.blockedByTenant && !isSuperAdminRow(row)"
              text
              type="success"
              :loading="statusChangingId === row.id"
              @click="onActivate(row)"
            >
              启用
            </el-button>
            <el-button
              v-if="canDeleteUser(row)"
              text
              type="danger"
              :loading="deletingId === row.id"
              @click="onDelete(row)"
            >
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="emptyText">
          <el-button v-if="!hasActiveFilters" type="primary" @click="openCreate">
            新建用户
          </el-button>
        </el-empty>
      </template>
    </el-table>

    <div class="user-pagination">
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50]"
        :total="filteredRows.length"
        @current-change="onPageChange"
        @size-change="onPageSizeChange"
      />
    </div>

    <el-dialog
      v-model="open"
      :title="editingId ? '编辑用户' : '新建用户'"
      class="user-dialog"
      width="520px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-form-item label="姓名" prop="name">
          <el-input
            v-model="form.name"
            maxlength="40"
            placeholder="请输入姓名"
            @input="form.name = form.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s·.-]/g, '')"
          />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input
            v-model="form.phone"
            maxlength="11"
            :disabled="Boolean(editingId)"
            placeholder="请输入手机号"
            @input="form.phone = form.phone.replace(/[^\d]/g, '').slice(0, 11)"
          />
          <div v-if="editingId" class="form-hint">
            手机号创建后不可修改
          </div>
        </el-form-item>
        <el-form-item v-if="!editingId" label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="请输入密码"
          />
        </el-form-item>
        <el-form-item v-if="!editingId" label="确认密码" prop="passwordConfirm">
          <el-input
            v-model="form.passwordConfirm"
            type="password"
            show-password
            placeholder="请再次输入密码"
          />
        </el-form-item>
        <el-form-item v-if="!hideRoleSelect" label="角色" prop="roleKeys">
          <el-select
            v-model="form.roleKeys"
            multiple
            clearable
            collapse-tags
            collapse-tags-tooltip
            style="width: 100%"
            placeholder="可多选，权限取并集"
            @change="onRoleKeyChange"
          >
            <el-option
              v-for="role in assignableRoles"
              :key="role.key"
              :label="role.name"
              :value="role.key"
            />
          </el-select>
          <div class="field-hint">
            角色来自「角色管理」，可多选，用户权限是所选角色的并集。所属企业只能选一家。角色变更在该用户下次登录后生效。
          </div>
        </el-form-item>
        <el-form-item v-if="!hideRoleSelect" label="所属企业" prop="tenantId">
          <el-select
            v-model="form.tenantId"
            filterable
            placeholder="选择一家企业"
            style="width: 100%"
          >
            <el-option v-for="t in enterprises" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="viewOpen"
      title="查看用户"
      class="user-dialog"
      width="520px"
    >
      <el-descriptions v-if="viewingRow" :column="1" border>
        <el-descriptions-item label="姓名">
          {{ viewingRow.name }}
        </el-descriptions-item>
        <el-descriptions-item label="手机号">
          {{ viewingRow.phone }}
        </el-descriptions-item>
        <el-descriptions-item label="角色">
          {{ roleLabel(viewingRow) }}
        </el-descriptions-item>
        <el-descriptions-item label="所属企业">
          <span v-if="viewingRow.tenants.length === 0" class="muted">-</span>
          <span v-else>{{ viewingRow.tenants.map((t) => t.name).join('、') }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="账号状态">
          {{ viewingRow.blockedByTenant ? '停用（所属企业已停用）' : statusLabel(viewingRow.status) }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatTime(viewingRow.createdAt) }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="viewOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="passwordOpen"
      title="修改密码"
      class="user-dialog"
      width="460px"
    >
      <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="96px">
        <el-form-item label="新密码" prop="password">
          <el-input
            v-model="passwordForm.password"
            type="password"
            show-password
            placeholder="请输入新密码"
            @input="passwordFormRef?.clearValidate('confirm')"
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm">
          <el-input
            v-model="passwordForm.confirm"
            type="password"
            show-password
            placeholder="请再次输入密码"
          />
        </el-form-item>
        <div class="form-hint form-hint-block">
          修改后该用户需使用新密码重新登录
        </div>
      </el-form>
      <template #footer>
        <el-button @click="passwordOpen = false">取消</el-button>
        <el-button type="primary" :loading="passwordSaving" @click="onChangePassword">确定</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Search } from 'lucide-vue-next';
import { adminEnterpriseApi, adminRoleApi, adminUserApi, type AdminEnterpriseRow, type AdminRoleRow, type AdminUserRow } from '../../api/admin';
import { useAuthStore } from '../../stores/auth';

const TENANT_COLORS = ['#7c3aed', '#0891b2', '#c2410c', '#15803d', '#be123c', '#4f46e5', '#a16207', '#0f766e'];

const auth = useAuthStore();
const rows = ref<AdminUserRow[]>([]);
const enterprises = ref<AdminEnterpriseRow[]>([]);
const roleOptions = ref<AdminRoleRow[]>([]);
const loading = ref(false);
const loadError = ref('');
const open = ref(false);
const saving = ref(false);
const editingId = ref('');
const initialTenantId = ref('');
const passwordOpen = ref(false);
const viewOpen = ref(false);
const viewingRow = ref<AdminUserRow | null>(null);
const passwordSaving = ref(false);
const passwordTargetId = ref('');
const passwordFormRef = ref<FormInstance>();
const passwordForm = reactive({
  password: '',
  confirm: '',
});
const statusChangingId = ref('');
const deletingId = ref('');
const nameDraft = ref('');
const phoneDraft = ref('');
const roleFilter = ref('');
const statusFilter = ref('');
const enterpriseFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const formRef = ref<FormInstance>();
let searchTimer = 0;
let requestSequence = 0;

const form = reactive({
  name: '',
  phone: '',
  password: '',
  passwordConfirm: '',
  /** 用户角色（多选）；空数组 = 无角色。 */
  roleKeys: [] as string[],
  tenantId: '',
});

/** Editing an existing super_admin: hide role select; role fixed. */
const hideRoleSelect = computed(
  () => Boolean(editingId.value) && form.roleKeys.includes('super_admin'),
);

/** 可分配角色：超级管理员不可在用户管理里新分配。 */
const assignableRoles = computed(() =>
  roleOptions.value.filter((role) => role.key !== 'super_admin'),
);

/** 只要有一个角色不是超级管理员/平台管理员，就必须选一家企业。 */
const requiresEnterprise = computed(
  () =>
    form.roleKeys.length > 0
    && !form.roleKeys.every((key) => ['super_admin', 'platform_admin'].includes(key)),
);

function onRoleKeyChange() {
  formRef.value?.validateField('tenantId').catch(() => undefined);
}

const currentUserId = computed(() => auth.session?.user.id || '');

const actorIsSuperAdmin = computed(
  () =>
    auth.session?.platformRoleKey === 'super_admin'
    || auth.session?.user?.platformRoleKey === 'super_admin',
);

function canChangePassword(row: AdminUserRow) {
  if (row.platformRoleKey === 'super_admin' && !actorIsSuperAdmin.value) return false;
  return true;
}

/** 超管行不提供停用/启用/删除入口。 */
function isSuperAdminRow(row: AdminUserRow) {
  return row.platformRoleKey === 'super_admin';
}

const rules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [{ required: true, pattern: /^1\d{10}$/, message: '请输入 11 位手机号', trigger: 'blur' }],
  roleKeys: [{ required: true, type: 'array', min: 1, message: '请至少选择一个角色', trigger: 'change' }],
  password: [
    {
      validator: (_rule, value: string, callback) => {
        if (!editingId.value && !value) {
          callback(new Error('请输入密码'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
  passwordConfirm: [
    {
      validator: (_rule, value: string, callback) => {
        if (editingId.value) {
          callback();
          return;
        }
        if (!value) {
          callback(new Error('请再次输入密码'));
          return;
        }
        if (value !== form.password) {
          callback(new Error('两次输入的密码不一致'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
  tenantId: [
    {
      validator: (_rule, value: string, callback) => {
        if (requiresEnterprise.value && !value) {
          callback(new Error('该角色必须选择所属企业'));
          return;
        }
        callback();
      },
      trigger: 'change',
    },
  ],
};

const hasActiveFilters = computed(() =>
  Boolean(nameDraft.value || phoneDraft.value || roleFilter.value || statusFilter.value || enterpriseFilter.value),
);

const passwordRules: FormRules = {
  password: [{ required: true, message: '请输入新密码', trigger: 'blur' }],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== passwordForm.password) {
          callback(new Error('两次输入的密码不一致'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
};

const emptyText = computed(() => (hasActiveFilters.value ? '没有符合条件的用户' : '还没有用户'));

const filteredRows = computed(() => {
  const name = nameDraft.value.trim();
  const phone = phoneDraft.value.trim();
  return rows.value.filter((row) => {
    if (name && !row.name.includes(name)) return false;
    if (phone && !row.phone.includes(phone)) return false;
    return true;
  });
});

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

type RoleTag = { label: string; color: string };

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#7c3aed',
  platform_admin: '#1d4ed8',
  org_admin: '#0891b2',
  org_member: '#15803d',
};

/** 多角色：每个角色一个标签，超级管理员排最前。 */
function roleTags(row: AdminUserRow): RoleTag[] {
  const keys = row.roleKeys ?? [];
  const names = row.roleNames ?? [];
  let tags = keys.map((key, index) => ({
    label: names[index] ?? key,
    color: ROLE_COLORS[key] ?? '#2563eb',
    key,
  }));
  // 平台账号只展示平台身份，避免和企业内角色混在一起
  if (tags.some((tag) => tag.key === 'super_admin' || tag.key === 'platform_admin')) {
    tags = tags.filter((tag) => tag.key === 'super_admin' || tag.key === 'platform_admin');
  }
  if (tags.length > 0) {
    return tags
      .map(({ label, color }) => ({ label, color }))
      .sort((a, b) => (a.label === '超级管理员' ? -1 : b.label === '超级管理员' ? 1 : 0));
  }

  const tenant = row.tenants[0];
  if (tenant?.role === 'ADMIN' || tenant?.role === 'OWNER') return [{ label: '企业管理员', color: '#0891b2' }];
  if (tenant?.role === 'MEMBER') return [{ label: '企业成员', color: '#15803d' }];
  return [];
}

function roleLabel(row: AdminUserRow) {
  const tags = roleTags(row);
  return tags.length ? tags.map((tag) => tag.label).join(' · ') : '普通用户';
}

function statusLabel(status: string) {
  return status === 'active' ? '激活' : '停用';
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 只有超级管理员行不提供删除入口，其余一律可删。 */
function canDeleteUser(row: AdminUserRow) {
  return !isSuperAdminRow(row);
}

function roleTagStyle(color: string) {
  return {
    backgroundColor: `${color}14`,
    borderColor: color,
    color,
  };
}

function tenantColor(id: string) {
  let hash = 0;
  for (const character of id) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  return TENANT_COLORS[hash % TENANT_COLORS.length];
}

function resetPage() {
  currentPage.value = 1;
}

function onSearchInput() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(onSearchNow, 350);
}

function onPhoneInput(value: string) {
  phoneDraft.value = value.replace(/\D/g, '').slice(0, 11);
  onSearchInput();
}

function onSearchNow() {
  window.clearTimeout(searchTimer);
  resetPage();
  void load();
}

function onEnterpriseChange() {
  resetPage();
  void load();
}

function onReset() {
  window.clearTimeout(searchTimer);
  nameDraft.value = '';
  phoneDraft.value = '';
  roleFilter.value = '';
  statusFilter.value = '';
  enterpriseFilter.value = '';
  resetPage();
  void load();
}

function onPageChange(page: number) {
  currentPage.value = page;
}

function onPageSizeChange(size: number) {
  pageSize.value = size;
  resetPage();
}

function resetForm() {
  editingId.value = '';
  initialTenantId.value = '';
  form.name = '';
  form.phone = '';
  form.password = '';
  form.passwordConfirm = '';
  form.roleKeys = [];
  form.tenantId = '';
  formRef.value?.clearValidate();
}

function clearFormError() {
  // 等表单渲染完再清，避免复用弹窗时残留上一个用户的报错
  void nextTick(() => formRef.value?.clearValidate());
}

function openCreate() {
  resetForm();
  open.value = true;
  clearFormError();
}

function openView(row: AdminUserRow) {
  viewingRow.value = row;
  viewOpen.value = true;
}

function openEdit(row: AdminUserRow) {
  resetForm();
  editingId.value = row.id;
  form.name = row.name;
  form.phone = row.phone;
  form.password = '';
  const tenant = row.tenants[0];
  const legacyKey = row.platformRoleKey
    ?? tenant?.roleKey
    ?? (tenant?.role === 'ADMIN' || tenant?.role === 'OWNER' ? 'org_admin' : tenant?.role === 'MEMBER' ? 'org_member' : '');
  form.roleKeys = row.roleKeys?.length ? [...row.roleKeys] : (legacyKey ? [legacyKey] : []);
  form.tenantId = row.tenants[0]?.id ?? '';
  initialTenantId.value = form.tenantId;
  open.value = true;
  clearFormError();
}

async function load() {
  const sequence = ++requestSequence;
  loading.value = true;
  try {
    const result = await adminUserApi.list({
      keyword: nameDraft.value.trim() || phoneDraft.value.trim(),
      role: roleFilter.value,
      status: statusFilter.value,
      enterpriseId: enterpriseFilter.value,
    });
    if (sequence !== requestSequence) return;
    rows.value = result;
    loadError.value = '';
  } catch (e) {
    if (sequence !== requestSequence) return;
    loadError.value = e instanceof Error ? e.message : '加载失败';
    ElMessage.error(loadError.value);
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

async function loadEnterprises() {
  try {
    enterprises.value = await adminEnterpriseApi.list();
  } catch {
    enterprises.value = [];
  }
}

async function loadRoles() {
  try {
    // 只允许分配平台角色；企业预设由成员身份自动套用
    roleOptions.value = await adminRoleApi.list();
  } catch {
    roleOptions.value = [];
  }
}

async function onSave() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    // 多角色：权限取并集；只有全部是超级管理员/平台管理员时才可以不绑企业。
    const isPlatformAccount = form.roleKeys.every((key) => ['super_admin', 'platform_admin'].includes(key));
    if (editingId.value) {
      const payload: Parameters<typeof adminUserApi.update>[1] = {
        name: form.name.trim(),
      };
      // super_admin edit: do not send roleKeys / isPlatformAdmin
      if (!hideRoleSelect.value) {
        payload.isPlatformAdmin = isPlatformAccount;
        payload.roleKeys = [...form.roleKeys];
        payload.tenantId = form.tenantId || null;
      }
      await adminUserApi.update(editingId.value, payload);
      ElMessage.success('已保存');
    } else {
      await adminUserApi.create({
        name: form.name.trim(),
        phone: form.phone,
        password: form.password,
        isPlatformAdmin: isPlatformAccount,
        roleKeys: [...form.roleKeys],
        ...(form.tenantId ? { tenantId: form.tenantId } : {}),
      });
      ElMessage.success('已创建');
    }
    open.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

function resetPasswordForm() {
  passwordTargetId.value = '';
  passwordForm.password = '';
  passwordForm.confirm = '';
  passwordFormRef.value?.clearValidate();
}

function openChangePassword(row: AdminUserRow) {
  if (!canChangePassword(row)) return;
  passwordTargetId.value = row.id;
  passwordForm.password = '';
  passwordForm.confirm = '';
  passwordOpen.value = true;
  void nextTick(() => passwordFormRef.value?.clearValidate());
}

async function onChangePassword() {
  if (!passwordTargetId.value) return;
  const valid = await passwordFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  passwordSaving.value = true;
  try {
    await adminUserApi.changePassword(passwordTargetId.value, passwordForm.password);
    ElMessage.success('密码已更新');
    passwordOpen.value = false;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '修改密码失败');
  } finally {
    passwordSaving.value = false;
  }
}

async function onActivate(row: AdminUserRow) {
  try {
    await ElMessageBox.confirm(`启用后「${row.name}」可以重新登录。确定启用？`, '启用用户', {
      type: 'info',
      confirmButtonText: '启用',
    });
  } catch {
    return;
  }
  statusChangingId.value = row.id;
  try {
    await adminUserApi.update(row.id, { status: 'active' });
    ElMessage.success('已启用');
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '启用失败');
  } finally {
    statusChangingId.value = '';
  }
}

async function onDeactivate(row: AdminUserRow) {
  try {
    await ElMessageBox.confirm(`停用后「${row.name}」将无法登录。确定停用？`, '停用用户', {
      type: 'warning',
      confirmButtonText: '停用',
      confirmButtonClass: 'el-button--danger',
    });
  } catch {
    return;
  }
  statusChangingId.value = row.id;
  try {
    await adminUserApi.deactivate(row.id);
    ElMessage.success('已停用');
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '停用失败');
  } finally {
    statusChangingId.value = '';
  }
}

async function onDelete(row: AdminUserRow) {
  if (!canDeleteUser(row)) return;
  try {
    await ElMessageBox.confirm(
      h('span', null, [
        '删除“',
        h('span', { style: { color: '#2563eb', fontWeight: 600 } }, row.name),
        '”后账号不可恢复，确认删除？',
      ]),
      '删除用户',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        confirmButtonClass: 'el-button--danger',
      },
    );
  } catch {
    return;
  }
  deletingId.value = row.id;
  try {
    await adminUserApi.remove(row.id);
    ElMessage.success('用户已删除');
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败');
  } finally {
    deletingId.value = '';
  }
}

onMounted(() => {
  void loadEnterprises();
  void loadRoles();
  void load();
});

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer);
  requestSequence += 1;
});
</script>

<style scoped>
.user-page {
  background: #fff;
  min-height: calc(100vh - 120px);
  padding: 18px;
}

.page-alert {
  margin-bottom: 12px;
}

.user-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  overflow-x: auto;
}

.user-search-wrap {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 10px;
  min-width: 0;
}

.user-search,
.user-search-keyword,
.role-filter,
.status-filter,
.enterprise-filter {
  flex: 0 0 auto;
  min-width: 0;
  width: 160px;
}

.user-search-keyword {
  width: 210px;
}

.role-filter,
.status-filter {
  width: 135px;
}

.enterprise-filter {
  width: 190px;
}

.toolbar-button {
  flex: 0 0 auto;
  margin-left: 0;
}

.toolbar-button + .toolbar-button {
  margin-left: 0;
}

.user-actions {
  display: flex;
  flex: 0 0 auto;
  margin-left: auto;
}

.user-table {
  margin-top: 20px;
  width: 100%;
}

.form-hint {
  color: #98a2b3;
  font-size: 12px;
  line-height: 1.6;
  margin-top: 4px;
}

.form-hint-block {
  margin: 0 0 4px 96px;
}

.muted {
  color: #98a2b3;
}

.subject-label,
.identity-tag {
  align-items: center;
  display: inline-flex;
  gap: 7px;
}

.role-tags {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.subject-label + .subject-label {
  margin-left: 10px;
}

.field-hint {
  color: #98a2b3;
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
}

.visual-dot {
  border-radius: 50%;
  flex: 0 0 7px;
  height: 7px;
  width: 7px;
}

.operation-buttons {
  align-items: center;
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  justify-content: center;
  white-space: nowrap;
}

.operation-buttons :deep(.el-button + .el-button) {
  margin-left: 0;
}

.operation-buttons :deep(.el-button) {
  margin: 0;
  min-height: 28px;
  padding: 4px 6px;
}

.user-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

:deep(.user-table-header) {
  background: #f8fafc !important;
  color: #333946;
  font-size: 13px;
  font-weight: 600;
}

:deep(.el-table__body td),
:deep(.el-table__body .cell),
:deep(.el-table__body .el-button.is-text) {
  font-size: 13px;
}

@media (max-width: 768px) {
  .user-toolbar {
    align-items: stretch;
    flex-direction: column;
    overflow-x: visible;
  }

  .user-search-wrap {
    flex-direction: column;
    width: 100%;
  }

  .user-search,
  .user-search-keyword,
  .role-filter,
  .status-filter,
  .enterprise-filter,
  .toolbar-button {
    width: 100%;
  }

  .user-actions {
    margin-left: 0;
    width: 100%;
  }

  .user-actions .el-button {
    width: 100%;
  }

  .user-pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>

<!-- 弹窗渲染在 body（teleport）下，scoped 样式无法命中弹窗结构节点，这里用全局样式（同 AdminRoles） -->
<style>
/* 弹窗统一风格：方角、细分隔线、13px 正文 */
.user-dialog {
  border-radius: 0;
  max-width: calc(100vw - 32px);
}

.user-dialog .el-dialog__header {
  border-bottom: 1px solid #dfe5ef;
  margin-right: 0;
  padding: 18px 24px;
}

.user-dialog .el-dialog__title {
  color: #333946;
  font-size: 16px;
  font-weight: 600;
}

.user-dialog .el-dialog__headerbtn {
  height: 52px;
  width: 52px;
}

.user-dialog .el-dialog__body {
  color: #333946;
  font-size: 13px;
  padding: 22px 24px 6px;
}

.user-dialog .el-dialog__footer {
  border-top: 1px solid #dfe5ef;
  padding: 14px 24px;
}

.user-dialog .el-dialog__footer .el-button + .el-button {
  margin-left: 8px;
}

.user-dialog .el-form-item {
  margin-bottom: 18px;
}

.user-dialog .el-form-item__label {
  color: #667085;
  font-weight: 400;
}

.user-dialog .el-descriptions__label {
  background: #f8fafc;
  color: #667085;
  font-weight: 400;
  text-align: right;
  width: 96px;
}

.user-dialog .el-descriptions__content {
  color: #333946;
}

.user-dialog .el-descriptions__cell {
  padding: 10px 14px;
}

@media (max-width: 768px) {
  .user-dialog {
    width: calc(100vw - 32px) !important;
  }
}
</style>
