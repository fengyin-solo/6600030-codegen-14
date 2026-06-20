<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useFEAStore } from '../store/fea';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const store = useFEAStore();
const copyStatus = ref<'idle' | 'success' | 'error'>('idle');
const activeTab = ref<'overview' | 'heatmap' | 'critical' | 'selected' | 'reactions'>('overview');

const report = computed(() => store.analysisReport);
const ms = computed(() => report.value.modelSummary);
const hc = computed(() => report.value.heatmapConclusion);

const distPct = computed(() => {
  if (!hc.value) return { low: 0, medium: 0, high: 0, critical: 0 };
  const total = hc.value.distribution.low + hc.value.distribution.medium + hc.value.distribution.high + hc.value.distribution.critical;
  if (total === 0) return { low: 0, medium: 0, high: 0, critical: 0 };
  return {
    low: (hc.value.distribution.low / total) * 100,
    medium: (hc.value.distribution.medium / total) * 100,
    high: (hc.value.distribution.high / total) * 100,
    critical: (hc.value.distribution.critical / total) * 100,
  };
});

function close() {
  emit('update:visible', false);
}

async function handleCopy() {
  copyStatus.value = 'idle';
  const success = await store.copyReportToClipboard();
  copyStatus.value = success ? 'success' : 'error';
  setTimeout(() => {
    copyStatus.value = 'idle';
  }, 2000);
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      activeTab.value = 'overview';
      copyStatus.value = 'idle';
    }
  }
);

