// ======================================================
// 每日熱量建議範圍（Nutrition Targets）
//
// 老師要求不要只顯示單一建議數字，而是同時顯示：
//   建議值、最低值、最高值、實際攝取與判斷結果。
//
// 計算依據：
//   RER = 70 × 體重(kg)^0.75
//   DER = RER × 年齡／活動係數 × 目標調整
//   建議範圍 = DER 的 -20% ~ +10%
//
// 每次估算都會寫入 nutrition_targets，保留「當時」的體重與計算版本；
// 之後體重更新只會更新今天，不會改寫過去的判斷基準。
// ======================================================

const pool = require('../db')
const { estimateTargetKcal, sanitizePreferences } = require('./mealPlan')
const { ageInMonths } = require('../utils/petAge')

const TZ = process.env.APP_TIMEZONE || 'Asia/Taipei'
const FORMULA_VERSION = 'pawcare-der-v1'
const RANGE_LOW = 0.8
const RANGE_HIGH = 1.1

function toDateText(value) {
  return String(value || '').slice(0, 10)
}

function normalizeStored(row) {
  if (!row) return null

  return {
    date: toDateText(row.date),
    targetKcal: Number(row.target_kcal),
    minKcal: Number(row.min_kcal),
    maxKcal: Number(row.max_kcal),
    weightKg:
      row.weight_kg === null || row.weight_kg === undefined
        ? null
        : Number(row.weight_kg),
    formulaVersion: row.formula_version,
    basis: row.basis || {},
    source: 'stored'
  }
}

function weightForDate(base, date) {
  const cutoff = toDateText(date)
  const current = Number(base.pet.weight)

  let selected =
    Number.isFinite(current) && current > 0 ? current : null

  // weights 已依日期新到舊排序，第一個 <= 該日期的就是當時最新體重
  for (const row of base.weights) {
    if (toDateText(row.measured_on) <= cutoff) {
      const value = Number(row.weight)
      if (Number.isFinite(value) && value > 0) selected = value
      break
    }
  }

  return selected
}

async function loadTargetBase(petId) {
  const [petResult, weightsResult, healthResult] = await Promise.all([
    pool.query(
      `
      SELECT id, species, birth_date, weight, diet_preferences
      FROM pets
      WHERE id = $1
      `,
      [petId]
    ),

    pool.query(
      `
      SELECT
        weight::float AS weight,
        to_char(measured_on, 'YYYY-MM-DD') AS measured_on
      FROM pet_weight_records
      WHERE pet_id = $1
      ORDER BY measured_on DESC
      `,
      [petId]
    ),

    pool.query(
      `
      SELECT title, description
      FROM health_records
      WHERE pet_id = $1
        AND date >= (NOW() AT TIME ZONE $2::text)::date - 90
      `,
      [petId, TZ]
    )
  ])

  const pet = petResult.rows[0]
  if (!pet) return null

  const healthText = healthResult.rows
    .map(row => `${row.title || ''} ${row.description || ''}`)
    .join('\n')

  return {
    pet,
    prefs: sanitizePreferences(pet.diet_preferences),
    weights: weightsResult.rows,
    weightControl: /肥胖|過重/.test(healthText)
  }
}

function computeTargetForDate(base, date) {
  const weightKg = weightForDate(base, date)

  const ageMonths = base.pet.birth_date
    ? ageInMonths(base.pet.birth_date, date)
    : null

  const estimate = estimateTargetKcal({
    species: base.pet.species,
    weightKg,
    ageMonths,
    goal: base.prefs.goal,
    weightControl: base.weightControl
  })

  const common = {
    date: toDateText(date),
    weightKg,
    formulaVersion: FORMULA_VERSION,
    basis: {
      rer: estimate.rer ?? null,
      factor: estimate.factor ?? null,
      stage: estimate.stage ?? null,
      goal: estimate.goal ?? base.prefs.goal,
      rangeLow: RANGE_LOW,
      rangeHigh: RANGE_HIGH,
      note:
        'RER＝70×體重^0.75，再依年齡與目標估算 DER；' +
        '建議範圍為 DER 的 -20%～+10%，僅供參考，不是醫療處方。'
    }
  }

  if (estimate.kcal === null) {
    return {
      ...common,
      targetKcal: null,
      minKcal: null,
      maxKcal: null,
      reason: estimate.reason || 'unknown',
      source: 'computed'
    }
  }

  return {
    ...common,
    targetKcal: estimate.kcal,
    minKcal: Math.round(estimate.kcal * RANGE_LOW),
    maxKcal: Math.round(estimate.kcal * RANGE_HIGH),
    source: 'computed'
  }
}

