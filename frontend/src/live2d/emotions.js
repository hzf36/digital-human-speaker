export const EMOTION_TYPES = ['平静', '开心', '严肃', '难过']

const CALM = {
  ParamMouthForm: 0,
  ParamEyeLSmile: 0,
  ParamEyeRSmile: 0,
  ParamBrowLY: 0,
  ParamBrowRY: 0,
  ParamBrowLX: 0,
  ParamBrowRX: 0,
  ParamBrowLAngle: 0,
  ParamBrowRAngle: 0,
  ParamBrowLForm: 0,
  ParamBrowRForm: 0,
  ParamEyeLOpen: 1,
  ParamEyeROpen: 1,
  ParamCheek: 0,
  ParamTere: 0,
}

const PRESETS = {
  平静: CALM,
  开心: {
    ParamMouthForm: 1,
    ParamEyeLSmile: 1,
    ParamEyeRSmile: 1,
    ParamBrowLY: 0.35,
    ParamBrowRY: 0.35,
    ParamBrowLX: 0,
    ParamBrowRX: 0,
    ParamBrowLAngle: -0.15,
    ParamBrowRAngle: 0.15,
    ParamBrowLForm: 0.25,
    ParamBrowRForm: 0.25,
    ParamEyeLOpen: 0.88,
    ParamEyeROpen: 0.88,
    ParamCheek: 0.6,
    ParamTere: 0.55,
  },
  严肃: {
    ParamMouthForm: -0.25,
    ParamEyeLSmile: 0,
    ParamEyeRSmile: 0,
    ParamBrowLY: -0.7,
    ParamBrowRY: -0.7,
    ParamBrowLX: 0,
    ParamBrowRX: 0,
    ParamBrowLAngle: 0.25,
    ParamBrowRAngle: -0.25,
    ParamBrowLForm: -0.45,
    ParamBrowRForm: -0.45,
    ParamEyeLOpen: 0.92,
    ParamEyeROpen: 0.92,
    ParamCheek: 0,
    ParamTere: 0,
  },
  难过: {
    ParamMouthForm: -0.85,
    ParamEyeLSmile: 0,
    ParamEyeRSmile: 0,
    ParamBrowLY: -0.25,
    ParamBrowRY: -0.25,
    ParamBrowLX: 0.15,
    ParamBrowRX: -0.15,
    ParamBrowLAngle: 0.7,
    ParamBrowRAngle: -0.7,
    ParamBrowLForm: 0.35,
    ParamBrowRForm: 0.35,
    ParamEyeLOpen: 0.72,
    ParamEyeROpen: 0.72,
    ParamCheek: 0,
    ParamTere: 0,
  },
}

const ALIASES = {
  calm: '平静',
  neutral: '平静',
  happy: '开心',
  smile: '开心',
  serious: '严肃',
  sad: '难过',
}

export function normalizeEmotionType(type) {
  if (type == null) return '平静'
  const key = String(type).trim()
  if (PRESETS[key]) return key
  return ALIASES[key] || '平静'
}

export function getEmotionParams(type, intensity = 1) {
  const name = normalizeEmotionType(type)
  const strength = Math.min(1, Math.max(0, Number(intensity) || 0))
  const target = PRESETS[name]
  const params = {}
  for (const id of Object.keys(CALM)) {
    params[id] = CALM[id] + (target[id] - CALM[id]) * strength
  }
  return params
}
