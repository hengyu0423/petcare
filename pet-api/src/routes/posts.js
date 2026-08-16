const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')

router.use(requireAuth)

// 取得所有貼文
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        u.name as user_name,
        pt.name as pet_name,
        pt.species as pet_species,
        EXISTS(SELECT 1 FROM post_likes WHERE post_id=p.id AND user_id=$1) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN pets pt ON p.pet_id = pt.id
      ORDER BY p.created_at DESC
      LIMIT 50
    `, [req.userId])
    res.json({ success: true, data: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 新增貼文
router.post('/', async (req, res) => {
  const { content, imageUrl, petId } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO posts (user_id, content, image_url, pet_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.userId, content, imageUrl || null, petId || null]
    )
    const post = result.rows[0]
    const user = await pool.query('SELECT name FROM users WHERE id=$1', [req.userId])
    res.json({ success: true, data: { ...post, user_name: user.rows[0].name } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 刪除貼文
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM posts WHERE id=$1 AND user_id=$2', [req.params.id, req.userId])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 按讚 / 取消按讚
router.post('/:id/like', async (req, res) => {
  const postId = req.params.id
  try {
    const existing = await pool.query(
      'SELECT id FROM post_likes WHERE post_id=$1 AND user_id=$2',
      [postId, req.userId]
    )
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [postId, req.userId])
      await pool.query('UPDATE posts SET likes_count = likes_count - 1 WHERE id=$1', [postId])
      res.json({ success: true, liked: false })
    } else {
      await pool.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2)', [postId, req.userId])
      await pool.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id=$1', [postId])
      res.json({ success: true, liked: true })
    }
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 取得留言
router.get('/:id/comments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, u.name as user_name
      FROM post_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id=$1
      ORDER BY c.created_at ASC
    `, [req.params.id])
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 新增留言
router.post('/:id/comments', async (req, res) => {
  const { content } = req.body
  try {
    const result = await pool.query(
      'INSERT INTO post_comments (post_id, user_id, content) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, req.userId, content]
    )
    await pool.query('UPDATE posts SET comments_count = comments_count + 1 WHERE id=$1', [req.params.id])
    const user = await pool.query('SELECT name FROM users WHERE id=$1', [req.userId])
    res.json({ success: true, data: { ...result.rows[0], user_name: user.rows[0].name } })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

// 刪除留言
router.delete('/:postId/comments/:commentId', async (req, res) => {
  try {
    await pool.query('DELETE FROM post_comments WHERE id=$1 AND user_id=$2', [req.params.commentId, req.userId])
    await pool.query('UPDATE posts SET comments_count = comments_count - 1 WHERE id=$1', [req.params.postId])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
})

module.exports = router