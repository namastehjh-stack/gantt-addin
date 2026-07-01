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
      <!-- Gradient fills for each project color -->
      <linearGradient v-for="(color, proj) in gradientColors" :key="'g'+proj" :id="'grad-'+safeId(proj)" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="color.light"/>
        <stop offset="100%" :stop-color="color.dark"/>
      </linearGradient>
    </defs>

    <rect :x="marginLeft" :y="top" :width="numMonths * cellW" :height="personList.length * rowH" fill="#fafbfc"/>

    <g v-for="(m, vi) in visibleMonths" :key="'h'+vi">
      <text :x="marginLeft + vi * cellW + cellW / 2" :y="22" text-anchor="middle"
            :font-size="vi % 3 === 0 ? 12 : 10"
            :font-weight="vi % 3 === 0 ? 'bold' : 'normal'"
            :fill="vi % 3 === 0 ? '#333' : '#888'">{{ m }}</text>
    </g>

    <rect v-for="(_, pi) in personList" :key="'bg'+pi"
          :x="marginLeft" :y="top + pi * rowH"
          :width="numMonths * cellW" :height="rowH"
          :fill="pi % 2 === 0 ? '#fff' : '#f5f7fa'" rx="0"/>

    <text v-for="(person, pi) in personList" :key="'lbl'+pi"
          :x="marginLeft - 8" :y="top + pi * rowH + rowH / 2 + 5"
          text-anchor="end" font-size="12" font-weight="500" fill="#2c3e50">{{ person }}</text>

    <line v-for="i in numMonths + 1" :key="'v'+i"
          :x1="marginLeft + (i - 1) * cellW" :y1="top"
          :x2="marginLeft + (i - 1) * cellW" :y2="top + personList.length * rowH"
          stroke="#e8ecf0" stroke-width="1"/>

    <g v-for="(person, pi) in personList" :key="'bars'+pi">
      <g v-for="(seg, si) in (layoutRows[person] || [])" :key="'s'+si">
        <rect :x="marginLeft + seg.visualStart * cellW + 1"
              :y="top + pi * rowH + seg.yOffset"
              :width="Math.max(0, seg.visualSpan * cellW - 2)"
              :height="10"
              :fill="seg.project ? 'url(#grad-'+safeId(seg.project)+')' : '#ccc'"
              opacity="0.92"
              rx="3"
              class="gantt-bar"
              :style="barStyle(pi, si)">
          <title>{{ seg.project || 'Unknown' }} · {{ seg.start }}-{{ seg.end }}</title>
        </rect>
        <rect :x="marginLeft + seg.visualStart * cellW + 1"
              :y="top + pi * rowH + seg.yOffset"
              :width="Math.max(0, seg.visualSpan * cellW - 2)"
              :height="10"
              fill="url(#shimmer)"
              rx="3"
              pointer-events="none"/>
      </g>
    </g>

    <text :x="marginLeft" :y="svgHeight - 8" font-size="11" fill="#555" font-weight="bold" v-if="legendItems.length">Legend:</text>
    <g v-for="(li, idx) in legendItems" :key="'leg'+idx">
      <rect :x="marginLeft + 60 + (idx % 6) * 130" :y="svgHeight - 22 + Math.floor(idx / 6) * 18"
            width="12" height="12" :fill="'url(#grad-'+safeId(li.label)+')'" rx="2" opacity="0.92"/>
      <text :x="marginLeft + 76 + (idx % 6) * 130" :y="svgHeight - 12 + Math.floor(idx / 6) * 18"
            font-size="10" fill="#555">{{ li.label }}</text>
    </g>
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
const cellW = computed(() => {
  const avail = window.innerWidth - marginLeft - 30
  return Math.max(28, Math.min(52, avail / numMonths.value))
})
const rowH = 44
const top = 32

// Generate light→dark gradients from hex colors
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

const visibleRange = computed(() => {
  let minS = 24, maxE = 0
  for (const d of props.data) {
    if (d.startMonth < minS) minS = d.startMonth
    if (d.endMonth > maxE) maxE = d.endMonth
  }
  return { start: Math.max(0, minS - 1), end: Math.min(24, maxE + 1) }
})
const visibleMonths = computed(() => allMonths.slice(visibleRange.value.start, visibleRange.value.end + 1))
const numMonths = computed(() => visibleMonths.value.length)

const personList = computed(() => [...new Set(props.data.map(d => d.nd || 'Unknown'))].filter(Boolean).sort())
const legendItems = computed(() => {
  const seen = new Set()
  const items = []
  for (const d of props.data) {
    if (!d.project || seen.has(d.project)) continue
    seen.add(d.project)
    items.push({ label: d.project, color: props.colors[d.project] || '#ccc' })
  }
  return items.sort((a, b) => a.label.localeCompare(b.label))
})

const layoutRows = computed(() => {
  const map = {}
  const vs = visibleRange.value.start
  for (const person of personList.value) {
    const segs = []
    for (const item of props.data) {
      if ((item.nd || item.person) !== person) continue
      if (item.startMonth < 0 || item.endMonth < 0) continue
      segs.push({ project: item.project, start: item.startMonth, end: item.endMonth, span: item.endMonth - item.startMonth + 1, visualStart: item.startMonth - vs, visualSpan: Math.max(1, item.endMonth - item.startMonth + 1) })
    }
    segs.sort((a, b) => a.start - b.start || b.span - a.span)
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
    map[person] = segs
  }
  return map
})

let barCounter = 0
function barStyle(pi, si) {
  barCounter++
  return { animationDelay: `${(pi * 1 + si) * 0.04}s` }
}

const svgWidth = computed(() => marginLeft + numMonths.value * cellW + 20)
const svgHeight = computed(() => top + personList.value.length * rowH + Math.max(Math.ceil(legendItems.value.length / 6) * 18, 0) + 20)
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