const tabs = [
  { key: 'overview', label: '📋 模型概况' },
  { key: 'heatmap', label: '🌡 热力图结论' },
  { key: 'critical', label: '🔺 关键单元' },
  { key: 'selected', label: '🎯 选中详情' },
  { key: 'reactions', label: '⚖ 约束反力' },
] as const;
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="close"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="close" />

        <div class="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-purple-900/40 to-slate-900">
            <div>
              <h2 class="text-lg font-bold text-purple-300 flex items-center gap-2">
                <span>📊</span>
                分析报告导出
              </h2>
              <div class="text-xs text-slate-500 mt-0.5">
                {{ ms.presetDisplayName }} · {{ report.generatedAt.toLocaleString('zh-CN') }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="store.exportReportAsHtml()"
                class="px-3 py-1.5 text-xs font-medium bg-sky-700 hover:bg-sky-600 text-white rounded-lg transition flex items-center gap-1.5"
              >
                <span>🌐</span> 导出 HTML
              </button>
              <button
                @click="store.exportReportAsText()"
                class="px-3 py-1.5 text-xs font-medium bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition flex items-center gap-1.5"
              >
                <span>📄</span> 导出 TXT
              </button>
              <button
                @click="handleCopy"
                :class="[
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition flex items-center gap-1.5',
                  copyStatus === 'success'
                    ? 'bg-green-600 text-white'
                    : copyStatus === 'error'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                ]"
              >
                <span>{{ copyStatus === 'success' ? '✓' : copyStatus === 'error' ? '✗' : '📋' }}</span>
                {{ copyStatus === 'success' ? '已复制' : copyStatus === 'error' ? '复制失败' : '复制文本' }}
              </button>
              <button
                @click="store.printReport()"
                class="px-3 py-1.5 text-xs font-medium bg-amber-700 hover:bg-amber-600 text-white rounded-lg transition flex items-center gap-1.5"
              >
                <span>🖨</span> 打印
              </button>
              <button
                @click="close"
                class="ml-2 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Tab navigation -->
          <div class="flex gap-1 px-4 pt-3 border-b border-slate-800 bg-slate-900/50">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              @click="activeTab = tab.key"
              :class="[
                'px-4 py-2 text-xs font-medium rounded-t-lg transition border-b-2 -mb-px',
                activeTab === tab.key
                  ? 'text-purple-300 border-purple-500 bg-slate-800/50'
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/30'
              ]"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-6 bg-slate-950/50">
            <!-- Overview Tab -->
            <div v-show="activeTab === 'overview'" class="space-y-5">
              <div>
                <h3 class="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <span class="w-1 h-4 bg-purple-500 rounded"></span>
                  基本信息
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div class="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                    <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">模型类型</div>
                    <div class="text-xl font-bold text-purple-300">{{ ms.presetDisplayName }}</div>
                  </div>
                  <div class="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                    <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">节点 / 单元</div>
                    <div class="text-xl font-bold text-slate-200">
                      {{ ms.nodeCount }}<span class="text-sm text-slate-500 mx-1">/</span>{{ ms.elementCount }}
                    </div>
                  </div>
                  <div class="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                    <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">约束节点</div>
                    <div class="text-xl font-bold text-sky-400">{{ ms.fixedNodeCount }}</div>
                  </div>
                  <div class="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                    <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">荷载数 / 总荷载</div>
                    <div class="text-lg font-bold text-amber-400">
                      {{ ms.loadCount }}<span class="text-xs text-slate-500 mx-1">·</span>{{ (ms.totalLoadMagnitude / 1000).toFixed(1) }}kN
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <span class="w-1 h-4 bg-sky-500 rounded"></span>
                  几何与材料
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div class="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                    <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">几何尺寸</div>
                    <div class="text-lg font-bold text-slate-200">
                      {{ ms.modelDimensions.width.toFixed(2) }}<span class="text-xs text-slate-500 mx-0.5">m</span>
                      ×
                      {{ ms.modelDimensions.height.toFixed(2) }}<span class="text-xs text-slate-500 mx-0.5">m</span>
                    </div>
                  </div>
                  <div class="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                    <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">弹性模量范围</div>
                    <div class="text-lg font-bold text-slate-200">
                      {{ (ms.materialInfo.youngsModulusRange.min / 1e9).toFixed(0) }}
                      <span v-if="ms.materialInfo.youngsModulusRange.max !== ms.materialInfo.youngsModulusRange.min">
                        ~ {{ (ms.materialInfo.youngsModulusRange.max / 1e9).toFixed(0) }}
                      </span>
                      <span class="text-xs text-slate-500 ml-1">GPa</span>
                    </div>
                  </div>
                  <div class="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                    <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">截面面积范围</div>
                    <div class="text-lg font-bold text-slate-200">
                      {{ (ms.materialInfo.areaRange.min * 1e6).toFixed(0) }}
                      <span v-if="ms.materialInfo.areaRange.max !== ms.materialInfo.areaRange.min">
                        ~ {{ (ms.materialInfo.areaRange.max * 1e6).toFixed(0) }}
                      </span>
                      <span class="text-xs text-slate-500 ml-1">mm²</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <span class="w-1 h-4 bg-amber-500 rounded"></span>
                  整体性能指标
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div class="bg-gradient-to-br from-amber-900/40 to-slate-800/60 rounded-xl p-4 border border-amber-700/30">
                    <div class="text-[10px] text-amber-400/70 uppercase tracking-wider mb-1">最大位移</div>
                    <div class="text-2xl font-bold text-amber-300">
                      {{ (report.maxDisplacement * 1000).toFixed(3) }}
                      <span class="text-xs font-normal text-amber-500 ml-1">mm</span>
                    </div>
                  </div>
                  <div class="bg-gradient-to-br from-red-900/40 to-slate-800/60 rounded-xl p-4 border border-red-700/30">
                    <div class="text-[10px] text-red-400/70 uppercase tracking-wider mb-1">最大应力</div>
                    <div class="text-2xl font-bold text-red-300">
                      {{ hc ? hc.maxValue.toFixed(2) : '—' }}
                      <span class="text-xs font-normal text-red-500 ml-1">{{ hc?.unit || 'MPa' }}</span>
                    </div>
                  </div>
                  <div class="bg-gradient-to-br from-purple-900/40 to-slate-800/60 rounded-xl p-4 border border-purple-700/30">
                    <div class="text-[10px] text-purple-400/70 uppercase tracking-wider mb-1">平均{{ hc?.modeDisplayName || '应力' }}</div>
                    <div class="text-2xl font-bold text-purple-300">
                      {{ hc ? hc.avgValue.toFixed(2) : '—' }}
                      <span class="text-xs font-normal text-purple-500 ml-1">{{ hc?.unit || 'MPa' }}</span>
                    </div>
                  </div>
                  <div class="bg-gradient-to-br from-sky-900/40 to-slate-800/60 rounded-xl p-4 border border-sky-700/30">
                    <div class="text-[10px] text-sky-400/70 uppercase tracking-wider mb-1">中位{{ hc?.modeDisplayName || '应力' }}</div>
                    <div class="text-2xl font-bold text-sky-300">
                      {{ hc ? hc.medianValue.toFixed(2) : '—' }}
                      <span class="text-xs font-normal text-sky-500 ml-1">{{ hc?.unit || 'MPa' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Heatmap Tab -->
            <div v-show="activeTab === 'heatmap'" class="space-y-5">
              <div v-if="!hc" class="text-center py-12 text-slate-500">
                <div class="text-4xl mb-3">🔬</div>
                <div>尚未执行 FEA 求解，请先点击「求解 FEA」按钮</div>
              </div>

              <template v-else>
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <span class="w-1 h-4 bg-purple-500 rounded"></span>
                      {{ hc.modeDisplayName }} 统计
                      <span class="text-xs font-normal text-slate-500">(单位: {{ hc.unit }})</span>
                    </h3>
                  </div>
                  <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div class="bg-red-900/30 rounded-xl p-3 border border-red-700/30">
                      <div class="text-[10px] text-red-400 uppercase tracking-wider mb-1">最大值</div>
                      <div class="text-xl font-bold text-red-300">{{ hc.maxValue.toFixed(3) }}</div>
                    </div>
                    <div class="bg-sky-900/30 rounded-xl p-3 border border-sky-700/30">
                      <div class="text-[10px] text-sky-400 uppercase tracking-wider mb-1">最小值</div>
                      <div class="text-xl font-bold text-sky-300">{{ hc.minValue.toFixed(3) }}</div>
                    </div>
                    <div class="bg-purple-900/30 rounded-xl p-3 border border-purple-700/30">
                      <div class="text-[10px] text-purple-400 uppercase tracking-wider mb-1">平均值</div>
                      <div class="text-xl font-bold text-purple-300">{{ hc.avgValue.toFixed(3) }}</div>
                    </div>
                    <div class="bg-emerald-900/30 rounded-xl p-3 border border-emerald-700/30">
                      <div class="text-[10px] text-emerald-400 uppercase tracking-wider mb-1">中位值</div>
                      <div class="text-xl font-bold text-emerald-300">{{ hc.medianValue.toFixed(3) }}</div>
                    </div>
                    <div class="bg-amber-900/30 rounded-xl p-3 border border-amber-700/30">
                      <div class="text-[10px] text-amber-400 uppercase tracking-wider mb-1">标准差</div>
                      <div class="text-xl font-bold text-amber-300">{{ hc.stdDevValue.toFixed(3) }}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 class="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <span class="w-1 h-4 bg-sky-500 rounded"></span>
                    值分布
                  </h3>
                  <div class="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                    <div class="flex h-10 rounded-lg overflow-hidden gap-0.5 mb-3">
                      <div
                        class="bg-sky-400 flex items-center justify-center text-[10px] font-bold text-sky-900 transition-all"
                        :style="{ flex: distPct.low || 0.01 }"
                      >
                        {{ hc.distribution.low }}
                      </div>
                      <div
                        class="bg-emerald-400 flex items-center justify-center text-[10px] font-bold text-emerald-900 transition-all"
                        :style="{ flex: distPct.medium || 0.01 }"
                      >
                        {{ hc.distribution.medium }}
                      </div>
                      <div
                        class="bg-amber-400 flex items-center justify-center text-[10px] font-bold text-amber-900 transition-all"
                        :style="{ flex: distPct.high || 0.01 }"
                      >
                        {{ hc.distribution.high }}
                      </div>
                      <div
                        class="bg-red-500 flex items-center justify-center text-[10px] font-bold text-white transition-all"
                        :style="{ flex: distPct.critical || 0.01 }"
                      >
                        {{ hc.distribution.critical }}
                      </div>
                    </div>
                    <div class="grid grid-cols-4 gap-2 text-[10px]">
                      <div class="flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded bg-sky-400"></span>
                        <span class="text-slate-400">低区 (0-25%)</span>
                        <span class="ml-auto font-mono text-slate-300">{{ distPct.low.toFixed(1) }}%</span>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded bg-emerald-400"></span>
                        <span class="text-slate-400">中区 (25-50%)</span>
                        <span class="ml-auto font-mono text-slate-300">{{ distPct.medium.toFixed(1) }}%</span>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded bg-amber-400"></span>
                        <span class="text-slate-400">高区 (50-75%)</span>
                        <span class="ml-auto font-mono text-slate-300">{{ distPct.high.toFixed(1) }}%</span>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded bg-red-500"></span>
                        <span class="text-slate-400">危险区 (>75%)</span>
                        <span class="ml-auto font-mono text-slate-300">{{ distPct.critical.toFixed(1) }}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 class="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <span class="w-1 h-4 bg-emerald-500 rounded"></span>
                    📝 分析结论
                  </h3>
                  <div class="bg-gradient-to-br from-purple-900/20 to-slate-800/40 rounded-xl p-5 border border-purple-700/30">
                    <ol class="space-y-3">
                      <li
                        v-for="(c, i) in hc.conclusion"
                        :key="i"
                        class="flex gap-3 text-sm leading-relaxed text-slate-200"
                      >
                        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/40 border border-purple-500/40 flex items-center justify-center text-[11px] font-bold text-purple-300">
                          {{ i + 1 }}
                        </span>
                        <span>{{ c }}</span>
                      </li>
                    </ol>
                  </div>
                </div>
              </template>
            </div>

            <!-- Critical Tab -->
            <div v-show="activeTab === 'critical'" class="space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span class="w-1 h-4 bg-red-500 rounded"></span>
                  关键单元排名（Top 10）
                  <span class="text-xs font-normal text-slate-500">按当前{{ hc?.modeDisplayName || '应力' }}降序</span>
                </h3>
              </div>

              <div v-if="report.topCriticalElements.length === 0" class="text-center py-12 text-slate-500">
                <div class="text-4xl mb-3">🔬</div>
                <div>尚未执行 FEA 求解，请先点击「求解 FEA」按钮</div>
              </div>

              <div v-else class="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
                <table class="w-full text-xs">
                  <thead class="bg-slate-800/80 text-slate-300">
                    <tr>
                      <th class="px-3 py-2.5 text-left font-medium">排名</th>
                      <th class="px-3 py-2.5 text-left font-medium">单元</th>
                      <th class="px-3 py-2.5 text-left font-medium">节点</th>
                      <th class="px-3 py-2.5 text-right font-medium">长度(m)</th>
                      <th class="px-3 py-2.5 text-right font-medium">角度(°)</th>
                      <th class="px-3 py-2.5 text-right font-medium">{{ hc?.modeDisplayName }}({{ hc?.unit }})</th>
                      <th class="px-3 py-2.5 text-right font-medium">占比</th>
                      <th class="px-3 py-2.5 text-center font-medium">状态</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-700/50">
                    <tr
                      v-for="(el, i) in report.topCriticalElements"
                      :key="el.id"
                      class="hover:bg-slate-800/40 transition cursor-pointer"
                      @click="store.selectElement(el.id); close();"
                    >
                      <td class="px-3 py-2.5">
                        <span
                          :class="[
                            'inline-flex w-6 h-6 rounded-full items-center justify-center text-[10px] font-bold',
                            i === 0 ? 'bg-red-500 text-white' :
                            i === 1 ? 'bg-orange-500 text-white' :
                            i === 2 ? 'bg-amber-500 text-white' :
                            'bg-slate-700 text-slate-300'
                          ]"
                        >
                          {{ i + 1 }}
                        </span>
                      </td>
                      <td class="px-3 py-2.5">
                        <span class="inline-flex items-center gap-1.5 font-mono">
                          <span class="w-2.5 h-2.5 rounded" :style="{ background: el.color }"></span>
                          <span class="text-slate-200 font-semibold">#{{ el.id }}</span>
                        </span>
                      </td>
                      <td class="px-3 py-2.5 text-slate-300 font-mono">{{ el.nodeIds[0] }} → {{ el.nodeIds[1] }}</td>
                      <td class="px-3 py-2.5 text-right text-slate-300 font-mono">{{ el.length.toFixed(3) }}</td>
                      <td class="px-3 py-2.5 text-right text-slate-300 font-mono">{{ el.angle.toFixed(1) }}</td>
                      <td class="px-3 py-2.5 text-right">
                        <span
                          class="font-mono font-bold px-1.5 py-0.5 rounded"
                          :style="{ background: el.color + '30', color: el.color }"
                        >
                          {{ el.value.toFixed(4) }}
                        </span>
                      </td>
                      <td class="px-3 py-2.5 text-right">
                        <div class="flex items-center gap-1.5 justify-end">
                          <div class="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              class="h-full rounded-full transition-all"
                              :style="{ width: el.valuePercent + '%', background: el.color }"
                            />
                          </div>
                          <span class="font-mono text-slate-300 w-12 text-right">{{ el.valuePercent.toFixed(1) }}%</span>
                        </div>
                      </td>
                      <td class="px-3 py-2.5 text-center">
                        <span
                          :class="[
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                            el.isTension
                              ? 'bg-red-900/40 text-red-400 border border-red-700/50'
                              : 'bg-blue-900/40 text-blue-400 border border-blue-700/50'
                          ]"
                        >
                          {{ el.isTension ? '● 受拉' : '● 受压' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="text-[10px] text-slate-500 text-center">
                💡 点击任意单元行可在主界面中选中该单元
              </div>
            </div>

            <!-- Selected Detail Tab -->
            <div v-show="activeTab === 'selected'" class="space-y-4">
              <div v-if="!report.selectedElementDetail" class="text-center py-12 text-slate-500">
                <div class="text-4xl mb-3">🎯</div>
                <div>请在主界面点击热力图中的一个单元查看详情</div>
              </div>

              <template v-else>
                <div
                  class="rounded-xl p-6 border"
                  :style="{
                    background: `linear-gradient(135deg, ${report.selectedElementDetail.color}15, rgba(30,41,59,0.4))`,
                    borderColor: report.selectedElementDetail.color + '55',
                  }"
                >
                  <div class="flex items-center justify-between mb-5">
                    <div class="flex items-center gap-3">
                      <span
                        class="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        :style="{ background: report.selectedElementDetail.color + '33' }"
                      >
                        #{{ report.selectedElementDetail.id }}
                      </span>
                      <div>
                        <div class="text-xl font-bold text-slate-100">单元详情</div>
                        <div class="text-xs text-slate-500">
                          节点 {{ report.selectedElementDetail.nodeIds[0] }} → {{ report.selectedElementDetail.nodeIds[1] }}
                        </div>
                      </div>
                    </div>
                    <span
                      :class="[
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
                        report.selectedElementDetail.isTension
                          ? 'bg-red-900/50 text-red-300 border border-red-700/50'
                          : 'bg-blue-900/50 text-blue-300 border border-blue-700/50'
                      ]"
                    >
                      <span
                        class="w-2 h-2 rounded-full"
                        :class="report.selectedElementDetail.isTension ? 'bg-red-400' : 'bg-blue-400'"
                      ></span>
                      {{ report.selectedElementDetail.isTension ? '受拉单元' : '受压单元' }}
                    </span>
                  </div>

                  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div class="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                      <div class="text-[10px] text-slate-500 mb-1">单元长度</div>
                      <div class="text-lg font-bold text-slate-200">
                        {{ report.selectedElementDetail.length.toFixed(4) }}
                        <span class="text-xs font-normal text-slate-500 ml-1">m</span>
                      </div>
                    </div>
                    <div class="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                      <div class="text-[10px] text-slate-500 mb-1">单元角度</div>
                      <div class="text-lg font-bold text-slate-200">
                        {{ report.selectedElementDetail.angle.toFixed(2) }}
                        <span class="text-xs font-normal text-slate-500 ml-1">°</span>
                      </div>
                    </div>
                    <div class="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                      <div class="text-[10px] text-slate-500 mb-1">截面面积</div>
                      <div class="text-lg font-bold text-slate-200">
                        {{ (report.selectedElementDetail.area * 1e6).toFixed(1) }}
                        <span class="text-xs font-normal text-slate-500 ml-1">mm²</span>
                      </div>
                    </div>
                    <div class="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                      <div class="text-[10px] text-slate-500 mb-1">弹性模量</div>
                      <div class="text-lg font-bold text-slate-200">
                        {{ (report.selectedElementDetail.youngsModulus / 1e9).toFixed(0) }}
                        <span class="text-xs font-normal text-slate-500 ml-1">GPa</span>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div
                      class="rounded-lg p-4 border"
                      :style="{
                        background: report.selectedElementDetail.color + '1A',
                        borderColor: report.selectedElementDetail.color + '44',
                      }"
                    >
                      <div class="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">
                        {{ hc?.modeDisplayName || '应力' }} 值 ({{ hc?.unit || 'MPa' }})
                      </div>
                      <div class="text-3xl font-bold" :style="{ color: report.selectedElementDetail.color }">
                        {{ report.selectedElementDetail.value.toFixed(4) }}
                      </div>
                    </div>
                    <div class="bg-purple-900/20 rounded-lg p-4 border border-purple-700/30">
                      <div class="text-[10px] text-purple-400 mb-1 uppercase tracking-wider">占最大值比例</div>
                      <div class="flex items-end gap-3">
                        <div class="text-3xl font-bold text-purple-300">
                          {{ report.selectedElementDetail.valuePercent.toFixed(1) }}%
                        </div>
                        <div class="flex-1 pb-2">
                          <div class="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              class="h-full rounded-full"
                              :style="{
                                width: report.selectedElementDetail.valuePercent + '%',
                                background: `linear-gradient(90deg, ${report.selectedElementDetail.color}, #a855f7)`,
                              }"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <!-- Reactions Tab -->
            <div v-show="activeTab === 'reactions'" class="space-y-4">
              <h3 class="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span class="w-1 h-4 bg-emerald-500 rounded"></span>
                约束反力汇总
              </h3>

              <div v-if="report.reactionForces.length === 0" class="text-center py-12 text-slate-500">
                <div class="text-4xl mb-3">⚖</div>
                <div>尚未执行 FEA 求解，暂无约束反力数据</div>
              </div>

              <div v-else class="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
                <table class="w-full text-xs">
                  <thead class="bg-slate-800/80 text-slate-300">
                    <tr>
                      <th class="px-4 py-2.5 text-left font-medium">节点 ID</th>
                      <th class="px-4 py-2.5 text-right font-medium">水平反力 Fx (kN)</th>
                      <th class="px-4 py-2.5 text-right font-medium">竖向反力 Fy (kN)</th>
                      <th class="px-4 py-2.5 text-right font-medium">合力大小 (kN)</th>
                      <th class="px-4 py-2.5 text-center font-medium">方向</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-700/50">
                    <tr
                      v-for="r in report.reactionForces"
                      :key="r.nodeId"
                      class="hover:bg-slate-800/40 transition"
                    >
                      <td class="px-4 py-3">
                        <span class="inline-flex items-center gap-2">
                          <span class="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                          <span class="font-mono text-slate-200 font-semibold">#{{ r.nodeId }}</span>
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right">
                        <span
                          :class="[
                            'font-mono',
                            Math.abs(r.fx) < 1 ? 'text-slate-500' : r.fx >= 0 ? 'text-sky-400' : 'text-pink-400'
                          ]"
                        >
                          {{ (r.fx / 1000).toFixed(4) }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right">
                        <span
                          :class="[
                            'font-mono',
                            Math.abs(r.fy) < 1 ? 'text-slate-500' : r.fy >= 0 ? 'text-emerald-400' : 'text-red-400'
                          ]"
                        >
                          {{ (r.fy / 1000).toFixed(4) }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right">
                        <span class="font-mono font-bold text-amber-400">
                          {{ (r.magnitude / 1000).toFixed(4) }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <div class="flex items-center justify-center gap-2">
                          <svg width="36" height="36" viewBox="-18 -18 36 36">
                            <circle r="14" fill="none" stroke="#334155" stroke-width="1" />
                            <line
                              x1="0" y1="0"
                              :x2="r.magnitude > 0 ? (r.fx / r.magnitude * 13).toFixed(2) : 0"
                              :y2="r.magnitude > 0 ? (r.fy / r.magnitude * -13).toFixed(2) : 0"
                              stroke="#fbbf24"
                              stroke-width="2"
                              stroke-linecap="round"
                            />
                            <polygon
                              v-if="r.magnitude > 0"
                              :points="arrowPoints(r.fx, r.fy, r.magnitude)"
                              fill="#fbbf24"
                            />
                          </svg>
                          <span class="text-[10px] text-slate-500">
                            {{ (Math.atan2(r.fy, r.fx) * 180 / Math.PI).toFixed(1) }}°
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
function arrowPoints(fx: number, fy: number, mag: number): string {
  if (mag === 0) return '';
  const len = 13;
  const nx = fx / mag;
  const ny = -fy / mag;
  const tipX = nx * len;
  const tipY = ny * len;
  const perpX = -ny;
  const perpY = nx;
  const baseX = tipX - nx * 4;
  const baseY = tipY - ny * 4;
  const p1x = baseX + perpX * 3;
  const p1y = baseY + perpY * 3;
  const p2x = baseX - perpX * 3;
  const p2y = baseY - perpY * 3;
  return `${tipX.toFixed(2)},${tipY.toFixed(2)} ${p1x.toFixed(2)},${p1y.toFixed(2)} ${p2x.toFixed(2)},${p2y.toFixed(2)}`;
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.96) translateY(10px);
  opacity: 0;
}
</style>
