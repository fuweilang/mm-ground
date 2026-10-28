<template>
  <section class="role-page" v-loading="loading">
    <el-alert
      v-if="errorText"
      class="role-alert"
      type="error"
      show-icon
      :closable="false"
      :title="errorText"
    >
      <template #default>
        <el-button text type="primary" @click="reload">重试</el-button>
      </template>
    </el-alert>

    <div class="role-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="keywordDraft"
          class="role-search"
          clearable
          placeholder="搜索角色名"
          :prefix-icon="Search"
          @clear="onSearchNow"
          @input="onSearchInput"
          @keyup.enter="onSearchNow"
        />
        <el-button class="toolbar-button" type="primary" :loading="loading" @click="onSearchNow">
          搜索
        </el-button>
        <el-button class="toolbar-button" @click="onReset">
          重置
        </el-button>
      </div>
      <div class="toolbar-right">
        <el-tooltip
          content="当前账号没有 portal.admin.roles.write，不能新建角色"
          placement="top"
          :disabled="canWrite"
        >
          <span>
            <el-button class="toolbar-button" type="primary" :disabled="!canWrite" @click="openCreator">
              新建角色
            </el-button>
          </span>
        </el-tooltip>
      </div>
    </div>

    <el-table
      :data="pagedRows"
      border
      class="role-table"
      header-cell-class-name="role-table-header"
    >
      <el-table-column label="角色" min-width="150">
        <template #default="{ row }">
          <el-tag class="identity-tag" size="small" :style="roleTagStyle(row.key)">
            <span class="visual-dot" :style="{ backgroundColor: roleColor(row.key) }" />
            {{ row.name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="110" align="center">
        <template #default="{ row }">
          <el-tag
            size="small"
            effect="light"
            :type="row.builtIn ? 'info' : 'primary'"
          >
            {{ row.builtIn ? '系统内置' : '自定义' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="key" label="Key" width="150" show-overflow-tooltip />
      <el-table-column label="范围" width="100">
        <template #default="{ row }">
          {{ row.scope === 'PLATFORM' ? '平台' : '企业预设' }}
        </template>
      </el-table-column>
      <el-table-column label="权限数" width="90" align="center">
        <template #default="{ row }">
          {{ row.permissions.length }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="说明" min-width="300" show-overflow-tooltip />
      <el-table-column label="操作" width="210" fixed="right" align="center">
        <template #default="{ row }">
          <div class="operation-buttons">
            <el-button text type="primary" @click="openViewer(row)">
              查看
            </el-button>
            <el-tooltip :content="editHint(row)" placement="top" :disabled="!editHint(row)">
              <span>
                <el-button text type="primary" :disabled="!canEditRow(row)" @click="openEditor(row)">
                  编辑
                </el-button>
              </span>
            </el-tooltip>
            <el-tooltip :content="deleteHint(row)" placement="top" :disabled="!deleteHint(row)">
              <span>
                <el-button
                  text
                  type="danger"
                  :disabled="!canDeleteRow(row)"
                  @click="onDelete(row)"
                >
                  删除
                </el-button>
              </span>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="emptyText" />
      </template>
    </el-table>

    <div class="role-pagination">
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

    <el-drawer
      v-model="drawerOpen"
      :title="drawerTitle"
      class="role-drawer"
      size="760px"
      destroy-on-close
    >
      <template v-if="editing || isCreating">
        <el-alert
          v-if="editing?.scope === 'ORG_PRESET'"
          type="warning"
          :closable="false"
          show-icon
          title="企业预设角色：修改后会影响所有企业中使用该角色的成员。"
          class="drawer-alert"
        />
        <el-alert
          v-if="editing?.permissionsLocked"
          type="info"
          :closable="false"
          show-icon
          title="超级管理员权限固定为 Catalog 全量，只读。"
          class="drawer-alert"
        />
        <el-form label-position="top">
          <el-form-item label="显示名" required>
            <el-input
              v-model="editName"
              maxlength="40"
              :disabled="!canEditMeta"
            />
          </el-form-item>
          <el-form-item label="说明">
            <el-input
              v-model="editDescription"
              type="textarea"
              :rows="2"
              maxlength="200"
              :disabled="!canEditMeta"
            />
          </el-form-item>
        </el-form>

        <div class="chip-section-title">权限包</div>
        <div
          v-for="group in catalog"
          :key="group.category"
          class="chip-group"
        >
          <div class="chip-group-label">
            <span>{{ group.labelZh }}</span>
            <span class="chip-group-count">{{ groupSelectedCount(group) }}</span>
          </div>
          <div
            v-for="(page, pageIndex) in groupPages(group)"
            :key="`${group.category}-${page.page || 'flat'}-${pageIndex}`"
            class="chip-page"
          >
            <div
              v-if="page.pageZh"
              class="chip-page-label"
            >
              <span>{{ page.pageZh }}</span>
              <span class="chip-group-count">{{ pageSelectedCount(page) }}</span>
            </div>
            <div class="chip-wrap">
              <button
                v-for="item in page.items"
                :key="item.key"
                type="button"
                class="perm-chip"
                :class="{ active: selected.has(item.key), locked: !canEditPerms }"
                :disabled="!canEditPerms"
                :title="item.labelEn"
                @click="togglePerm(item.key)"
              >
                {{ item.labelZh }}
              </button>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="drawer-footer">
          <el-button @click="drawerOpen = false">关闭</el-button>
          <el-button
            v-if="canEditPerms || canEditMeta"
            type="primary"
            :loading="saving"
            @click="onSave"
          >
            保存
          </el-button>
        </div>
      </template>
    </el-drawer>

    <el-dialog
      v-model="viewOpen"
      :title="viewing ? `查看角色 · ${viewing.name}` : '查看角色'"
      class="role-dialog"
      width="640px"
      align-center
    >
      <template v-if="viewing">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="Key">
            {{ viewing.key }}
          </el-descriptions-item>
          <el-descriptions-item label="范围">
            {{ viewing.scope === 'PLATFORM' ? '平台' : '企业预设' }}
          </el-descriptions-item>
          <el-descriptions-item label="权限数">
            {{ viewing.permissions.length }}
          </el-descriptions-item>
          <el-descriptions-item label="关联用户">
            {{ viewing.userCount }}
          </el-descriptions-item>
          <el-descriptions-item label="说明" :span="2">
            {{ viewing.description || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="chip-section-title">权限包</div>
        <div
          v-for="group in viewGroups"
          :key="group.category"
          class="chip-group"
        >
          <div class="chip-group-label">
            <span>{{ group.labelZh }}</span>
            <span class="chip-group-count">{{ group.pages.flatMap((p) => p.items).length }} 项</span>
          </div>
          <div
            v-for="(page, pageIndex) in group.pages"
            :key="`view-${group.category}-${page.page || 'flat'}-${pageIndex}`"
            class="chip-page"
          >
            <div
              v-if="page.pageZh"
              class="chip-page-label"
            >
              <span>{{ page.pageZh }}</span>
              <span class="chip-group-count">{{ page.items.length }} 项</span>
            </div>
            <div class="chip-wrap">
              <span
                v-for="item in page.items"
                :key="item.key"
                class="perm-chip perm-chip-readonly"
                :title="item.labelEn"
              >
                {{ item.labelZh }}
              </span>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="viewOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search } from 'lucide-vue-next';
import {
  adminPermissionApi,
  adminRoleApi,
  type AdminRoleRow,
  type PermissionCatalogGroup,
  type PermissionCatalogPage,
} from '../../api/admin';
import { useAuthStore } from '../../stores/auth';

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#7c3aed',
  platform_admin: '#1d4ed8',
  org_admin: '#0891b2',
  org_member: '#15803d',
};

const auth = useAuthStore();
const rows = ref<AdminRoleRow[]>([]);
const catalog = ref<PermissionCatalogGroup[]>([]);
const loading = ref(false);
const saving = ref(false);
const errorText = ref('');
const keywordDraft = ref('');
const keyword = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
let searchTimer = 0;

const drawerOpen = ref(false);
const drawerMode = ref<'create' | 'edit'>('edit');
const viewOpen = ref(false);
const viewing = ref<AdminRoleRow | null>(null);
const editing = ref<AdminRoleRow | null>(null);
const editName = ref('');
const editDescription = ref('');
const selected = ref<Set<string>>(new Set());

const canWrite = computed(() => {
  const perms = auth.session?.effectivePermissions;
  if (Array.isArray(perms) && perms.includes('portal.admin.roles.write')) return true;
  return auth.session?.platformRoleKey === 'super_admin'
    || auth.session?.user.platformRoleKey === 'super_admin';
});

const isCreating = computed(() => drawerMode.value === 'create');

const drawerTitle = computed(() => {
  if (isCreating.value) return '新建角色';
  return editing.value ? `${editing.value.name}（${editing.value.key}）` : '角色';
});

const canEditPerms = computed(() => {
  if (!canWrite.value) return false;
  if (isCreating.value) return true;
  if (!editing.value) return false;
  return editing.value.key !== 'super_admin';
});

const canEditMeta = computed(() => {
  if (!canWrite.value) return false;
  if (isCreating.value) return true;
  if (!editing.value) return false;
  return editing.value.key !== 'super_admin';
});

/** 操作列：有权写 + 行可编辑；super_admin 行仅改名称/说明。 */
/** 操作列：除超级管理员外，所有角色都可编辑。 */
function canEditRow(row: AdminRoleRow) {
  if (!canWrite.value) return false;
  return row.key !== 'super_admin';
}

function editHint(row: AdminRoleRow) {
  if (!canWrite.value) return '当前账号没有 portal.admin.roles.write，只能查看';
  if (row.key === 'super_admin') return '超级管理员拥有全部权限，不可编辑';
  return '';
}

function canDeleteRow(row: AdminRoleRow) {
  if (!canWrite.value) return false;
  return !row.builtIn && row.userCount === 0;
}

function deleteHint(row: AdminRoleRow) {
  if (!canWrite.value) return '当前账号没有 portal.admin.roles.write，不能删除';
  if (row.builtIn) return '系统内置角色不可删除';
  if (row.userCount > 0) return `还有 ${row.userCount} 个用户使用该角色，需先解绑`;
  return '';
}

const hasActiveFilters = computed(() => Boolean(keyword.value));
const emptyText = computed(() => (hasActiveFilters.value ? '没有符合条件的角色' : '暂无角色'));

const filteredRows = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((row) =>
    row.name.toLowerCase().includes(q)
    || row.key.toLowerCase().includes(q)
    || (row.description || '').toLowerCase().includes(q),
  );
});

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

function groupPages(group: PermissionCatalogGroup): PermissionCatalogPage[] {
  if (group.pages?.length) return group.pages;
  return [{ page: null, pageZh: '', pageEn: '', items: group.items }];
}

const viewSelected = computed(() => new Set(viewing.value?.permissions ?? []));

const viewGroups = computed(() => {
  const granted = viewSelected.value;
  return catalog.value
    .map((group) => ({
      ...group,
      pages: groupPages(group)
        .map((page) => ({ ...page, items: page.items.filter((item) => granted.has(item.key)) }))
        .filter((page) => page.items.length > 0),
    }))
    .filter((group) => group.pages.length > 0);
});

function pageSelectedCount(page: PermissionCatalogPage, set: Set<string> = selected.value) {
  const on = page.items.filter((item) => set.has(item.key)).length;
  return `${on}/${page.items.length}`;
}

function groupSelectedCount(group: PermissionCatalogGroup, set: Set<string> = selected.value) {
  const items = groupPages(group).flatMap((page) => page.items);
  const on = items.filter((item) => set.has(item.key)).length;
  return `${on}/${items.length}`;
}

function roleColor(key: string) {
  return ROLE_COLORS[key] || '#64748b';
}

function roleTagStyle(key: string) {
  const color = roleColor(key);
  return {
    backgroundColor: `${color}14`,
    borderColor: color,
    color,
  };
}

async function reload() {
  loading.value = true;
  errorText.value = '';
  try {
    const [roleList, cat] = await Promise.all([
      adminRoleApi.list({ keyword: keyword.value || undefined }),
      adminPermissionApi.catalog(),
    ]);
    rows.value = roleList;
    catalog.value = cat.categories;
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

function openViewer(row: AdminRoleRow) {
  viewing.value = row;
  viewOpen.value = true;
}

function openCreator() {
  drawerMode.value = 'create';
  editing.value = null;
  editName.value = '';
  editDescription.value = '';
  selected.value = new Set();
  drawerOpen.value = true;
}

function openEditor(row: AdminRoleRow) {
  drawerMode.value = 'edit';
  editing.value = row;
  editName.value = row.name;
  editDescription.value = row.description || '';
  selected.value = new Set(row.permissions);
  drawerOpen.value = true;
}

function togglePerm(key: string) {
  if (!canEditPerms.value) return;
  const next = new Set(selected.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selected.value = next;
}

async function onSave() {
  if (!isCreating.value && !editing.value) return;
  if (!canEditPerms.value && !canEditMeta.value) return;
  const name = editName.value.trim();
  if (!name) {
    ElMessage.warning('请填写角色名称');
    return;
  }
  saving.value = true;
  try {
    if (isCreating.value) {
      const created = await adminRoleApi.create({
        name,
        description: editDescription.value.trim() || null,
        permissions: [...selected.value].sort(),
      });
      rows.value = [...rows.value, created];
      drawerOpen.value = false;
      ElMessage.success('角色已创建，权限将在用户下次登录后生效');
      return;
    }
    const target = editing.value;
    if (!target) return;
    const body: { name?: string; description?: string | null; permissions?: string[] } = {};
    if (canEditMeta.value) {
      body.name = editName.value.trim();
      body.description = editDescription.value.trim() || null;
    }
    if (canEditPerms.value) {
      body.permissions = [...selected.value].sort();
    }
    const updated = await adminRoleApi.update(target.id, body);
    const idx = rows.value.findIndex((r) => r.id === updated.id);
    if (idx >= 0) rows.value[idx] = updated;
    editing.value = updated;
    selected.value = new Set(updated.permissions);
    ElMessage.success('已保存，权限变更将在相关用户下次登录后生效');
    drawerOpen.value = false;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: AdminRoleRow) {
  try {
    await ElMessageBox.confirm(
      `删除后不可恢复，确定删除角色「${row.name}」？`,
      '删除角色',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  try {
    await adminRoleApi.remove(row.id);
    rows.value = rows.value.filter((item) => item.id !== row.id);
    if (editing.value?.id === row.id) drawerOpen.value = false;
    ElMessage.success('角色已删除');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败');
  }
}

function resetPage() {
  currentPage.value = 1;
}

function onSearchInput() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(onSearchNow, 350);
}

function onSearchNow() {
  window.clearTimeout(searchTimer);
  keyword.value = keywordDraft.value.trim();
  resetPage();
  void reload();
}

function onReset() {
  window.clearTimeout(searchTimer);
  keywordDraft.value = '';
  keyword.value = '';
  resetPage();
  void reload();
}

function onPageChange(page: number) {
  currentPage.value = page;
}

function onPageSizeChange(size: number) {
  pageSize.value = size;
  resetPage();
}

onMounted(() => {
  void reload();
});

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer);
});
</script>

<style scoped>
.role-page {
  background: #fff;
  min-height: calc(100vh - 120px);
  padding: 18px;
}

.role-alert {
  margin-bottom: 12px;
}

.role-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: nowrap;
  gap: 16px;
  justify-content: space-between;
}

.toolbar-left,
.toolbar-right {
  align-items: center;
  display: flex;
  gap: 10px;
  min-width: 0;
}

.toolbar-left {
  flex: 1 1 auto;
}

.toolbar-right {
  flex: 0 0 auto;
}

.role-search {
  flex: 0 0 auto;
  min-width: 0;
  width: 240px;
}

.toolbar-button {
  flex: 0 0 auto;
  margin-left: 0;
}

.role-table {
  margin-top: 20px;
  width: 100%;
}

.identity-tag {
  align-items: center;
  display: inline-flex;
  gap: 7px;
}


.visual-dot {
  border-radius: 50%;
  flex: 0 0 7px;
  height: 7px;
  width: 7px;
}

.role-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.drawer-alert {
  margin-bottom: 14px;
}

.chip-section-title {
  color: #333946;
  font-size: 13px;
  font-weight: 600;
  margin: 8px 0 12px;
}

.chip-group {
  margin-bottom: 16px;
}

.chip-group-label {
  align-items: center;
  color: #64748b;
  display: flex;
  font-size: 12px;
  font-weight: 600;
  gap: 8px;
  margin-bottom: 8px;
}

.chip-group-count {
  color: #94a3b8;
  font-weight: 500;
}

.chip-page {
  margin-bottom: 10px;
}

.chip-page:last-child {
  margin-bottom: 0;
}

.chip-page-label {
  align-items: center;
  color: #475569;
  display: flex;
  font-size: 12px;
  font-weight: 600;
  gap: 8px;
  margin: 0 0 6px;
}

.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.perm-chip {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #334155;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.2;
  padding: 6px 12px;
}

.perm-chip.active {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1d4ed8;
  font-weight: 600;
}

.perm-chip.locked {
  cursor: default;
  opacity: 0.85;
}

.perm-chip:disabled {
  cursor: default;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.operation-buttons {
  align-items: center;
  display: flex;
  gap: 4px;
  justify-content: center;
  white-space: nowrap;
}

.operation-buttons :deep(.el-button + .el-button) {
  margin-left: 0;
}


:deep(.role-table-header) {
  background: #f8fafc !important;
  color: #333946;
  font-size: 13px;
  font-weight: 600;
}

:deep(.el-table__body td),
:deep(.el-table__body .cell) {
  font-size: 13px;
}

@media (max-width: 768px) {
  .role-toolbar {
    align-items: stretch;
    flex-direction: column;
    overflow-x: visible;
  }

  .toolbar-left,
  .toolbar-right {
    flex-direction: column;
    width: 100%;
  }

  .role-toolbar {
    align-items: stretch;
  }

  .role-search,
  .toolbar-button {
    width: 100%;
  }

  .role-pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>

<!-- 查看弹窗渲染在 body（teleport）下，作用域样式无法命中根节点，这里用全局样式 -->
<style>
.role-dialog {
  display: flex;
  flex-direction: column;
  margin: auto;
  max-height: calc(100vh - 64px);
  max-width: calc(100vw - 32px);
  padding: 0;
}

.role-dialog .el-dialog__header {
  border-bottom: 1px solid #dfe5ef;
  margin-right: 0;
  padding: 18px 24px;
}

.role-dialog .el-dialog__title {
  color: #333946;
  font-size: 16px;
  font-weight: 600;
}

.role-dialog .el-dialog__body {
  color: #333946;
  flex: 1;
  font-size: 13px;
  min-height: 0;
  overflow-y: auto;
  padding: 22px 24px 8px;
}

.role-dialog .el-dialog__footer {
  border-top: 1px solid #dfe5ef;
  padding: 14px 24px;
}

.role-dialog .el-descriptions__label {
  background: #f8fafc;
  color: #667085;
  font-weight: 400;
  width: 96px;
}

.role-dialog .el-descriptions__cell {
  padding: 10px 14px;
}

.role-dialog .chip-section-title {
  margin-top: 18px;
}

@media (max-width: 768px) {
  .role-dialog {
    width: calc(100vw - 32px) !important;
  }
}
</style>
