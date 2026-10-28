<template>
  <div class="client-download-wrap" :class="`client-download-wrap--${variant}`">
    <button
      class="client-download"
      :class="`client-download--${variant}`"
      type="button"
      @click="openModal"
    >
      <Download class="client-download-icon" :stroke-width="1.8" />
      下载客户端
    </button>

    <el-dialog
      v-model="clientDownloadOpen"
      title="下载客户端"
      class="client-download-dialog"
      width="460px"
      append-to-body
      :close-on-click-modal="false"
      @closed="started = null"
    >
      <p class="client-download-tip">选择与你的电脑匹配的安装包。</p>
      <p v-if="meta" class="client-download-meta">{{ meta }}</p>

      <ul class="client-option-list">
        <template v-for="option in CLIENT_PLATFORM_OPTIONS" :key="option.id">
          <li class="client-option" @click="download(option.id)">
            <span class="client-option-icon" :class="`client-option-icon--${option.id}`">
              <!-- Apple 芯片 Mac -->
              <svg v-if="option.id === 'mac-arm64'" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"
                />
              </svg>
              <!-- Intel 芯片 Mac：芯片造型 -->
              <svg v-else-if="option.id === 'mac-x64'" viewBox="0 0 24 24" aria-hidden="true">
                <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                  <rect x="10" y="10" width="4" height="4" rx="1" />
                  <path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" />
                </g>
              </svg>
              <!-- Windows -->
              <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M3 5.6 10.6 4.5v6.9H3V5.6Zm0 12.8 7.6 1.1v-6.9H3v5.8ZM11.6 4.4 21 3.1v8.3h-9.4V4.4Zm0 8.4H21v8.3l-9.4-1.3v-7Z"
                />
              </svg>
            </span>

            <span class="client-option-text">
              <span class="client-option-title">
                {{ option.title }}
                <span v-if="option.id === currentOptionId" class="client-option-badge">当前系统</span>
              </span>
              <span class="client-option-sub">{{ option.sub }}</span>
            </span>

            <span class="client-option-action">
              <template v-if="started === option.id">
                <Check class="client-option-action-icon" :stroke-width="2" />
                已开始下载
                <button class="client-option-retry" type="button" @click.stop="download(option.id)">
                  重试
                </button>
              </template>
              <template v-else>
                <Download class="client-option-action-icon" :stroke-width="1.8" />
                下载
              </template>
            </span>
          </li>
          <!-- Mac 芯片指引：12px 辅助行，贴近两行 Mac 选项 -->
          <li v-if="option.id === 'mac-x64'" class="client-mac-hint">
            macOS 不确定芯片型号？点屏幕左上角的
            <AppleMiniIcon class="client-download-tip-icon" /> →「关于本机」即可看到。
          </li>
        </template>
      </ul>

      <template #footer>
        <el-button @click="clientDownloadOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, Download } from 'lucide-vue-next';
import AppleMiniIcon from './AppleMiniIcon.vue';
import {
  CLIENT_PLATFORM_OPTIONS,
  clientDownloadUrl,
  detectClientOs,
  fetchClientDownloadInfo,
  type ClientDownloadInfo,
  type ClientPlatform,
} from '../utils/clientDownload';
import { clientDownloadOpen } from '../stores/clientDownload';

withDefaults(defineProps<{ variant?: 'navbar' | 'login' }>(), { variant: 'navbar' });

const started = ref<ClientPlatform | null>(null);
const info = ref<ClientDownloadInfo | null>(null);
const clientOs = detectClientOs();

/** 只标记不会猜错的那种：Windows 只有一种安装包；Mac 需要用户自己看芯片。 */
const currentOptionId = computed<ClientPlatform | null>(() => (clientOs === 'win' ? 'win' : null));

const meta = computed(() => {
  if (!info.value) return '';
  return [
    `最新版本 v${info.value.version}`,
    info.value.date,
    info.value.sizeMb != null ? `约 ${info.value.sizeMb} MB` : '',
  ]
    .filter(Boolean)
    .join(' · ');
});

function openModal() {
  clientDownloadOpen.value = true;
  if (info.value) return;
  void fetchClientDownloadInfo().then((next) => {
    info.value = next;
  });
}

