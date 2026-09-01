import React, { useState, useEffect } from 'react'

export default function PetCam() {
  const [status, setStatus] = useState({
    behavior: '休息中',
    mood: '放鬆慵懶',
    confidence: 86,
    aspectRatio: 2.23,
    movement: 1
  })


useEffect(() => {
    const timer = setInterval(() => {
      fetch('http://localhost:8000/status')
        .then(res => res.json())
        .then(data => setStatus(data))
        .catch(() => {})
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="w-full min-h-full flex flex-col items-center bg-gray-50 py-6 px-4">
      <h2 className="text-base font-medium text-gray-700 mb-3 tracking-wide">
        寵物即時監控
      </h2>

      <div className="w-full max-w-[620px] flex flex-col items-center gap-4">
        <div className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200">
          <img
            src="http://localhost:8000/video_feed"
            alt="寵物即時監控畫面"
            className="w-full aspect-[4/3] object-cover block"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-4 text-center">
            <p className="text-xs font-semibold text-sky-600 mb-1">
              當前姿態行為
            </p>
            <p className="text-base font-bold text-gray-800">
              {status.behavior}
            </p>
          </div>

          <div className="bg-pink-50/60 border border-pink-100 rounded-2xl p-4 text-center">
            <p className="text-xs font-semibold text-pink-600 mb-1">
              貓咪心情推估
            </p>
            <p className="text-base font-bold text-gray-800">
              {status.mood}
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center tracking-wide">
          辨識信心度：{status.confidence}% | 身體長寬比：{status.aspectRatio} | 移動量：{status.movement}
        </p>
      </div>
    </div>
  )
}