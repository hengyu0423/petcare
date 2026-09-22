const express = require('express')
const router = express.Router()
const pool = require('../db')

// 新增通知
router.post('/', async (req, res) => {
  try {
    const {
      petId,
      type,
      title,
      message,
      severity = 'info',
      metadata = {}
    } = req.body

    if (!petId || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: '缺少必要資料'
      })
    }

    const petResult = await pool.query(
      'SELECT owner_id FROM pets WHERE id = $1',
      [petId]
    )

    if (petResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到寵物'
      })
    }

    const userId = petResult.rows[0].owner_id

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '此寵物沒有對應的使用者'
      })
    }

    const result = await pool.query(`
      INSERT INTO notifications
      (
        user_id,
        pet_id,
        type,
        title,
        message,
        severity,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
    `, [
      userId,
      petId,
      type,
      title,
      message,
      severity,
      JSON.stringify(metadata)
    ])

    res.status(201).json({
      success: true,
      notification: result.rows[0]
    })
  } catch (err) {
    console.error('新增通知失敗：', err)
    res.status(500).json({
      success: false,
      message: '新增通知失敗'
    })
  }
})

// 取得通知
router.get('/', async (req, res) => {
  try {
    const petId = req.query.petId
      ? Number(req.query.petId)
      : null

    const result = await pool.query(`
      SELECT
        n.id,
        n.user_id AS "userId",
        n.pet_id AS "petId",
        p.name AS "petName",
        n.type,
        n.title,
        n.message,
        n.severity,
        n.is_read AS "isRead",
        n.read_at AS "readAt",
        n.event_at AS "eventAt",
        n.created_at AS "createdAt",
        n.metadata
      FROM notifications n
      LEFT JOIN pets p ON p.id = n.pet_id
      WHERE ($1::integer IS NULL OR n.pet_id = $1)
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [petId])

    res.json({
      success: true,
      notifications: result.rows
    })
  } catch (err) {
    console.error('取得通知失敗：', err)
    res.status(500).json({
      success: false,
      message: '取得通知失敗'
    })
  }
})

// 未讀數量
router.get('/unread-count', async (req, res) => {
  try {
    const petId = req.query.petId
      ? Number(req.query.petId)
      : null

    const result = await pool.query(`
      SELECT COUNT(*)::integer AS count
      FROM notifications
      WHERE is_read = FALSE
        AND ($1::integer IS NULL OR pet_id = $1)
    `, [petId])

    res.json({
      success: true,
      count: result.rows[0].count
    })
  } catch (err) {
    console.error('取得未讀數量失敗：', err)
    res.status(500).json({
      success: false,
      message: '取得未讀數量失敗'
    })
  }
})

// 單筆已讀
router.patch('/:id/read', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE notifications
      SET
        is_read = TRUE,
        read_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到通知'
      })
    }

    res.json({
      success: true,
      notification: result.rows[0]
    })
  } catch (err) {
    console.error('更新通知失敗：', err)
    res.status(500).json({
      success: false,
      message: '更新通知失敗'
    })
  }
})

// 全部已讀
router.patch('/read-all', async (req, res) => {
  try {
    const petId = req.body.petId
      ? Number(req.body.petId)
      : null

    const result = await pool.query(`
      UPDATE notifications
      SET
        is_read = TRUE,
        read_at = NOW()
      WHERE is_read = FALSE
        AND ($1::integer IS NULL OR pet_id = $1)
      RETURNING id
    `, [petId])

    res.json({
      success: true,
      updated: result.rowCount
    })
  } catch (err) {
    console.error('全部已讀失敗：', err)
    res.status(500).json({
      success: false,
      message: '全部已讀失敗'
    })
  }
})

module.exports = router