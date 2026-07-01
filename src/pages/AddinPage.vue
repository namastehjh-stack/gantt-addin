<template>
  <div class="addin-container">
    <header class="toolbar">
      <h1>FY27 Resource Gantt</h1>
      <div class="controls">
        <button class="btn btn-primary" @click="loadData" :disabled="loading">
          {{ loading ? 'Loading...' : 'Load Data' }}
        </button>
        <div class="view-toggle">
          <button
            :class="['btn', view === 'person' ? 'btn-active' : 'btn-outline']"
            @click="view = 'person'"
          >By Person</button>
          <button
            :class="['btn', view === 'project' ? 'btn-active' : 'btn-outline']"
            @click="view = 'project'"
          >By Project</button>
        </div>
        <select v-if="view === 'project' && data.length" v-model="selectedProject" class="project-select">
          <option v-for="p in projectList" :key="p" :value="p">{{ p }}</option>
        </select>
        <button class="btn btn-accent" @click="exportToExcel" :disabled="!data.length">
          Export
        </button>
        <button class="btn btn-accent" @click="openFullscreen" :disabled="!data.length">
          Fullscreen
        </button>
      </div>
    </header>

    <div v-if="error" class="error-msg">{{ error }}</div>

    <div v-if="statusLog.length" class="status-log">
      <div v-for="(s, i) in statusLog" :key="i" class="status-line">{{ s }}</div>
    </div>

    <div v-if="data.length" class="gantt-wrapper">
      <GanttByPerson v-if="view === 'person'" :data="data" :colors="projectColors" />
      <GanttByProject v-if="view === 'project'" :data="filteredProjectData" :colors="projectColors" />
    </div>

    <div v-else-if="!loading" class="empty-state">
      <p>Click "Load Data" to read Dhour Plan from the current workbook.</p>
      <p class="hint">Make sure you have the FY27 Excel file open.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import GanttByPerson from '../components/GanttByPerson.vue'
import GanttByProject from '../components/GanttByProject.vue'

const view = ref('person')
const loading = ref(false)
const error = ref('')
const data = ref([])
const statusLog = ref([])
const selectedProject = ref('')

const projectList = computed(() => [...new Set(data.value.map(d => d.project))].filter(Boolean).sort())
const filteredProjectData = computed(() => {
  if (!selectedProject.value) return data.value
  return data.value.filter(d => d.project === selectedProject.value)
})

function log(msg) {
  console.log('[Gantt]', msg)
  statusLog.value.push(msg)
}

const MONTH_LABELS = [
  "Sep'26","Oct'26","Nov'26","Dec'26",
  "Jan'27","Feb'27","Mar'27","Apr'27",
  "May'27","Jun'27","Jul'27","Aug'27","Sep'27"
]

const COLORS = ['#4CAF50','#2196F3','#F44336','#FF9800','#9C27B0','#00BCD4',
                '#FF5722','#795548','#607D8B','#E91E63','#3F51B5','#8BC34A',
                '#CDDC39','#03A9F4','#FFC107','#009688','#673AB7','#E64A19']

const projectColors = computed(() => {
  const map = {}
  const projects = [...new Set(data.value.map(d => d.project))]
  projects.sort()
  projects.forEach((p, i) => {
    map[p] = COLORS[i % COLORS.length]
  })
  return map
})

function monthIndex(dateVal) {
  if (!dateVal) return -1
  let d
  if (typeof dateVal === 'number' && dateVal > 40000) {
    d = new Date((dateVal - 25569) * 86400 * 1000)
  } else {
    d = new Date(dateVal)
  }
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return (y - 2025) * 12 + m - 9  // Sep'25 = month 0
}

function clampMonth(idx) {
  return Math.max(0, Math.min(24, idx))
}

async function loadData() {
  loading.value = true
  error.value = ''
  data.value = []
  statusLog.value = []

  log('Connecting to Excel...')

  try {
    await Excel.run(async ctx => {
      log('Reading workbook sheet list...')
      const sheets = ctx.workbook.worksheets
      sheets.load('items/name')
      await ctx.sync()
      log(`Found ${sheets.items.length} sheets: ${sheets.items.map(s => s.name).join(', ')}`)

      log('Loading Dhour Plan sheet...')
      const planSheet = ctx.workbook.worksheets.getItem('Dhour Plan')
      const used = planSheet.getUsedRange()
      used.load('values, rowCount, columnCount')
      await ctx.sync()

      log(`Dhour Plan: ${used.rowCount} rows × ${used.columnCount} cols`)
      const rows = used.values
      log(`Row 5 raw: ${JSON.stringify(rows[4])}`)
      log(`Row 6 raw: ${JSON.stringify(rows[5])}`)
      const result = []

      for (let r = 4; r < rows.length; r++) {
        const row = rows[r]
        if (!row) continue
        const project = String(row[0] || '').trim()
        const nd = String(row[1] || '').trim()
        const role = String(row[2] || '').trim()
        const charge = String(row[3] || '').trim()
        const startVal = row[4]
        const endVal = row[5]
        const planHrs = Number(row[6]) || 0

        if (!project) continue

        const rawS = monthIndex(startVal)
        const rawE = monthIndex(endVal)
        if (!startVal && !endVal) continue  // truly no dates
        const s = clampMonth(rawS)
        const e = endVal ? clampMonth(rawE) : 24
        if (s > e || s > 24) continue

        result.push({
          project,
          nd,
          role,
          charge,
          startMonth: s,
          endMonth: e,
          planHrs,
        })
      }

      log(`Parsed ${result.length} segments from ${rows.length - 4} data rows`)
      data.value = result
    })
  } catch (e) {
    console.error('[Gantt] ERROR:', e)
    error.value = 'Error: ' + (e.message || String(e))
    log('FAILED: ' + (e.message || String(e)))
  } finally {
    loading.value = false
  }
}

