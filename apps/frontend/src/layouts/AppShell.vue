<template>
  <main class="app-shell" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
    <aside class="sidebar">
      <div class="brand-row">
        <RouterLink class="brand" :to="homePath" :title="appVersion ? `猛犸中台 · v${appVersion}` : '猛犸中台'">
          <span class="brand-logo">
            <img class="brand-logo-mark" src="/logo-icon.png" alt="猛犸中台" />
            <span class="brand-logo-rest">猛犸中台</span>
          </span>
        </RouterLink>
        <el-dropdown trigger="click" popper-class="product-switch-menu" @command="onSwitchProduct">
          <button class="product-switch" type="button" title="切换产品 · 当前：猛犸中台">
            <Building2 class="product-switch-icon" />
            <ChevronDown class="product-switch-caret" />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="console" class="product-switch-current">
                <Check class="dropdown-icon" />猛犸中台
              </el-dropdown-item>
              <el-dropdown-item
                command="agent"
                :disabled="!canOpenAgent"
                :title="canOpenAgent ? '' : '当前账号还没有企业工作区'"
              >
                <MessageSquare class="dropdown-icon" />猛犸智能体
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :class="{ active: isActive(item.path) }"
          :to="item.path"
          :title="item.label"
        >
          <component :is="item.icon" class="nav-icon" />
          <span class="nav-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <a class="chat-jump" href="/agent/chat" target="_blank" rel="noopener noreferrer" title="猛犸智能体 · 新标签页打开">
          <MessageSquare class="chat-jump-icon" />
          <span class="chat-jump-label">猛犸智能体</span>
          <ArrowUpRight class="chat-jump-arrow" />
        </a>
        <button
          class="sidebar-collapse"
          type="button"
          :title="isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="isSidebarCollapsed = !isSidebarCollapsed"
        >
          <ChevronLeft class="collapse-icon" />
          <span class="collapse-label">{{ isSidebarCollapsed ? '展开' : '收起' }}</span>
        </button>
      </div>
    </aside>

    <section class="main-area">
      <WorkbenchBanner v-if="!isPlatformArea" />
      <header class="navbar">
        <div class="navbar-leading">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>{{ areaLabel }}</el-breadcrumb-item>
            <el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="navbar-actions">
          <ClientDownloadLink />
          <TenantSwitcher v-if="!isPlatformArea" />
          <el-dropdown trigger="click" popper-class="user-dropdown">
            <span class="user-menu">
              <span class="user-avatar">{{ avatar }}</span>
              <span class="username">{{ session?.user.name }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  <span class="user-menu-identity">
                    <span class="user-menu-name">{{ session?.user.name }}</span>
                    <span class="user-menu-tenant">
                      {{ session?.currentTenant?.name || '猛犸中台' }}
                    </span>
                  </span>
                </el-dropdown-item>
                <el-dropdown-item divided @click="goSettings">
                  <Settings class="dropdown-icon" />
                  企业设置
                </el-dropdown-item>
                <el-dropdown-item @click="openClientDownload">
                  <Download class="dropdown-icon" />
                  下载客户端
                </el-dropdown-item>
                <el-dropdown-item divided @click="onLogout">
                  <LogOut class="dropdown-icon" />
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <section class="workspace">
        <router-view />
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  ArrowUpRight,
  BarChart3,
  Bot,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  Download,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Shield,
  Users,
} from 'lucide-vue-next';
import { canAccessConsole } from '@mammoth/shared';
import { useAuthStore } from '../stores/auth';
import { openClientDownload } from '../stores/clientDownload';
import { clearOctopSession } from '../utils/session';
import { useResponsiveSidebar } from './useResponsiveSidebar';
import { fetchAppVersion } from '../api/version';
import WorkbenchBanner from './WorkbenchBanner.vue';
import ClientDownloadLink from '../components/ClientDownloadLink.vue';
import TenantSwitcher from '../components/TenantSwitcher.vue';

/** 总后台只出平台菜单；企业控制台只出业务菜单。进企业走「进入工作台」。 */
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { isSidebarCollapsed } = useResponsiveSidebar();
const session = computed(() => auth.session);

/** 版本号只读 /console/api/version（同源于 config/version.json）。 */
const appVersion = ref('');
onMounted(async () => {
  try {
    appVersion.value = (await fetchAppVersion()).version;
  } catch {
    // 版本号是装饰信息，取不到就留空，不打断页面。
  }
});

const pageTitle = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : '工作台'));
const avatar = computed(() => (session.value?.user.name || '猛').slice(0, 1));
const isPlatformArea = computed(() => route.path.startsWith('/admin'));
const areaLabel = computed(() => (isPlatformArea.value ? '总后台' : '企业控制台'));
const homePath = computed(() => (session.value?.user.isPlatformAdmin ? '/admin' : '/console/'));

/** 没有企业工作区的账号切过去只会 403，先禁用。 */
const canOpenAgent = computed(() => canAccessConsole(session.value));

function onSwitchProduct(command: string) {
  if (command === 'agent' && canOpenAgent.value) {
    window.location.href = '/agent/chat';
  }
}

const businessItems = [
  { path: '/console/', label: '工作台', icon: LayoutDashboard },
  { path: '/console/agents', label: '智能体', icon: Bot },
  { path: '/console/knowledge', label: '知识库', icon: FolderOpen },
  { path: '/console/members', label: '成员', icon: Users },
  { path: '/console/usage', label: '用量与审计', icon: BarChart3 },
  { path: '/console/settings', label: '企业设置', icon: Settings },
];

const platformItems = [
  { path: '/admin', label: '概况', icon: LayoutDashboard },
  { path: '/admin/users', label: '用户管理', icon: Users },
  { path: '/admin/roles', label: '角色管理', icon: Shield },
  { path: '/admin/enterprises', label: '企业管理', icon: Building2 },
];

const navItems = computed(() => (isPlatformArea.value ? platformItems : businessItems));

function isActive(path: string) {
  if (path === '/console/' || path === '/console') {
    return route.path === '/console' || route.path === '/console/';
  }
  if (path === '/admin') {
    return route.path === '/admin' || route.path === '/admin/';
  }
  return route.path === path || route.path.startsWith(`${path}/`);
}

function goSettings() {
  router.push(session.value?.user.isPlatformAdmin && !session.value.currentTenant ? '/admin' : '/console/settings');
}

async function onLogout() {
  // 先清 Octop 侧会话：clearOctopSession 走裸 fetch 不经 request()，Cookie 失效也不会被挂起；
  // 再清中台会话（auth.logout 内部已先同步 clear，不依赖请求落地），最后回登录页。
  await clearOctopSession();
  await auth.logout();
  // 跳转由 http.ts 401 分支兜底，此处 await 可能不落地，勿在其后追加逻辑。
  window.location.href = '/login';
}
</script>