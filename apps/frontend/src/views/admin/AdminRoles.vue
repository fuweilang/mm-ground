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
      <div class="role-search-wrap">
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
      </div>
      <el-button class="toolbar-button" type="primary" :loading="loading" @click="onSearchNow">
        搜索
      </el-button>
      <el-button class="toolbar-button" @click="onReset">
        重置
      </el-button>
    </div>

    <el-table
      :data="pagedRows"
      border
      class="role-table"
      header-cell-class-name="role-table-header"
    >
      <el-table-column label="角色" min-width="180">
        <template #default="{ row }">
          <el-tag class="identity-tag" size="small" :style="roleTagStyle(row.key)">
            <span class="visual-dot" :style="{ backgroundColor: roleColor(row.key) }" />
            {{ row.name }}
          </el-tag>
          <el-tag v-if="row.builtIn" size="small" type="info" class="sys-tag">系统</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="key" label="Key" width="150" show-overflow-tooltip />
      <el-table-column label="范围" width="120">
        <template #default="{ row }">
          {{ row.scope === 'PLATFORM' ? '平台' : '企业预设' }}
        </template>
      </el-table-column>
      <el-table-column label="权限数" width="90" align="center">
        <template #default="{ row }">
          {{ row.permissions.length }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
      <el-table-column label="操作" width="120" fixed="right" align="center">
        <template #default="{ row }">
          <el-button text type="primary" @click="openEditor(row)">
            {{ canWrite && row.scope === 'PLATFORM' && !row.permissionsLocked ? '编辑' : '查看' }}
          </el-button>
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
      :title="editing ? `${editing.name}（${editing.key}）` : '角色'"
      size="560px"
      destroy-on-close
    >
      <template v-if="editing">
        <el-alert
          v-if="editing.permissionsLocked"
          type="info"
          :closable="false"
          show-icon
          title="超级管理员权限固定为 Catalog 全量，只读。"
          class="drawer-alert"
        />
        <el-form label-position="top">
          <el-form-item label="显示名">
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
          <div class="chip-group-label">{{ group.labelZh }}</div>
          <div class="chip-wrap">
            <button
              v-for="item in group.items"
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
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Search } from 'lucide-vue-next';
import {
  adminPermissionApi,
  adminRoleApi,
  type AdminRoleRow,
  type PermissionCatalogGroup,
} from '../../api/admin';
import { useAuthStore } from '../../stores/auth';

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#7c3aed',
  platform_admin: '#1d4ed8',
  org_owner: '#c2410c',
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

const canEditPerms = computed(() => {
  if (!editing.value) return false;
  if (!canWrite.value) return false;
  if (editing.value.permissionsLocked) return false;
  return editing.value.scope === 'PLATFORM' && editing.value.editable;
});

const canEditMeta = computed(() => {
  if (!editing.value) return false;
  if (!canWrite.value) return false;
  return editing.value.scope === 'PLATFORM' && (editing.value.editable || editing.value.key === 'super_admin');
});

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

function openEditor(row: AdminRoleRow) {
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
  if (!editing.value) return;
  if (!canEditPerms.value && !canEditMeta.value) return;
  saving.value = true;
  try {
    const body: { name?: string; description?: string | null; permissions?: string[] } = {};
    if (canEditMeta.value) {
      body.name = editName.value.trim();
      body.description = editDescription.value.trim() || null;
    }
    if (canEditPerms.value) {
      body.permissions = [...selected.value].sort();
    }
    const updated = await adminRoleApi.update(editing.value.id, body);
    const idx = rows.value.findIndex((r) => r.id === updated.id);
    if (idx >= 0) rows.value[idx] = updated;
    editing.value = updated;
    selected.value = new Set(updated.permissions);
    ElMessage.success('已保存');
    drawerOpen.value = false;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    saving.value = false;
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
  gap: 10px;
  overflow-x: auto;
}

.role-search-wrap {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 10px;
  min-width: 0;
}

.role-search {
  flex: 0 0 auto;
  min-width: 0;
  width: 210px;
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

.sys-tag {
  margin-left: 8px;
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
  color: #64748b;
  font-size: 12px;
  margin-bottom: 8px;
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

  .role-search-wrap {
    flex-direction: column;
    width: 100%;
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