async function openFullscreen() {
  const dialogUrl = window.location.href.replace('/addin/index.html', '/addin/dialog.html')
  const encoded = encodeURIComponent(JSON.stringify(data.value))
  Office.context.ui.displayDialogAsync(dialogUrl + '#' + encoded, { width: 65, height: 70, displayInIframe: false })
}
async function exportToExcel() {
  const svgEl = document.getElementById('gantt-svg')
  if (!svgEl) {
    error.value = 'No SVG found. Load data first.'
    return
  }

  try {
    // 1. Clone the SVG so we don't mess up the live one
    const clone = svgEl.cloneNode(true)

    // 2. Remove all <animate>, <animateTransform> elements (break canvas rendering)
    clone.querySelectorAll('animate, animateTransform, animateMotion').forEach(el => el.remove())

    // 3. Remove <pattern> with rgba (canvas doesn't support rgba in SVG)
    clone.querySelectorAll('pattern').forEach(el => el.remove())

    // 4. Remove Vue scoped-CSS attributes (class, data-v-xxx) so no scoped styles apply
    clone.removeAttribute('class')
    clone.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'))
    clone.querySelectorAll('[data-v]').forEach(el => el.removeAttribute('data-v'))
    // Also remove any data-v-xxxxx attributes
    const allEls = clone.querySelectorAll('*')
    allEls.forEach(el => {
      for (const attr of [...el.attributes]) {
        if (attr.name.startsWith('data-v-')) el.removeAttribute(attr.name)
      }
    })

    // 5. Remove any <style> tags inside the SVG
    clone.querySelectorAll('style').forEach(el => el.remove())

    // 6. Ensure xmlns
    if (!clone.hasAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    }

    // 7. Get actual content bounding box from the ORIGINAL svg
    const bbox = svgEl.getBBox()
    // Add padding and round up
    const contentW = Math.ceil(bbox.x + bbox.width + 10)
    const contentH = Math.ceil(bbox.y + bbox.height + 10)
    const w = Math.max(contentW, 200)
    const h = Math.max(contentH, 100)

    // 8. Set explicit dimensions on the clone — match actual content
    clone.setAttribute('width', w)
    clone.setAttribute('height', h)

    // 9. Serialize
    const svgStr = new XMLSerializer().serializeToString(clone)
    const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)

    // 10. Render to canvas at 2x resolution
    const img = new Image()
    img.onload = async () => {
      // Use the image's ACTUAL rendered dimensions, not our computed values
      const iw = img.naturalWidth || img.width || w
      const ih = img.naturalHeight || img.height || h
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(iw * scale)
      canvas.height = Math.round(ih * scale)
      const ctx2d = canvas.getContext('2d')
      ctx2d.scale(scale, scale)
      ctx2d.fillStyle = '#ffffff'
      ctx2d.fillRect(0, 0, iw, ih)
      ctx2d.drawImage(img, 0, 0, iw, ih)

      const base64 = canvas.toDataURL('image/png').split(',')[1]

      // Display at max 800px wide, proportional height
      const displayW = Math.min(iw, 800)
      const displayH = Math.round(ih * (displayW / iw))

      await Excel.run(async ctx => {
        let snapSheet
        try {
          snapSheet = ctx.workbook.worksheets.getItem('ResourceGantt')
          snapSheet.delete()
          await ctx.sync()
        } catch (_) {}

        snapSheet = ctx.workbook.worksheets.add('ResourceGantt')
        snapSheet.activate()
        await ctx.sync()
        snapSheet.shapes.addImage(base64, { left: 0, top: 0, width: displayW, height: displayH })
        await ctx.sync()
      })
    }
    img.onerror = () => {
      error.value = 'Failed to render SVG image. Check console for details.'
    }
    img.src = dataUri
  } catch (e) {
    error.value = 'Export error: ' + (e.message || String(e))
    console.error('[Export]', e)
  }
}
</script>

<style scoped>
.addin-container { padding: 12px; font-size: 13px; }
.toolbar { margin-bottom: 12px; }
.toolbar h1 { font-size: 18px; margin-bottom: 8px; color: #1a1a2e; }
.controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.btn { padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-size: 13px; background: #fff; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn-primary { background: #366092; color: #fff; border-color: #366092; }
.btn-accent { background: #FF8F00; color: #fff; border-color: #FF8F00; }
.btn-active { background: #366092; color: #fff; border-color: #366092; }
.btn-outline { background: #fff; color: #366092; }
.view-toggle { display: flex; gap: 0; }
.view-toggle .btn { border-radius: 0; }
.view-toggle .btn:first-child { border-radius: 4px 0 0 4px; }
.view-toggle .btn:last-child { border-radius: 0 4px 4px 0; }
.project-select { padding: 5px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; max-width: 200px; }
.error-msg { background: #ffebee; color: #c62828; padding: 8px; border-radius: 4px; margin-bottom: 12px; }
.status-log { background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 4px; padding: 8px; margin-bottom: 12px; font-size: 12px; max-height: 200px; overflow-y: auto; }
.status-line { padding: 1px 0; font-family: monospace; color: #2e7d32; }
.empty-state { padding: 40px 20px; text-align: center; color: #666; }
.hint { font-size: 12px; color: #999; margin-top: 8px; }
.gantt-wrapper { overflow-x: auto; }
</style>
