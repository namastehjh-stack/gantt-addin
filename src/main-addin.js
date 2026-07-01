import { createApp } from 'vue'
import AddinPage from './pages/AddinPage.vue'

console.log('Add-in booting, waiting for Office.js...')

Office.onReady(() => {
  console.log('Office.js ready, mounting Vue app')
  createApp(AddinPage).mount('#app')
})
