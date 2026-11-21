import { useState, useRef, useEffect, useMemo } from "react";
import { useAuthStore } from '../store/authStore'

const ICON = {
  paw: <><ellipse cx="7" cy="8" rx="2" ry="2.4" /><ellipse cx="12" cy="5.8" rx="2" ry="2.4" /><ellipse cx="17" cy="8" rx="2" ry="2.4" /><path d="M12 11c-3 0-5.5 2.2-5.5 4.8 0 1.7 1.4 2.9 3 2.9 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c1.6 0 3-1.2 3-2.9C17.5 13.2 15 11 12 11Z" /></>,
  camera: <><path d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4Z" /><circle cx="12" cy="13" r="3.5" /></>,
  shutter: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 17.5h2" /></>,
  upload: <><path d="M12 16V4M8 8l4-4 4 4" /><path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  spark: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" /><path d="M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M4.5 17l4.5-4 3.5 3 3-2.5 4 3.5" /></>,
  alert: <><path d="M12 4.5 21 19.5H3L12 4.5Z" /><path d="M12 10v4M12 17h.01" /></>
}

function LineIcon({ name, size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {ICON[name] || ICON.paw}
    </svg>
  )
}

const actionClass =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e8d9bd] bg-[#faf7ef] px-4 py-2.5 text-sm font-bold text-pine-800 transition-colors hover:border-pine-700/30 hover:bg-[#fdf6ea] disabled:opacity-50'

const primaryClass =
  'inline-flex w-full max-w-md items-center justify-center gap-2 rounded-xl bg-[#f5c04a] px-5 py-3 text-sm font-extrabold text-pine-900 shadow-[0_4px_0_#c96f2e] transition-all hover:bg-[#f0b23a] active:translate-y-[3px] active:shadow-none disabled:opacity-50'

export default function PetEmotion({ embedded = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 照片預覽：用推導產生網址，effect 只負責釋放，避免在 effect 內 setState
  const preview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : ""),
    [photo]
  );

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  // 離開頁面時關閉攝影機
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(
        (track) => track.stop()
      );
    };
  }, []);

  // 開啟電腦攝影機
  async function openCamera() {
    setError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("瀏覽器不支援攝影機");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraOn(true);
    } catch {
      closeCamera();
      setError("無法開啟攝影機，請檢查攝影機權限或 HTTPS");
    }
  }

  // 關閉攝影機
  function closeCamera() {
    streamRef.current?.getTracks().forEach(
      (track) => track.stop()
    );

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOn(false);
  }

  // 電腦攝影機拍照
  function takePhoto() {
    const video = videoRef.current;

    if (!video || !video.videoWidth) {
      setError("攝影機尚未準備完成");
      return;
    }

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) {
        setError("拍照失敗");
        return;
      }

      const file = new File([blob], "pet.jpg", {
        type: "image/jpeg"
      });

      setPhoto(file);
      setResult("");
      setError("");
      closeCamera();
    }, "image/jpeg", 0.8);
  }

  // 手機拍照 / 上傳照片
  function uploadPhoto(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowed.includes(file.type)) {
      setError("請使用 JPG、PNG 或 WebP 圖片");
      event.target.value = "";
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setError("照片不可超過 3 MB");
      event.target.value = "";
      return;
    }

    closeCamera();
    setPhoto(file);
    setResult("");
    setError("");

    event.target.value = "";
  }

  // AI 心情分析
  async function analyze() {
    if (!photo) {
      setError("請先拍照或上傳照片");
      return;
    }

    if (loading) return;

    setLoading(true);
    setResult("");
    setError("");

    const formData = new FormData();
    formData.append("photo", photo);

    try {
      const apiUrl =
        (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

      const token = useAuthStore.getState().token

      const response = await fetch(
        `${apiUrl}/api/pet-emotion`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        }
      )

      if (!response.ok) {
        throw new Error(`API 錯誤：${response.status}`);
      }

      const data = await response.json();

      if (!data.analysis) {
        throw new Error("AI 沒有回傳分析結果");
      }

      setResult(data.analysis);
    } catch (err) {
      console.error(err);
      setError("AI 分析失敗，請確認後端 API 已啟動");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={embedded ? 'p-5 sm:p-6' : 'min-h-screen bg-paper p-4 font-sans sm:p-6'}>
      <div className="mx-auto max-w-3xl rounded-3xl border border-[#f3e3cd] bg-plate p-5 shadow-[0_20px_50px_-30px_rgba(87,54,17,0.45)] sm:p-6">
        {/* 放在健康諮詢頁時，上方已經有標題列，這裡就不重複 */}
        {!embedded && (
          <div className="mb-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-pine-800 text-[#f5c04a]">
              <LineIcon name="paw" size={24} />
            </span>
            <h1 className="mt-3 font-brand text-xl font-extrabold text-pine-900">
              AI 寵物心情辨識
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              拍攝或上傳寵物照片，讓 AI 分析牠可能的心情
            </p>
          </div>
        )}

        {/* 電腦攝影機畫面 */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`mx-auto w-full max-w-xl rounded-2xl bg-pine-900 ${cameraOn ? 'block' : 'hidden'}`}
        />

        {/* 拍照及上傳功能 */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {!cameraOn ? (
            <button
              type="button"
              className={actionClass}
              onClick={openCamera}
              disabled={loading}
            >
              <LineIcon name="camera" size={16} />
              開啟攝影機
            </button>
          ) : (
            <>
              <button
                type="button"
                className={actionClass}
                onClick={takePhoto}
              >
                <LineIcon name="shutter" size={16} />
                拍照
              </button>

              <button
                type="button"
                className={actionClass}
                onClick={closeCamera}
              >
                <LineIcon name="close" size={15} />
                關閉攝影機
              </button>
            </>
          )}

          <label className={actionClass}>
            <LineIcon name="phone" size={15} />
            手機拍照
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={uploadPhoto}
              disabled={loading}
              className="hidden"
            />
          </label>

          <label className={actionClass}>
            <LineIcon name="upload" size={15} />
            上傳照片
            <input
              type="file"
              accept="image/*"
              onChange={uploadPhoto}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>

        {/* 照片預覽 */}
        {preview && (
          <div className="mt-6 text-center">
            <p className="mb-2 flex items-center justify-center gap-1.5 text-sm font-bold text-pine-900">
              <LineIcon name="image" size={15} />
              寵物照片
            </p>

            <img
              src={preview}
              alt="寵物照片"
              className="mx-auto w-full max-w-md rounded-2xl border border-[#f0e6d2]"
            />
          </div>
        )}

        {/* AI 分析按鈕 */}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={analyze}
            disabled={loading || !photo}
            className={primaryClass}
          >
            <LineIcon name={loading ? 'camera' : 'spark'} size={17} />
            {loading ? 'AI 正在分析…' : '開始 AI 心情分析'}
          </button>
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-[#b4552f]">
            <LineIcon name="alert" size={14} />
            {error}
          </p>
        )}

        {/* AI 分析結果 */}
        {result && (
          <div className="mt-6 rounded-2xl border border-pine-100 bg-pine-50/60 p-5 text-left">
            <h2 className="flex items-center gap-2 text-sm font-bold text-pine-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-plate text-pine-700">
                <LineIcon name="paw" size={17} />
              </span>
              AI 心情分析結果
            </h2>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {result}
            </p>

            <p className="mt-4 text-xs text-ink-soft">
              提醒：AI 僅根據照片中的外觀與姿勢推測，無法確定寵物的真實情緒。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
