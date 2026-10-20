import { useState, useRef, useEffect } from "react";
import { useAuthStore } from '../store/authStore'

export default function PetEmotion({ embedded = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 照片預覽
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }

    const url = URL.createObjectURL(photo);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [photo]);

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
    } catch (err) {
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

  // 共用按鈕樣式
  const buttonStyle = {
    padding: "12px 20px",
    border: "none",
    borderRadius: "10px",
    background: "#7799ca",
    color: "white",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "bold"
  };

  const uploadStyle = {
    ...buttonStyle,
    display: "inline-block",
    textAlign: "center"
  };

  return (
    <div style={embedded ? {
      // 放在健康諮詢頁右側時：高度跟著內容、背景交給外層，不要再自己撐滿整個畫面
      padding: "20px 15px",
      fontFamily: "inherit"
    } : {
      minHeight: "100vh",
      background: "#f5f7fb",
      padding: "30px 15px",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        maxWidth: "750px",
        margin: "auto",
        background: "white",
        padding: "30px 20px",
        borderRadius: "20px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.08)"
      }}>

        {/* 放在健康諮詢頁時，上方已經有標題列，這裡就不重複 */}
        {!embedded && (
          <>
            <h1 style={{
              textAlign: "center",
              color: "#45618a"
            }}>
              🐾 AI 寵物心情辨識
            </h1>

            <p style={{
              textAlign: "center",
              color: "#777"
            }}>
              拍攝或上傳寵物照片，
              讓 AI 分析牠可能的心情
            </p>
          </>
        )}

        {/* 電腦攝影機畫面 */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            display: cameraOn ? "block" : "none",
            width: "100%",
            maxWidth: "550px",
            margin: "20px auto",
            borderRadius: "15px",
            background: "#222"
          }}
        />

        {/* 拍照及上傳功能 */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "12px",
          marginTop: "25px"
        }}>

          {/* 電腦攝影機 */}
          {!cameraOn ? (
            <button
              style={buttonStyle}
              onClick={openCamera}
              disabled={loading}
            >
              💻 開啟攝影機
            </button>
          ) : (
            <>
              <button
                style={buttonStyle}
                onClick={takePhoto}
              >
                📸 拍照
              </button>

              <button
                style={{
                  ...buttonStyle,
                  background: "#999"
                }}
                onClick={closeCamera}
              >
                關閉攝影機
              </button>
            </>
          )}

          {/* 手機拍照 */}
          <label style={uploadStyle}>
            📱 手機拍照
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={uploadPhoto}
              disabled={loading}
              style={{ display: "none" }}
            />
          </label>

          {/* 上傳圖片 */}
          <label style={uploadStyle}>
            📁 上傳照片
            <input
              type="file"
              accept="image/*"
              onChange={uploadPhoto}
              disabled={loading}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {/* 照片預覽 */}
        {preview && (
          <div style={{
            textAlign: "center",
            marginTop: "25px"
          }}>
            <h3>📷 寵物照片</h3>

            <img
              src={preview}
              alt="寵物照片"
              style={{
                width: "100%",
                maxWidth: "450px",
                borderRadius: "15px"
              }}
            />
          </div>
        )}

        {/* AI 分析按鈕 */}
        <div style={{
          textAlign: "center",
          marginTop: "25px"
        }}>
          <button
            onClick={analyze}
            disabled={loading || !photo}
            style={{
              ...buttonStyle,
              background: loading ? "#aaa" : "#667fc0",
              width: "100%",
              maxWidth: "450px",
              opacity: !photo ? 0.5 : 1
            }}
          >
            {loading
              ? "🤖 AI 正在分析..."
              : "✨ 開始 AI 心情分析"}
          </button>
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <p style={{
            color: "#d9534f",
            textAlign: "center",
            marginTop: "20px"
          }}>
            {error}
          </p>
        )}

        {/* AI 分析結果 */}
        {result && (
          <div style={{
            background: "#edf4ff",
            padding: "25px",
            borderRadius: "15px",
            marginTop: "30px",
            textAlign: "left"
          }}>
            <h2 style={{ color: "#45618a" }}>
              🐾 AI 心情分析結果
            </h2>

            <p style={{
              lineHeight: "1.9",
              whiteSpace: "pre-wrap",
              color: "#333"
            }}>
              {result}
            </p>

            <p style={{
              color: "#777",
              fontSize: "13px",
              marginTop: "20px"
            }}>
              提醒：AI 僅根據照片中的外觀與姿勢推測，
              無法確定寵物的真實情緒。
            </p>
          </div>
        )}

      </div>
    </div>
  );
}