async function persistTarget(petId, target, updateExisting) {
  if (!target || target.targetKcal === null) return

  const conflict = updateExisting
    ? `DO UPDATE SET
         weight_kg = EXCLUDED.weight_kg,
         target_kcal = EXCLUDED.target_kcal,
         min_kcal = EXCLUDED.min_kcal,
         max_kcal = EXCLUDED.max_kcal,
         formula_version = EXCLUDED.formula_version,
         basis = EXCLUDED.basis,
         updated_at = NOW()`
    : 'DO NOTHING'

  await pool.query(
    `
    INSERT INTO nutrition_targets
      (pet_id, target_date, weight_kg, target_kcal, min_kcal, max_kcal,
       formula_version, basis)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    ON CONFLICT (pet_id, target_date) ${conflict}
    `,
    [
      petId,
      target.date,
      target.weightKg,
      target.targetKcal,
      target.minKcal,
      target.maxKcal,
      target.formulaVersion,
      JSON.stringify(target.basis || {})
    ]
  )
}

/**
 * 取得多天的建議範圍。
 * - 已存在的歷史資料直接使用，不因體重更新而改變。
 * - 缺少資料的日期會用「該日期當時的體重」估算並保存。
 * - updateDate 通常是今天：今天允許跟著最新體重更新。
 */
async function getTargetsForDates(
  petId,
  dates,
  { updateDate = null } = {}
) {
  const uniqueDates = [
    ...new Set(dates.map(toDateText).filter(Boolean))
  ]

  if (uniqueDates.length === 0) return {}

  const base = await loadTargetBase(petId)
  if (!base) return {}

  const storedResult = await pool.query(
    `
    SELECT
      to_char(target_date, 'YYYY-MM-DD') AS date,
      target_kcal,
      min_kcal,
      max_kcal,
      weight_kg::float AS weight_kg,
      formula_version,
      basis
    FROM nutrition_targets
    WHERE pet_id = $1
      AND target_date = ANY($2::date[])
    `,
    [petId, uniqueDates]
  )

  const result = {}

  for (const row of storedResult.rows) {
    result[toDateText(row.date)] = normalizeStored(row)
  }

  const updateKey = updateDate ? toDateText(updateDate) : null

  for (const date of uniqueDates) {
    const computed = computeTargetForDate(base, date)

    if (computed.targetKcal === null) {
      if (!result[date]) result[date] = computed
      continue
    }

    const shouldUpdate = Boolean(updateKey && date === updateKey)

    if (!result[date] || shouldUpdate) {
      try {
        await persistTarget(petId, computed, shouldUpdate)
      } catch (err) {
        console.error('儲存每日熱量建議失敗：', err.message)
      }

      result[date] = computed
    }
  }

  return result
}

async function getTargetForDate(petId, date, options = {}) {
  const targets = await getTargetsForDates(petId, [date], options)
  return targets[toDateText(date)] || null
}

function rangeStatus(actualKcal, target) {
  if (
    actualKcal === null ||
    actualKcal === undefined ||
    !Number.isFinite(Number(actualKcal))
  ) {
    return 'no_data'
  }

  if (!target || target.targetKcal === null || target.targetKcal === undefined) {
    return 'no_target'
  }

  const actual = Number(actualKcal)

  if (actual < Number(target.minKcal)) return 'under'
  if (actual > Number(target.maxKcal)) return 'over'
  return 'in_range'
}

module.exports = {
  FORMULA_VERSION,
  RANGE_LOW,
  RANGE_HIGH,
  getTargetsForDates,
  getTargetForDate,
  rangeStatus
}
