<template>
  <div ref="stageRef" class="live2d-stage">
    <canvas :key="canvasKey" ref="canvasRef" class="live2d-canvas" />
    <p class="live2d-status" :class="status" role="status" :title="errorDetail">{{ statusText }}</p>
    <button v-if="status === 'error'" type="button" class="live2d-retry" @click="loadModel">
      重试
    </button>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import * as PIXI from 'pixi.js'
import { getEmotionParams, normalizeEmotionType } from '../live2d/emotions.js'

const MODEL_URL =
  'https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Resources/Kei/Kei.model3.json'
// 当前 CubismWebSamples 已不再包含 Resources/Kei，同仓库仍公开的官方模型作为加载失败后的备用。
const FALLBACK_MODEL_URL =
  'https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Haru/Haru.model3.json'
const CUBISM_CORE_URL = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'
const EYE_OPEN_PARAMS = new Set(['ParamEyeLOpen', 'ParamEyeROpen'])

const stageRef = ref(null)
const canvasRef = ref(null)
const canvasKey = ref(0)
const status = ref('loading')
const errorDetail = ref('')

const statusText = computed(() => {
  if (status.value === 'loading') return '加载中'
  if (status.value === 'ready') return '加载成功'
  return '加载失败'
})

let app = null
let model = null
let Live2DModel = null
let BreathParameterData = null
let resizeObserver = null
let destroyed = false
let loadSeq = 0

const control = {
  emotion: '平静',
  intensity: 0,
  mouth: 0,
}

function clamp01(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
}

function loadScript(src) {
  if (window.Live2DCubismCore) return Promise.resolve()
  const existing = document.querySelector('script[data-cubism-core]')
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.Live2DCubismCore) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Cubism Core 加载失败')), { once: true })
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.cubismCore = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Cubism Core 加载失败'))
    document.head.appendChild(script)
  })
}

async function ensureRuntime() {
  await loadScript(CUBISM_CORE_URL)
  if (!window.Live2DCubismCore) {
    throw new Error('Cubism Core 未就绪')
  }
  window.PIXI = PIXI
  if (!Live2DModel) {
    const mod = await import('pixi-live2d-display/cubism4')
    Live2DModel = mod.Live2DModel
    BreathParameterData = mod.BreathParameterData
    Live2DModel.registerTicker(PIXI.Ticker)
  }
}

async function resolveModelUrl() {
  const candidates = [MODEL_URL, FALLBACK_MODEL_URL]
  let lastError = null
  for (const url of candidates) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        lastError = new Error(`模型资源不可用（${response.status}）`)
        continue
      }
      const json = await response.json()
      if (!json?.FileReferences?.Moc) {
        lastError = new Error('模型描述文件无效')
        continue
      }
      return url
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('模型资源不可用')
}

function setCoreParam(id, value) {
  const core = model?.internalModel?.coreModel
  if (!core) return
  core.setParameterValueById(id, value)
}

function applyControls() {
  const core = model?.internalModel?.coreModel
  if (!core) return
  const params = getEmotionParams(control.emotion, control.intensity)
  for (const [id, value] of Object.entries(params)) {
    if (EYE_OPEN_PARAMS.has(id)) {
      const blinked = core.getParameterValueById(id)
      core.setParameterValueById(id, blinked * value)
    } else {
      setCoreParam(id, value)
    }
  }
  setCoreParam('ParamMouthOpenY', control.mouth)
  const phase = (performance.now() / 1000) * Math.PI * 2
  setCoreParam('ParamAngleX', Math.sin(phase / 6.5345) * 4)
  setCoreParam('ParamAngleY', Math.sin(phase / 3.5345) * 2)
  setCoreParam('ParamAngleZ', Math.sin(phase / 5.5345) * 2.5)
}

function enableIdleMotion() {
  const internal = model.internalModel
  if (!internal) return
  if (internal.breath && BreathParameterData) {
    internal.breath.setParameters([
      new BreathParameterData(internal.idParamBodyAngleX, 0, 2, 15.5345, 0.5),
      new BreathParameterData(internal.idParamBreath, 0, 0.5, 3.2345, 0.5),
    ])
  }
  const motions = internal.motionManager?.definitions
  if (motions?.Idle?.length) {
    motions.Idle = [motions.Idle[0]]
    model.motion('Idle', 0)
  }
}

function fitModel() {
  if (!app || !model) return
  const width = app.screen.width
  const height = app.screen.height
  if (width < 2 || height < 2) return
  const sourceWidth = model.internalModel?.width || model.width || 1
  const sourceHeight = model.internalModel?.height || model.height || 1
  const scale = Math.min(width / sourceWidth, height / sourceHeight) * 0.92
  model.anchor.set(0.5, 0.5)
  model.scale.set(scale)
  model.position.set(width / 2, height / 2)
}

function dispose() {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (model) {
    model.removeAllListeners?.()
    model.destroy?.()
    model = null
  }
  if (app) {
    app.destroy(false, { children: true })
    app = null
  }
}

async function loadModel() {
  const seq = ++loadSeq
  destroyed = false
  status.value = 'loading'
  errorDetail.value = ''
  dispose()
  canvasKey.value += 1
  await nextTick()
  if (seq !== loadSeq || destroyed) return

  const canvas = canvasRef.value
  const stage = stageRef.value
  if (!canvas || !stage) return

  try {
    await ensureRuntime()
    if (seq !== loadSeq || destroyed) return
    const modelUrl = await resolveModelUrl()
    if (seq !== loadSeq || destroyed) return

    app = new PIXI.Application({
      view: canvas,
      resizeTo: stage,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    })

    model = await Live2DModel.from(modelUrl, {
      autoInteract: false,
      crossOrigin: 'anonymous',
    })
    if (seq !== loadSeq || destroyed) {
      model.destroy()
      model = null
      dispose()
      return
    }

    model.internalModel.on('beforeModelUpdate', applyControls)
    app.stage.addChild(model)
    enableIdleMotion()
    fitModel()

    const onResize = () => {
      app?.resize?.()
      fitModel()
    }
    resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(stage)
    app.renderer.on('resize', fitModel)

    status.value = 'ready'
  } catch (error) {
    if (seq !== loadSeq || destroyed) return
    console.error(error)
    errorDetail.value = error?.message || '模型资源不可用'
    status.value = 'error'
    dispose()
  }
}

function setEmotion(type, intensity = 1) {
  control.emotion = normalizeEmotionType(type)
  control.intensity = clamp01(intensity)
  applyControls()
}

function setMouth(openValue) {
  control.mouth = clamp01(openValue)
  applyControls()
}

onMounted(() => {
  loadModel()
})

onUnmounted(() => {
  destroyed = true
  loadSeq += 1
  dispose()
})

defineExpose({
  setEmotion,
  setMouth,
  reload: loadModel,
})
</script>

<style scoped>
.live2d-stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 280px;
  overflow: hidden;
}

.live2d-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.live2d-status {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.86);
  color: #334155;
}

.live2d-status.loading {
  color: #1d4ed8;
}

.live2d-status.ready {
  color: #15803d;
}

.live2d-status.error {
  color: #b91c1c;
}

.live2d-retry {
  position: absolute;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  padding: 8px 16px;
  border: 0;
  border-radius: 8px;
  background: #2f6fed;
  color: #fff;
  cursor: pointer;
}
</style>
