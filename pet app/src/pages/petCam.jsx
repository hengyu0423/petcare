import React, { useState, useEffect } from 'react'

export default function PetCam() {
  const [status, setStatus] = useState({
    behavior: '讀取中...',
    mood: '讀取中...',
    confidence: 0,
    aspectRatio: 0,
    movement: 0
  })

  const [cameraError, setCameraError] = useState(false)

  // ==============================
  // 每秒取得目前辨識狀態
  // ==============================
  useEffect(() => {
    const fetchStatus = () => {
      fetch('http://localhost:8000/status')
        .then(res => res.json())
        .then(data => {
          setStatus(data)
        })
        .catch(err => {
          console.error('取得狀態失敗：', err)
        })
    }

    // 一進頁面先抓一次
    fetchStatus()

    // 之後每秒更新
    const timer = setInterval(fetchStatus, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="w-full min-h-full flex flex-col items-center bg-gray-50 py-6 px-4">

      {/* 標題 */}
      <h2 className="text-base font-medium text-gray-700 mb-3 tracking-wide">
        寵物即時監控
      </h2>


      <div className="w-full max-w-[620px] flex flex-col items-center gap-4">

        {/* ==============================
            即時攝影機畫面
        ============================== */}
        <div className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200">

          <div className="w-full bg-black min-h-[350px] flex items-center justify-center">

            {!cameraError ? (
              <img
                src="http://localhost:8000/video_feed"
                alt="寵物即時監控"
                className="w-full max-h-[600px] object-contain"
                onLoad={() => setCameraError(false)}
                onError={() => setCameraError(true)}
              />
            ) : (
              <div className="text-center py-16">
                <p className="text-white text-sm">
                  📷 無法載入攝影機畫面
                </p>

                <p className="text-gray-400 text-xs mt-2">
                  請確認 Python 攝影機服務是否正在運作
                </p>
              </div>
            )}

          </div>

        </div>


        {/* ==============================
            行為 / 心情
        ============================== */}
        <div className="grid grid-cols-2 gap-4 w-full">

          {/* 行為 */}
          <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-4 text-center">

            <p className="text-xs font-semibold text-sky-600 mb-1">
              當前姿態行為
            </p>

            <p className="text-base font-bold text-gray-800">
              {status.behavior}
            </p>

          </div>


          {/* 心情 */}
          <div className="bg-pink-50/60 border border-pink-100 rounded-2xl p-4 text-center">

            <p className="text-xs font-semibold text-pink-600 mb-1">
              貓咪心情推估
            </p>

            <p className="text-base font-bold text-gray-800">
              {status.mood}
            </p>

          </div>

        </div>


        {/* ==============================
            詳細數值
        ============================== */}
        <p className="text-xs text-gray-400 text-center tracking-wide">

          辨識信心度：
          {status.confidence}%

          {' | '}

          身體長寬比：
          {status.aspectRatio}

          {' | '}

          移動量：
          {status.movement}

        </p>


        {/* ==============================
            攝影機連線狀態
        ============================== */}
        <div className="flex items-center justify-center gap-2">

          <span
            className={`w-2 h-2 rounded-full ${
              status.cameraConnected
                ? 'bg-green-500'
                : 'bg-red-500'
            }`}
          />

          <span className="text-xs text-gray-400">

            {status.cameraConnected
              ? '攝影機連線正常'
              : '攝影機未連線'}

          </span>

        </div>

      </div>

    </div>
  )
}