function download(platform: ClientPlatform) {
  started.value = platform;
  window.location.assign(clientDownloadUrl(platform));
}
</script>

<style scoped>
.client-download-wrap {
  display: inline-flex;
}

.client-download {
  align-items: center;
  background: transparent;
  border: 0;
  cursor: pointer;
  display: inline-flex;
  font-size: 13px;
  gap: 6px;
}

.client-download-icon {
  flex-shrink: 0;
  height: 16px;
  width: 16px;
}

/* 次级样式：把主色留给页面业务主操作 */
.client-download-wrap--navbar .client-download {
  background: transparent;
  color: #667085;
  font-weight: 400;
  height: 32px;
  padding: 0 10px;
}

.client-download-wrap--navbar .client-download:hover {
  background: #f5f8ff;
  color: #2563eb;
}

.client-download-wrap--login .client-download {
  color: #667085;
  justify-content: center;
  min-height: 32px;
  padding: 0;
}

.client-download-wrap--login .client-download:hover {
  color: #2563eb;
}
</style>

<style>
/* 弹窗 teleport 到 body，样式必须写在全局块 */
.client-download-dialog {
  border-radius: 0;
  max-width: calc(100vw - 32px);
}

.client-download-dialog .el-dialog__header {
  border-bottom: 1px solid #dfe5ef;
  margin-right: 0;
  padding: 18px 24px;
}

.client-download-dialog .el-dialog__title {
  color: #333946;
  font-size: 16px;
  font-weight: 600;
}

.client-download-dialog .el-dialog__headerbtn {
  height: 52px;
  width: 52px;
}

.client-download-dialog .el-dialog__body {
  color: #333946;
  font-size: 13px;
  padding: 18px 24px 22px;
}

.client-download-dialog .el-dialog__footer {
  border-top: 1px solid #dfe5ef;
  padding: 14px 24px;
}

.client-download-tip {
  color: #667085;
  font-size: 13px;
  line-height: 1.7;
  margin: 0 0 4px;
}

.client-download-meta {
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.6;
  margin: 0 0 14px;
}

.client-download-tip-icon {
  height: 12px;
  margin: 0 2px;
  vertical-align: -1px;
  width: 12px;
}

.client-option-list {
  border: 1px solid #dfe5ef;
  list-style: none;
  margin: 0;
  padding: 0;
}

.client-option-list > :last-child {
  border-bottom: 0;
}

.client-option {
  align-items: center;
  border-bottom: 1px solid #eef1f6;
  cursor: pointer;
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  transition: background-color 0.15s ease;
}

.client-option:hover {
  background: #f5f8ff;
}

.client-option-icon {
  align-items: center;
  border: 1px solid #e4e9f2;
  color: #667085;
  display: inline-flex;
  flex-shrink: 0;
  height: 38px;
  justify-content: center;
  width: 38px;
}

.client-option-icon svg {
  height: 20px;
  width: 20px;
}

.client-option-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.client-option-title {
  align-items: center;
  color: #333946;
  display: flex;
  font-size: 14px;
  font-weight: 600;
  gap: 8px;
}

.client-option-badge {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
  font-size: 11px;
  font-weight: 400;
  line-height: 18px;
  padding: 0 6px;
}

.client-option-sub {
  color: #667085;
  font-size: 12px;
}

.client-option-action {
  align-items: center;
  color: #667085;
  display: inline-flex;
  flex-shrink: 0;
  font-size: 13px;
  gap: 5px;
}

.client-option:hover .client-option-action {
  color: #2563eb;
}

.client-option-action-icon {
  height: 14px;
  width: 14px;
}

.client-option-retry {
  background: transparent;
  border: 0;
  color: #2563eb;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  text-decoration: underline;
}

/* Mac 芯片指引：12px 辅助行 */
.client-mac-hint {
  border-bottom: 1px solid #eef1f6;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.6;
  margin: -4px 0 0;
  padding: 0 16px 12px 68px;
}

@media (max-width: 768px) {
  .client-download-dialog {
    width: calc(100vw - 32px) !important;
  }

  .client-mac-hint {
    padding-left: 16px;
  }
}
</style>