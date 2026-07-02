<template>
  <svg :width="svgWidth" :height="svgHeight" :viewBox="`0 0 ${svgWidth} ${svgHeight}`" id="gantt-svg" class="gantt-svg">
    <defs>
      <filter id="shadow">
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.15"/>
      </filter>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="1" stdDeviation="3" flood-opacity="0.4"/>
      </filter>
      <linearGradient id="shimmer" x1="-1" y1="0" x2="0" y2="0">
        <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
        <stop offset="45%" stop-color="#fff" stop-opacity="0.5"/>
        <stop offset="55%" stop-color="#fff" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
        <animate attributeName="x1" values="-1;2" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="x2" values="0;3" dur="1.5s" repeatCount="indefinite"/>
      </linearGradient>
      <linearGradient v-for="(color, proj) in gradientColors" :key="'g'+proj" :id="'grad-'+safeId(proj)" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="color.light"/>
        <stop offset="100%" :stop-color="color.dark"/>
      </linearGradient>
    </defs>

    <rect :x="marginLeft" :y="top" :width="visibleMonths.length * cellW" :height="totalRows * rowH" fill="#fafbfc"/>

    <g v-for="(m, vi) in visibleMonths" :key="'h'+vi">
      <text :x="marginLeft + vi * cellW + cellW / 2" :y="22" text-anchor="middle"
            :font-size="vi % 3 === 0 ? 12 : 10"
            :font-weight="vi % 3 === 0 ? 'bold' : 'normal'"
            :fill="vi % 3 === 0 ? '#333' : '#888'">{{ m }}</text>
    </g>

    <line v-for="i in visibleMonths.length + 1" :key="'v'+i"
          :x1="marginLeft + (i - 1) * cellW" :y1="top"
          :x2="marginLeft + (i - 1) * cellW" :y2="top + totalRows * rowH"
          stroke="#e8ecf0" stroke-width="1"/>

    <text v-if="projectName" :x="marginLeft + 4" :y="top + rowH / 2 + 5"
          font-size="14" font-weight="bold" :fill="projectColor">{{ projectName }}</text>

    <template v-for="(member, mi) in memberLayout" :key="'m' + mi">
      <text :x="marginLeft - 8"
            :y="top + (1 + mi) * rowH + rowH / 2 + 5"
            text-anchor="end" font-size="12" fill="#555">{{ member.nd }}</text>

      <template v-for="(seg, si) in member.segments" :key="'s' + si">
        <rect :x="marginLeft + seg.visualStart * cellW + 1"
              :y="top + (1 + mi) * rowH + seg.yOffset"
              :width="Math.max(0, seg.visualSpan * cellW - 2)" :height="10"
              :fill="projectName ? 'url(#grad-'+safeId(projectName)+')' : '#ccc'"
              opacity="0.92" rx="3"
              class="gantt-bar"
              :style="barStyle(mi, si)">
          <title>{{ seg.start }}-{{ seg.end }}</title>
        </rect>
        <rect :x="marginLeft + seg.visualStart * cellW + 1"
              :y="top + (1 + mi) * rowH + seg.yOffset"
              :width="Math.max(0, seg.visualSpan * cellW - 2)" :height="10"
              fill="url(#shimmer)" rx="3" pointer-events="none"/>
      </template>
    </template>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, required: true },
  colors: { type: Object, required: true },
})

const allMonths = ["Sep'25","Oct","Nov","Dec","Jan'26","Feb","Mar","Apr","May","Jun","Jul","Aug",
                   "Sep'26","Oct","Nov","Dec","Jan'27","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep'27"]
const marginLeft = 100
const cellW = 42
const rowH = 44
const top = 32

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}
function lighten(c, amt) {
  return '#' + [c.r, c.g, c.b].map(v => Math.min(255, v + amt).toString(16).padStart(2, '0')).join('')
}
function darken(c, amt) {
  return '#' + [c.r, c.g, c.b].map(v => Math.max(0, v - amt).toString(16).padStart(2, '0')).join('')
}
const gradientColors = computed(() => {
  const map = {}
  for (const [proj, hex] of Object.entries(props.colors)) {
    const c = hexToRgb(hex)
    map[proj] = { light: lighten(c, 30), dark: darken(c, 40) }
  }
  return map
})
function safeId(s) { return (s || 'unknown').replace(/[^a-zA-Z0-9]/g, '') }

const projectName = computed(() => {
  const names = [...new Set(props.data.map(d => d.project))]
  return names.length === 1 ? names[0] : ''
})
const projectColor = computed(() => projectName.value ? (props.colors[projectName.value] || '#333') : '#333')

const visibleRange = computed(() => {
  let minS = 24, maxE = 0
  for (const d of props.data) {
    if (d.startMonth < minS) minS = d.startMonth
    if (d.endMonth > maxE) maxE = d.endMonth
  }
  return { start: Math.max(0, minS - 1), end: Math.min(24, maxE + 1) }
})
const visibleMonths = computed(() => allMonths.slice(visibleRange.value.start, visibleRange.value.end + 1))

const memberLayout = computed(() => {
  const members = {}
  const vs = visibleRange.value.start
  for (const item of props.data) {
    const key = item.nd || item.person || 'Unknown'
    if (!members[key]) members[key] = []
    const adjStart = item.startMonth - vs
    const adjEnd = item.endMonth - vs
    members[key].push({ start: item.startMonth, end: item.endMonth, visualStart: adjStart, visualSpan: Math.max(1, adjEnd - adjStart + 1) })
  }
  const result = []
  for (const [nd, segs] of Object.entries(members).sort(([a], [b]) => a.localeCompare(b))) {
    segs.sort((a, b) => a.start - b.start || b.visualSpan - a.visualSpan)
    const levels = []
    for (const seg of segs) {
      let lvl = 0
      while (levels[lvl] && levels[lvl] > seg.visualStart) lvl++
      levels[lvl] = seg.visualStart + seg.visualSpan
      seg.level = lvl
    }
    const maxLvl = levels.length
    segs.forEach(seg => {
      seg.yOffset = maxLvl <= 1 ? (rowH - 10) / 2 : seg.level * 12 + (rowH - maxLvl * 12) / 2
    })
    result.push({ nd, segments: segs })
  }
  return result
})

const totalRows = computed(() => memberLayout.value.length + 1)
const svgWidth = computed(() => marginLeft + visibleMonths.value.length * cellW + 20)
const svgHeight = computed(() => top + totalRows.value * rowH + 20)

function barStyle(mi, si) {
  return { animationDelay: `${(mi * 1 + si) * 0.04}s` }
}
</script>

<style scoped>
.gantt-svg { background: #fff; border: 1px solid #dce1e6; border-radius: 8px; max-width: 100%; height: auto; }
.gantt-bar {
  transform-origin: left center;
  animation: growBar 0.35s ease-out both;
  cursor: pointer;
  transition: filter 0.15s ease, transform 0.15s ease;
}
.gantt-bar:hover {
  filter: url(#glow);
  transform: scaleY(1.5);
}
@keyframes growBar {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
</style>
