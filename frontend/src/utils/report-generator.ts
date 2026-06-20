import type { FEAModel, FEAResult, Element, Node } from '../types';

export interface ModelSummary {
  presetName: string;
  presetDisplayName: string;
  nodeCount: number;
  elementCount: number;
  loadCount: number;
  fixedNodeCount: number;
  totalLoadMagnitude: number;
  modelDimensions: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  materialInfo: {
    youngsModulusRange: { min: number; max: number };
    areaRange: { min: number; max: number };
  };
}

export interface HeatmapConclusion {
  mode: 'stress' | 'strain' | 'force';
  modeDisplayName: string;
  unit: string;
  maxValue: number;
  minValue: number;
  avgValue: number;
  medianValue: number;
  stdDevValue: number;
  distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  criticalElements: CriticalElementInfo[];
  conclusion: string[];
}

export interface CriticalElementInfo {
  id: number;
  nodeIds: [number, number];
  value: number;
  valuePercent: number;
  length: number;
  angle: number;
  area: number;
  youngsModulus: number;
  color: string;
  isTension: boolean;
}

export interface AnalysisReport {
  generatedAt: Date;
  modelSummary: ModelSummary;
  heatmapConclusion: HeatmapConclusion | null;
  topCriticalElements: CriticalElementInfo[];
  reactionForces: { nodeId: number; fx: number; fy: number; magnitude: number }[];
  selectedElementDetail: CriticalElementInfo | null;
  maxDisplacement: number;
}

const PRESET_NAMES: Record<string, string> = {
  cantilever: '悬臂梁',
  bridge: '桥梁桁架',
  frame: '简单框架',
};

function getPresetDisplayName(name: string): string {
  return PRESET_NAMES[name] || name;
}

function getHeatmapModeDisplayName(mode: string): string {
  switch (mode) {
    case 'stress': return '应力';
    case 'strain': return '应变';
    case 'force': return '轴力';
    default: return mode;
  }
}

function getHeatmapUnit(mode: string): string {
  switch (mode) {
    case 'stress': return 'MPa';
    case 'strain': return '%';
    case 'force': return 'kN';
    default: return '';
  }
}

function convertValueForDisplay(mode: string, value: number): number {
  switch (mode) {
    case 'stress': return value / 1e6;
    case 'strain': return value * 100;
    case 'force': return value / 1000;
    default: return value;
  }
}

