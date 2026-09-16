const router = require('express').Router()
const pool = require('../db')

// ======================================================
// 新增一筆心情紀錄
// POST /mood-records
// ======================================================

router.post('/', async (req, res) => {
  const {
    petId,
    mood,
    behavior,
    confidence,
    aspectRatio,
    movement
  } = req.body

  if (!petId || !mood) {
    return res.status(400).json({
      success: false,
      error: '缺少 petId 或 mood'
    })
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO pet_mood_records (
        pet_id,
        mood,
        behavior,
        confidence,
        aspect_ratio,
        movement
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        petId,
        mood,
        behavior || null,
        confidence ?? null,
        aspectRatio ?? null,
        movement ?? null
      ]
    )

    console.log(
      '🐱 已儲存心情：',
      mood,
      '| pet:',
      petId
    )

    res.json({
      success: true,
      data: result.rows[0]
    })

  } catch (err) {
    console.error(
      '儲存心情失敗：',
      err
    )

    res.status(500).json({
      success: false,
      error: '無法儲存心情紀錄'
    })
  }
})


// ======================================================
// 取得某隻寵物心情紀錄
// GET /mood-records/pet/:petId
// ======================================================

router.get('/pet/:petId', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM pet_mood_records
      WHERE pet_id = $1
      ORDER BY recorded_at DESC
      LIMIT 200
      `,
      [req.params.petId]
    )

    res.json({
      success: true,
      data: result.rows
    })

  } catch (err) {
    console.error(
      '取得心情紀錄失敗：',
      err
    )

    res.status(500).json({
      success: false,
      error: '無法取得心情紀錄'
    })
  }
})


module.exports = router