<script setup lang="ts">
import { onMounted, ref } from 'vue';
import FEACanvas from './components/FEACanvas.vue';
import ElementInfo from './components/ElementInfo.vue';
import MeshControls from './components/MeshControls.vue';
import ReportModal from './components/ReportModal.vue';
import { useFEAStore } from './store/fea';

const store = useFEAStore();
const showReportModal = ref(false);

onMounted(() => {
  store.loadPreset('cantilever');
});
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
    <!-- Header -->
    <header class="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <h1 class="text-lg font-bold text-purple-400">
        🔬 有限元应力热力图可视化
      </h1>
      <div class="flex items-center gap-4">
        <div class="text-xs text-slate-500">
          节点: {{ store.model.nodes.length }} |
          单元: {{ store.model.elements.length }}
        </div>
        <button
          @click="showReportModal = true"
          class="px-4 py-1.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 text-white rounded-lg transition shadow-lg shadow-purple-900/30 flex items-center gap-1.5"
        >
          <span>📊</span>
          导出分析报告
        </button>
      </div>
    </header>

    <!-- Main content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Canvas area -->
      <div class="flex-1 p-3" style="width: 75%">
        <FEACanvas />
      </div>

      <!-- Right sidebar -->
      <div class="w-[25%] min-w-[260px] bg-slate-900 border-l border-slate-800 p-3 flex flex-col gap-3 overflow-y-auto">
        <MeshControls />
        <ElementInfo />
      </div>
    </div>

    <!-- Bottom status bar -->
    <footer class="bg-slate-900 border-t border-slate-800 px-6 py-2 flex items-center gap-6 text-xs text-slate-400">
      <span>
        最大应力:
        <span class="text-red-400 font-bold">
          {{ store.result ? (store.maxStress / 1e6).toFixed(2) + ' MPa' : '—' }}
        </span>
      </span>
      <span>
        最大位移:
        <span class="text-amber-400 font-bold">
          {{ store.result ? (store.maxDisplacement * 1000).toFixed(3) + ' mm' : '—' }}
        </span>
      </span>
      <span>
        节点数: <span class="text-slate-200">{{ store.model.nodes.length }}</span>
      </span>
      <span>
        单元数: <span class="text-slate-200">{{ store.model.elements.length }}</span>
      </span>
      <span class="ml-auto text-slate-600">
        热力图: {{ store.heatmapMode }}
      </span>
    </footer>

    <!-- Report Modal -->
    <ReportModal v-model:visible="showReportModal" />
  </div>
</template>
