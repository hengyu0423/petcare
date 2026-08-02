const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ success: false, error: '未登入' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret')
    req.userId = payload.userId
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Token 無效' })
  }
}