import os
import time
import threading
import cv2
import requests
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

# Node.js 後端 API 網址與防誤判冷卻秒數
PET_API_URL = os.environ.get("PET_API_URL", "http://localhost:4000")
ABSENCE_COOLDOWN = 5.0  # 貓離開畫面超過 5 秒後，下次再進入才算新的一次

# ==========================================
# 2. 後端同步與日期工具函式
# ==========================================
def get_today_str():
    return time.strftime("%Y-%m-%d")

def send_cat_count_to_backend(count, is_present, date_str):
    def _post():
        try:
            requests.post(
                f"{PET_API_URL}/api/cat-count",
                json={
                    "camera": "cam2",
                    "catCount": count,
                    "isPresent": is_present,
                    "date": date_str,
                    "timestamp": time.strftime("%H:%M:%S")
                },
                timeout=1.5
            )
        except Exception:
            # 後端尚未開啟時略過錯誤，確保監控視窗不卡頓
            pass

    threading.Thread(target=_post, daemon=True).start()

def fetch_initial_count(today_str):
    try:
        res = requests.get(f"{PET_API_URL}/api/cat-count", timeout=1.5)
        data = res.json()
        if data.get("date") == today_str:
            return data.get("catCount", 0)
    except Exception:
        pass
    return 0

# ==========================================
# 3. 載入 YOLO 模型與初始化今日計數
# ==========================================
print("正在載入 YOLO 模型...")
print(f"模型載入完成！執行裝置：{model.device}")

current_date = get_today_str()
cat_count = fetch_initial_count(current_date)
cat_present = False
last_seen_time = 0.0

# 啟動時先與後端同步一次今日狀態
send_cat_count_to_backend(cat_count, False, current_date)

# ==========================================
# 4. 連線攝影機並開啟即時辨識視窗
# ==========================================
window_name = "Tapo C210 (Q: Quit | R: Reset)"
cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
cv2.resizeWindow(window_name, 960, 540)

cap = cv2.VideoCapture(CAMERA_SOURCE, cv2.CAP_FFMPEG)
# 減少緩衝區延遲，讓畫面更即時
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

print(f"正在連線至 Tapo C210 串流...（日期：{current_date}｜今日累計：{cat_count} 次）")

while True:
    # 檢查是否跨日（過午夜 00:00 自動重置計數）
    today = get_today_str()
    if today != current_date:
        current_date = today
        cat_count = 0
        cat_present = False
        print(f"新的一天 ({current_date})，寵物進出次數已自動歸零！")
        send_cat_count_to_backend(cat_count, False, current_date)

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

    # 判斷目前畫面是否有偵測到貓 (class 0 = cats)
    detected_classes = results[0].boxes.cls.tolist() if results[0].boxes is not None else []
    has_cat_now = (0 in detected_classes)
    current_time = time.time()

    if has_cat_now:
        last_seen_time = current_time
        if not cat_present:
            cat_present = True
            cat_count += 1
            print(f"[{current_date}] 偵測到貓咪進入！今日累計次數：{cat_count}")
            send_cat_count_to_backend(cat_count, True, current_date)
    else:
        if cat_present and (current_time - last_seen_time > ABSENCE_COOLDOWN):
            cat_present = False
            print("貓咪已離開鏡頭範圍")
            send_cat_count_to_backend(cat_count, False, current_date)

    # 將辨識結果（框框、類別名稱、信心度）畫在畫面上
    annotated_frame = results[0].plot()

    # 在畫面左上角顯示今日日期與累計次數
    status_text = f"[{current_date}] Cat Count: {cat_count} | {'In View' if cat_present else 'Away'}"
    cv2.rectangle(annotated_frame, (10, 10), (500, 50), (0, 0, 0), -1)
    cv2.putText(
        annotated_frame,
        status_text,
        (20, 38),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 0) if cat_present else (200, 200, 200),
        2
    )

    # 顯示在視窗中
    cv2.imshow(window_name, annotated_frame)

    # 按鍵控制：'q' / 'ESC' 結束程式，'r' 手動歸零次數
    key = cv2.waitKey(1) & 0xFF
    if key == ord("q") or key == 27:
        print("結束監控程式")
        break
    elif key == ord("r"):
        cat_count = 0
        cat_present = False
        send_cat_count_to_backend(cat_count, False, current_date)
        print("今日次數已手動歸零")

cap.release()
cv2.destroyAllWindows()