function getLength(n1: Node | undefined, n2: Node | undefined): number {
  if (!n1 || !n2) return 0;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getAngle(n1: Node | undefined, n2: Node | undefined): number {
  if (!n1 || !n2) return 0;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function jetColormap(value: number, min: number, max: number): string {
  const t = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  let r: number, g: number, b: number;
  if (t < 0.125) {
    r = 0; g = 0; b = 0.5 + t * 4;
  } else if (t < 0.375) {
    r = 0; g = (t - 0.125) * 4; b = 1;
  } else if (t < 0.625) {
    r = (t - 0.375) * 4; g = 1; b = 1 - (t - 0.375) * 4;
  } else if (t < 0.875) {
    r = 1; g = 1 - (t - 0.625) * 4; b = 0;
  } else {
    r = 1 - (t - 0.875) * 4; g = 0; b = 0;
  }
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}

function computeStats(values: number[]): {
  min: number;
  max: number;
  avg: number;
  median: number;
  stdDev: number;
} {
  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0, stdDev: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return { min, max, avg, median, stdDev };
}

export function generateModelSummary(
  model: FEAModel,
  presetName: string
): ModelSummary {
  const { nodes, elements, loads } = model;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }

  const emValues = elements.map((e) => e.youngsModulus);
  const areaValues = elements.map((e) => e.area);
  const emStats = computeStats(emValues);
  const areaStats = computeStats(areaValues);

  const totalLoadMagnitude = loads.reduce(
    (s, l) => s + Math.sqrt(l.fx ** 2 + l.fy ** 2),
    0
  );

  return {
    presetName,
    presetDisplayName: getPresetDisplayName(presetName),
    nodeCount: nodes.length,
    elementCount: elements.length,
    loadCount: loads.length,
    fixedNodeCount: nodes.filter((n) => n.fixed).length,
    totalLoadMagnitude,
    modelDimensions: {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
    materialInfo: {
      youngsModulusRange: { min: emStats.min, max: emStats.max },
      areaRange: { min: areaStats.min, max: areaStats.max },
    },
  };
}

export function getCriticalElements(
  model: FEAModel,
  result: FEAResult | null,
  heatmapMode: 'stress' | 'strain' | 'force',
  topN: number = 10
): CriticalElementInfo[] {
  if (!result) return [];

  const { elements, nodes } = model;

  let rawValues: number[];
  let signValues: number[];
  switch (heatmapMode) {
    case 'stress':
      rawValues = result.stresses.map(Math.abs);
      signValues = result.stresses;
      break;
    case 'strain':
      rawValues = result.strains.map(Math.abs);
      signValues = result.strains;
      break;
    case 'force':
      rawValues = elements.map((e) => Math.abs(e.force));
      signValues = elements.map((e) => e.force);
      break;
  }

  const maxVal = Math.max(...rawValues);
  const absValues = rawValues;

  const indexed = absValues.map((v, i) => ({ i, v }));
  indexed.sort((a, b) => b.v - a.v);

  const top = indexed.slice(0, topN);

  return top.map(({ i, v }) => {
    const el = elements[i];
    const n1 = nodes.find((n) => n.id === el.nodeIds[0]);
    const n2 = nodes.find((n) => n.id === el.nodeIds[1]);
    return {
      id: el.id,
      nodeIds: el.nodeIds,
      value: convertValueForDisplay(heatmapMode, v),
      valuePercent: maxVal > 0 ? (v / maxVal) * 100 : 0,
      length: getLength(n1, n2),
      angle: getAngle(n1, n2),
      area: el.area,
      youngsModulus: el.youngsModulus,
      color: jetColormap(v, Math.min(...absValues), maxVal),
      isTension: signValues[i] >= 0,
    };
  });
}

export function generateHeatmapConclusion(
  model: FEAModel,
  result: FEAResult | null,
  heatmapMode: 'stress' | 'strain' | 'force'
): HeatmapConclusion | null {
  if (!result) return null;

  const { elements } = model;

  let rawValues: number[];
  let signValues: number[];
  switch (heatmapMode) {
    case 'stress':
      rawValues = result.stresses.map(Math.abs);
      signValues = result.stresses;
      break;
    case 'strain':
      rawValues = result.strains.map(Math.abs);
      signValues = result.strains;
      break;
    case 'force':
      rawValues = elements.map((e) => Math.abs(e.force));
      signValues = elements.map((e) => e.force);
      break;
  }

  const displayValues = rawValues.map((v) =>
    convertValueForDisplay(heatmapMode, v)
  );
  const stats = computeStats(displayValues);

  const tensionCount = signValues.filter((v) => v >= 0).length;
  const compressionCount = signValues.length - tensionCount;

  let low = 0, medium = 0, high = 0, critical = 0;
  for (const v of rawValues) {
    const pct = stats.max > 0 ? v / stats.max * convertValueForDisplay(heatmapMode, stats.max) / (stats.max || 1) : 0;
    const normalized = stats.max > 0 ? v / Math.max(...rawValues) : 0;
    if (normalized < 0.25) low++;
    else if (normalized < 0.5) medium++;
    else if (normalized < 0.75) high++;
    else critical++;
  }

  const criticalElements = getCriticalElements(model, result, heatmapMode, 5);

  const unit = getHeatmapUnit(heatmapMode);
  const modeName = getHeatmapModeDisplayName(heatmapMode);
  const conclusion: string[] = [];

  conclusion.push(
    `本次分析采用${modeName}热力图模式，整体${modeName}范围为 ${stats.min.toFixed(4)} ~ ${stats.max.toFixed(4)} ${unit}。`
  );
  conclusion.push(
    `平均${modeName}为 ${stats.avg.toFixed(4)} ${unit}，中位值为 ${stats.median.toFixed(4)} ${unit}，标准差为 ${stats.stdDev.toFixed(4)} ${unit}。`
  );

  if (tensionCount > 0 || compressionCount > 0) {
    conclusion.push(
      `受拉单元 ${tensionCount} 根，受压单元 ${compressionCount} 根，${tensionCount >= compressionCount ? '整体以受拉为主' : '整体以受压为主'}。`
    );
  }

  if (critical > 0) {
    conclusion.push(
      `高应力区（超过75%最大值）共 ${critical} 个单元，占比 ${((critical / elements.length) * 100).toFixed(1)}%，需要重点关注。`
    );
  }

  if (criticalElements.length > 0) {
    const top = criticalElements[0];
    const forceType = top.isTension ? '受拉' : '受压';
    conclusion.push(
      `最危险单元为 #${top.id}，连接节点 ${top.nodeIds[0]} → ${top.nodeIds[1]}，${modeName}值达 ${top.value.toFixed(4)} ${unit}（${forceType}），占最大值的 ${top.valuePercent.toFixed(1)}%。`
    );
  }

  return {
    mode: heatmapMode,
    modeDisplayName: modeName,
    unit,
    maxValue: stats.max,
    minValue: stats.min,
    avgValue: stats.avg,
    medianValue: stats.median,
    stdDevValue: stats.stdDev,
    distribution: { low, medium, high, critical },
    criticalElements,
    conclusion,
  };
}

export function generateAnalysisReport(
  model: FEAModel,
  result: FEAResult | null,
  selectedPreset: string,
  heatmapMode: 'stress' | 'strain' | 'force',
  selectedElementId: number | null
): AnalysisReport {
  const modelSummary = generateModelSummary(model, selectedPreset);
  const heatmapConclusion = generateHeatmapConclusion(model, result, heatmapMode);
  const topCriticalElements = getCriticalElements(model, result, heatmapMode, 10);

  let selectedElementDetail: CriticalElementInfo | null = null;
  if (selectedElementId !== null && result) {
    const allCritical = getCriticalElements(model, result, heatmapMode, model.elements.length);
    selectedElementDetail = allCritical.find((c) => c.id === selectedElementId) || null;
  }

  const reactionForces = (result?.reactionForces || []).map((r) => ({
    ...r,
    magnitude: Math.sqrt(r.fx ** 2 + r.fy ** 2),
  }));

  return {
    generatedAt: new Date(),
    modelSummary,
    heatmapConclusion,
    topCriticalElements,
    reactionForces,
    selectedElementDetail,
    maxDisplacement: result?.maxDisplacement || 0,
  };
}

export function reportToText(report: AnalysisReport): string {
  const lines: string[] = [];
  const pad = (s: string, n: number) => s.padEnd(n, ' ');

  lines.push('='.repeat(60));
  lines.push('  有限元应力分析报告');
  lines.push(`  生成时间: ${report.generatedAt.toLocaleString('zh-CN')}`);
  lines.push('='.repeat(60));
  lines.push('');

  const ms = report.modelSummary;
  lines.push('【一、模型概况】');
  lines.push('-'.repeat(40));
  lines.push(`  预设模型:      ${ms.presetDisplayName}`);
  lines.push(`  节点总数:      ${ms.nodeCount}`);
  lines.push(`  单元总数:      ${ms.elementCount}`);
  lines.push(`  约束节点:      ${ms.fixedNodeCount}`);
  lines.push(`  荷载数量:      ${ms.loadCount}`);
  lines.push(`  总荷载大小:    ${(ms.totalLoadMagnitude / 1000).toFixed(2)} kN`);
  lines.push(`  几何尺寸:      宽 ${ms.modelDimensions.width.toFixed(2)}m × 高 ${ms.modelDimensions.height.toFixed(2)}m`);
  lines.push(`  弹性模量:      ${(ms.materialInfo.youngsModulusRange.min / 1e9).toFixed(0)} ~ ${(ms.materialInfo.youngsModulusRange.max / 1e9).toFixed(0)} GPa`);
  lines.push(`  截面面积:      ${(ms.materialInfo.areaRange.min * 1e6).toFixed(0)} ~ ${(ms.materialInfo.areaRange.max * 1e6).toFixed(0)} mm²`);
  lines.push('');

  if (report.heatmapConclusion) {
    const hc = report.heatmapConclusion;
    lines.push(`【二、热力图结论（${hc.modeDisplayName}模式）】`);
    lines.push('-'.repeat(40));
    lines.push(`  统计单位:      ${hc.unit}`);
    lines.push(`  最大值:        ${hc.maxValue.toFixed(4)} ${hc.unit}`);
    lines.push(`  最小值:        ${hc.minValue.toFixed(4)} ${hc.unit}`);
    lines.push(`  平均值:        ${hc.avgValue.toFixed(4)} ${hc.unit}`);
    lines.push(`  中位值:        ${hc.medianValue.toFixed(4)} ${hc.unit}`);
    lines.push(`  标准差:        ${hc.stdDevValue.toFixed(4)} ${hc.unit}`);
    lines.push('');
    lines.push('  分布统计:');
    const total = hc.distribution.low + hc.distribution.medium + hc.distribution.high + hc.distribution.critical;
    lines.push(`    低区 (0-25%):    ${pad(String(hc.distribution.low), 5)} 个  (${((hc.distribution.low / total) * 100).toFixed(1)}%)`);
    lines.push(`    中区 (25-50%):   ${pad(String(hc.distribution.medium), 5)} 个  (${((hc.distribution.medium / total) * 100).toFixed(1)}%)`);
    lines.push(`    高区 (50-75%):   ${pad(String(hc.distribution.high), 5)} 个  (${((hc.distribution.high / total) * 100).toFixed(1)}%)`);
    lines.push(`    危险区 (75-100%): ${pad(String(hc.distribution.critical), 5)} 个  (${((hc.distribution.critical / total) * 100).toFixed(1)}%)`);
    lines.push('');
    lines.push('  分析结论:');
    hc.conclusion.forEach((c, i) => {
      lines.push(`    ${i + 1}. ${c}`);
    });
    lines.push('');
  }

  lines.push('【三、关键单元详情（Top 10）】');
  lines.push('-'.repeat(40));
  if (report.topCriticalElements.length === 0) {
    lines.push('  （尚未求解，请先执行FEA求解）');
  } else {
    const header = `${pad('排名', 4)}${pad('单元', 7)}${pad('节点对', 12)}${pad('长度(m)', 10)}${pad('角度(°)', 10)}${pad(hcOrElse(report) + '(' + unitOrElse(report) + ')', 16)}${pad('占比', 8)}状态`;
    lines.push(header);
    report.topCriticalElements.forEach((el, i) => {
      lines.push(
        `${pad(String(i + 1), 4)}` +
        `${pad('#' + el.id, 7)}` +
        `${pad(el.nodeIds[0] + '→' + el.nodeIds[1], 12)}` +
        `${pad(el.length.toFixed(3), 10)}` +
        `${pad(el.angle.toFixed(1), 10)}` +
        `${pad(el.value.toFixed(4), 16)}` +
        `${pad(el.valuePercent.toFixed(1) + '%', 8)}` +
        `${el.isTension ? '受拉' : '受压'}`
      );
    });
  }
  lines.push('');

  if (report.selectedElementDetail) {
    const se = report.selectedElementDetail;
    lines.push('【四、当前选中单元详情】');
    lines.push('-'.repeat(40));
    lines.push(`  单元ID:        #${se.id}`);
    lines.push(`  连接节点:      ${se.nodeIds[0]} → ${se.nodeIds[1]}`);
    lines.push(`  单元长度:      ${se.length.toFixed(4)} m`);
    lines.push(`  单元角度:      ${se.angle.toFixed(2)} °`);
    lines.push(`  截面面积:      ${(se.area * 1e6).toFixed(2)} mm²`);
    lines.push(`  弹性模量:      ${(se.youngsModulus / 1e9).toFixed(2)} GPa`);
    lines.push(`  ${hcMode(report)}值:    ${se.value.toFixed(4)} ${report.heatmapConclusion?.unit || ''}`);
    lines.push(`  受力状态:      ${se.isTension ? '受拉 (+)' : '受压 (-)'}`);
    lines.push('');
  }

  lines.push('【五、约束反力】');
  lines.push('-'.repeat(40));
  if (report.reactionForces.length === 0) {
    lines.push('  （无约束反力数据）');
  } else {
    const header = `${pad('节点', 8)}${pad('Fx(kN)', 12)}${pad('Fy(kN)', 12)}${pad('合力(kN)', 12)}`;
    lines.push(header);
    report.reactionForces.forEach((r) => {
      lines.push(
        `${pad(String(r.nodeId), 8)}` +
        `${pad((r.fx / 1000).toFixed(3), 12)}` +
        `${pad((r.fy / 1000).toFixed(3), 12)}` +
        `${pad((r.magnitude / 1000).toFixed(3), 12)}`
      );
    });
  }
  lines.push('');

  lines.push('【六、整体性能指标】');
  lines.push('-'.repeat(40));
  lines.push(`  最大位移:      ${(report.maxDisplacement * 1000).toFixed(4)} mm`);
  if (report.heatmapConclusion) {
    lines.push(`  最大${report.heatmapConclusion.modeDisplayName}:    ${report.heatmapConclusion.maxValue.toFixed(4)} ${report.heatmapConclusion.unit}`);
  }
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  — 报告结束 —');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

function hcOrElse(report: AnalysisReport): string {
  return report.heatmapConclusion?.modeDisplayName || '值';
}

function unitOrElse(report: AnalysisReport): string {
  return report.heatmapConclusion?.unit || '';
}

function hcMode(report: AnalysisReport): string {
  return report.heatmapConclusion?.modeDisplayName || '度量';
}

export function reportToHtml(report: AnalysisReport): string {
  const ms = report.modelSummary;
  const hc = report.heatmapConclusion;

  const criticalRows = report.topCriticalElements.map((el, i) => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;">${i + 1}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;">#${el.id}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;">${el.nodeIds[0]} → ${el.nodeIds[1]}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;">${el.length.toFixed(3)}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;">${el.angle.toFixed(1)}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;font-weight:bold;background:${el.color}22;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${el.color};margin-right:6px;"></span>
        ${el.value.toFixed(4)}
      </td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;">${el.valuePercent.toFixed(1)}%</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;color:${el.isTension ? '#dc2626' : '#2563eb'};font-weight:bold;">${el.isTension ? '受拉' : '受压'}</td>
    </tr>
  `).join('');

  const total = hc ? hc.distribution.low + hc.distribution.medium + hc.distribution.high + hc.distribution.critical : 1;

  const reactionRows = report.reactionForces.map((r) => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;">${r.nodeId}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;">${(r.fx / 1000).toFixed(3)}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;">${(r.fy / 1000).toFixed(3)}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;font-weight:bold;">${(r.magnitude / 1000).toFixed(3)}</td>
    </tr>
  `).join('');

  const conclusionsHtml = hc ? hc.conclusion.map((c, i) => `
    <li style="margin-bottom:8px;line-height:1.7;">${c}</li>
  `).join('') : '';

  const selectedElHtml = report.selectedElementDetail ? (() => {
    const se = report.selectedElementDetail;
    return `
      <div style="margin-bottom:24px;">
        <h2 style="font-size:16px;color:#1e293b;border-left:4px solid #8b5cf6;padding-left:10px;margin:20px 0 12px;">四、当前选中单元详情</h2>
        <div style="background:${se.color}15;border:1px solid ${se.color}44;border-radius:8px;padding:16px;">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
            <div style="background:#f8fafc;padding:10px;border-radius:6px;">
              <div style="color:#64748b;font-size:12px;">单元ID</div>
              <div style="font-size:18px;font-weight:bold;color:#1e293b;">#${se.id}</div>
            </div>
            <div style="background:#f8fafc;padding:10px;border-radius:6px;">
              <div style="color:#64748b;font-size:12px;">连接节点</div>
              <div style="font-size:16px;font-weight:bold;color:#1e293b;">${se.nodeIds[0]} → ${se.nodeIds[1]}</div>
            </div>
            <div style="background:#f8fafc;padding:10px;border-radius:6px;">
              <div style="color:#64748b;font-size:12px;">单元长度</div>
              <div style="font-size:16px;font-weight:bold;color:#1e293b;">${se.length.toFixed(4)} m</div>
            </div>
            <div style="background:#f8fafc;padding:10px;border-radius:6px;">
              <div style="color:#64748b;font-size:12px;">受力状态</div>
              <div style="font-size:16px;font-weight:bold;color:${se.isTension ? '#dc2626' : '#2563eb'};">${se.isTension ? '受拉 (+)' : '受压 (-)'}</div>
            </div>
            <div style="background:#f8fafc;padding:10px;border-radius:6px;">
              <div style="color:#64748b;font-size:12px;">截面面积</div>
              <div style="font-size:16px;font-weight:bold;color:#1e293b;">${(se.area * 1e6).toFixed(2)} mm²</div>
            </div>
            <div style="background:#f8fafc;padding:10px;border-radius:6px;">
              <div style="color:#64748b;font-size:12px;">弹性模量</div>
              <div style="font-size:16px;font-weight:bold;color:#1e293b;">${(se.youngsModulus / 1e9).toFixed(2)} GPa</div>
            </div>
            <div style="background:${se.color}22;padding:10px;border-radius:6px;">
              <div style="color:#64748b;font-size:12px;">${hc?.modeDisplayName || ''}值 (${hc?.unit || ''})</div>
              <div style="font-size:16px;font-weight:bold;color:#1e293b;">${se.value.toFixed(4)}</div>
            </div>
            <div style="background:#f8fafc;padding:10px;border-radius:6px;">
              <div style="color:#64748b;font-size:12px;">占最大值比</div>
              <div style="font-size:16px;font-weight:bold;color:#8b5cf6;">${se.valuePercent.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    `;
  })() : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>有限元应力分析报告 - ${ms.presetDisplayName}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; margin: 0; padding: 40px; background: #f1f5f9; color: #0f172a; }
  .container { max-width: 900px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  .header { text-align: center; border-bottom: 2px solid #8b5cf6; padding-bottom: 20px; margin-bottom: 24px; }
  .header h1 { margin: 0; color: #6d28d9; font-size: 24px; }
  .header .meta { margin-top: 8px; color: #64748b; font-size: 13px; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0 20px; }
  .stat-card { background: #f8fafc; border-radius: 8px; padding: 14px; border: 1px solid #e2e8f0; }
  .stat-card .label { color: #64748b; font-size: 12px; margin-bottom: 4px; }
  .stat-card .value { font-size: 20px; font-weight: bold; color: #1e293b; }
  .stat-card .value.red { color: #dc2626; }
  .stat-card .value.amber { color: #d97706; }
  .stat-card .value.purple { color: #7c3aed; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #8b5cf6; color: white; padding: 8px 10px; text-align: center; }
  .conclusions { background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 16px 20px; margin: 12px 0; }
  .conclusions ol { margin: 0; padding-left: 20px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; }
  .distribution { display: flex; gap: 4px; height: 20px; border-radius: 6px; overflow: hidden; margin: 12px 0; }
  .dist-low { background: #22d3ee; flex: 1; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #0e7490; font-weight: bold; }
  .dist-medium { background: #4ade80; flex: 1; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #166534; font-weight: bold; }
  .dist-high { background: #facc15; flex: 1; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #854d0e; font-weight: bold; }
  .dist-critical { background: #ef4444; flex: 1; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; font-weight: bold; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🔬 有限元应力分析报告</h1>
    <div class="meta">模型类型: <strong>${ms.presetDisplayName}</strong> | 生成时间: ${report.generatedAt.toLocaleString('zh-CN')}</div>
  </div>

  <div>
    <h2 style="font-size:16px;color:#1e293b;border-left:4px solid #8b5cf6;padding-left:10px;margin:20px 0 12px;">一、模型概况</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">节点总数</div><div class="value">${ms.nodeCount}</div></div>
      <div class="stat-card"><div class="label">单元总数</div><div class="value">${ms.elementCount}</div></div>
      <div class="stat-card"><div class="label">约束节点</div><div class="value purple">${ms.fixedNodeCount}</div></div>
      <div class="stat-card"><div class="label">荷载数量</div><div class="value">${ms.loadCount}</div></div>
      <div class="stat-card"><div class="label">总荷载大小</div><div class="value amber">${(ms.totalLoadMagnitude / 1000).toFixed(2)} kN</div></div>
      <div class="stat-card"><div class="label">几何尺寸</div><div class="value" style="font-size:14px;">${ms.modelDimensions.width.toFixed(2)}×${ms.modelDimensions.height.toFixed(2)}m</div></div>
      <div class="stat-card"><div class="label">弹性模量</div><div class="value" style="font-size:14px;">${(ms.materialInfo.youngsModulusRange.min / 1e9).toFixed(0)} GPa</div></div>
      <div class="stat-card"><div class="label">截面面积</div><div class="value" style="font-size:14px;">${(ms.materialInfo.areaRange.max * 1e6).toFixed(0)} mm²</div></div>
    </div>
  </div>

  ${hc ? `
  <div>
    <h2 style="font-size:16px;color:#1e293b;border-left:4px solid #8b5cf6;padding-left:10px;margin:20px 0 12px;">二、热力图结论（${hc.modeDisplayName}模式）</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">最大值 (${hc.unit})</div><div class="value red">${hc.maxValue.toFixed(4)}</div></div>
      <div class="stat-card"><div class="label">最小值 (${hc.unit})</div><div class="value">${hc.minValue.toFixed(4)}</div></div>
      <div class="stat-card"><div class="label">平均值 (${hc.unit})</div><div class="value purple">${hc.avgValue.toFixed(4)}</div></div>
      <div class="stat-card"><div class="label">中位值 (${hc.unit})</div><div class="value">${hc.medianValue.toFixed(4)}</div></div>
    </div>
    <div style="margin:8px 0;color:#64748b;font-size:12px;">值分布可视化（低 → 中 → 高 → 危险）</div>
    <div class="distribution">
      <div class="dist-low" style="flex:${hc.distribution.low}">${hc.distribution.low}</div>
      <div class="dist-medium" style="flex:${hc.distribution.medium}">${hc.distribution.medium}</div>
      <div class="dist-high" style="flex:${hc.distribution.high}">${hc.distribution.high}</div>
      <div class="dist-critical" style="flex:${hc.distribution.critical || 0.2}">${hc.distribution.critical}</div>
    </div>
    <div class="conclusions">
      <div style="font-weight:bold;color:#6d28d9;margin-bottom:8px;">📊 分析结论</div>
      <ol>${conclusionsHtml}</ol>
    </div>
  </div>
  ` : ''}

  <div>
    <h2 style="font-size:16px;color:#1e293b;border-left:4px solid #8b5cf6;padding-left:10px;margin:20px 0 12px;">三、关键单元详情（Top 10）</h2>
    ${report.topCriticalElements.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>排名</th><th>单元</th><th>节点对</th><th>长度(m)</th><th>角度(°)</th>
          <th>${hc?.modeDisplayName || '值'}(${hc?.unit || ''})</th><th>占比</th><th>状态</th>
        </tr>
      </thead>
      <tbody>${criticalRows}</tbody>
    </table>
    ` : '<div style="color:#94a3b8;text-align:center;padding:20px;background:#f8fafc;border-radius:8px;">（尚未求解，请先执行FEA求解）</div>'}
  </div>

  ${selectedElHtml}

  <div>
    <h2 style="font-size:16px;color:#1e293b;border-left:4px solid #8b5cf6;padding-left:10px;margin:20px 0 12px;">五、约束反力</h2>
    ${report.reactionForces.length > 0 ? `
    <table>
      <thead>
        <tr><th>节点</th><th>Fx (kN)</th><th>Fy (kN)</th><th>合力 (kN)</th></tr>
      </thead>
      <tbody>${reactionRows}</tbody>
    </table>
    ` : '<div style="color:#94a3b8;text-align:center;padding:20px;background:#f8fafc;border-radius:8px;">（无约束反力数据）</div>'}
  </div>

  <div>
    <h2 style="font-size:16px;color:#1e293b;border-left:4px solid #8b5cf6;padding-left:10px;margin:20px 0 12px;">六、整体性能指标</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">最大位移</div><div class="value amber">${(report.maxDisplacement * 1000).toFixed(4)} mm</div></div>
      ${hc ? `<div class="stat-card"><div class="label">最大${hc.modeDisplayName}</div><div class="value red">${hc.maxValue.toFixed(4)} ${hc.unit}</div></div>` : ''}
    </div>
  </div>

  <div class="footer">
    本报告由有限元应力热力图可视化系统自动生成 | © ${new Date().getFullYear()}
  </div>
</div>
</body>
</html>`;
}

export function downloadHtmlReport(html: string, filename: string = 'FEA分析报告') {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadTextReport(text: string, filename: string = 'FEA分析报告') {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
