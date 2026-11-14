import os
import time
import cv2
from ultralytics import YOLO

# 強制 RTSP 使用 TCP 傳輸，配合路由器設定並避免跨網路畫面花屏或斷線
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

# ==========================================
# 1. 基本設定
# ==========================================
CAMERA_SOURCE = "rtsp://nigelchen:Nigel123@nigel-petcam.asuscomm.com:8554/stream2"

model = YOLO("./runs/petv1/weights/best.pt")

# 類別設定：0 = cats, 1 = dogs
PET_CLASSES = [0, 1]

CONF_THRESHOLD = 0.45

# ==========================================
# 2. 載入 YOLO 模型
# ==========================================
print("正在載入 YOLO 模型...")
print(f"模型載入完成！執行裝置：{model.device}")

# ==========================================
# 3. 連線攝影機並開啟即時辨識視窗
# ==========================================
window_name = "Tapo C210(Press Q to Quit)"
cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
cv2.resizeWindow(window_name, 960, 540)

cap = cv2.VideoCapture(CAMERA_SOURCE, cv2.CAP_FFMPEG)
# 減少緩衝區延遲，讓畫面更即時
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

print("正在連線至 Tapo C210 串流...")

while True:
    ret, frame = cap.read()

    # 若跨網路連線暫時中斷，自動嘗試重新連線
    if not ret or frame is None:
        print("暫時無法取得畫面，2 秒後嘗試重新連線...")
        cap.release()
        time.sleep(2)
        cap = cv2.VideoCapture(CAMERA_SOURCE, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        continue

    # 進行 YOLO 影像辨識（只偵測 cats 與 dogs）
    results = model.predict(
        source=frame,
        classes=PET_CLASSES,
        conf=CONF_THRESHOLD,
        verbose=False
    )

    # 將辨識結果（框框、類別名稱、信心度）畫在畫面上
    annotated_frame = results[0].plot()

    # 顯示在視窗中
    cv2.imshow(window_name, annotated_frame)

    # 按下鍵盤 'q' 或 'ESC' 鍵結束程式
    key = cv2.waitKey(1) & 0xFF
    if key == ord("q") or key == 27:
        print("結束監控程式")
        break

cap.release()
cv2.destroyAllWindows()