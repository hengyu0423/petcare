import os
import queue
import time
import threading
from datetime import datetime

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
CAMERA_ID = os.environ.get("PET_CAM_ID", "cam2")
ABSENCE_COOLDOWN = 5.0  # 貓離開畫面超過 5 秒後，下次再進入才算新的一次
STATS_REFRESH_SECONDS = 10  # 多久跟後端同步一次今日統計

# ==========================================
# 2. 後端同步
#
# 進入 → POST /api/litter-box/enter   （後端建立一筆紀錄）
# 離開 → POST /api/litter-box/leave   （後端補上離開時間與停留秒數）
#
# 用單一 worker + queue 依序送出，確保 enter 一定比 leave 先到後端。
# ==========================================

_request_queue = queue.Queue()


def _worker():
    while True:
        path, payload = _request_queue.get()
        try:
            requests.post(
                f"{PET_API_URL}{path}",
                json=payload,
                timeout=2.0
            )
        except Exception:
            # 後端尚未開啟時略過錯誤，確保監控視窗不卡頓
            pass
        finally:
            _request_queue.task_done()


threading.Thread(target=_worker, daemon=True).start()


def now_iso():
    # 帶時區的 ISO 時間，後端直接存進 timestamptz，不會有時差問題
    return datetime.now().astimezone().isoformat()


def post_enter():
    _request_queue.put((
        "/api/litter-box/enter",
        {
            "cameraId": CAMERA_ID,
            "petType": "cat",
            "enteredAt": now_iso()
        }
    ))


def post_leave():
    _request_queue.put((
        "/api/litter-box/leave",
        {
            "cameraId": CAMERA_ID,
            "exitedAt": now_iso()
        }
    ))


# 今日統計（由背景執行緒定期更新，只拿來顯示）
today_stats = {
    "catCount": 0,
    "urine24h": 0,
    "poop24h": 0,
    "isPresent": False,
    "level": "unknown"
}
stats_lock = threading.Lock()


def refresh_stats():
    try:
        res = requests.get(
            f"{PET_API_URL}/api/litter-box",
            params={"cameraId": CAMERA_ID},
            timeout=1.5
        )
        data = res.json()
        assessment = data.get("assessment") or {}
        with stats_lock:
            today_stats["catCount"] = data.get("catCount", 0)
            today_stats["urine24h"] = data.get("urine24h", 0)
            today_stats["poop24h"] = data.get("poop24h", 0)
            today_stats["isPresent"] = data.get("isPresent", False)
            today_stats["level"] = assessment.get("label", "unknown")
    except Exception:
        pass


def stats_loop():
    while True:
        refresh_stats()
        time.sleep(STATS_REFRESH_SECONDS)


def send_leave_sync():
    # 離開程式時同步送出一次，避免資料庫留下一筆永遠開著的紀錄
    try:
        requests.post(
            f"{PET_API_URL}/api/litter-box/leave",
            json={"cameraId": CAMERA_ID, "exitedAt": now_iso()},
            timeout=2.0
        )
    except Exception:
        pass


# ==========================================
# 3. 載入 YOLO 模型與初始化今日計數
# ==========================================
print("正在載入 YOLO 模型...")
print(f"模型載入完成！執行裝置：{model.device}")

current_date = time.strftime("%Y-%m-%d")
cat_present = False
last_seen_time = 0.0

# 啟動時先跟後端拿今天的次數與停留時間（資料庫統計，重啟不會歸零）
refresh_stats()
threading.Thread(target=stats_loop, daemon=True).start()

# ==========================================
# 4. 連線攝影機並開啟即時辨識視窗
# ==========================================
window_name = "Tapo C210 (Q: Quit | R: Refresh)"

cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
cv2.resizeWindow(window_name, 960, 540)

cap = cv2.VideoCapture(CAMERA_SOURCE, cv2.CAP_FFMPEG)
# 減少緩衝區延遲，讓畫面更即時
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

print(
    f"正在連線至 Tapo C210 串流...（日期：{current_date}｜"
    f"今日累計：{today_stats['catCount']} 次）"
)

while True:
    # 檢查是否跨日（過午夜 00:00 顯示自動歸零；資料庫以日期分開統計）
    today = time.strftime("%Y-%m-%d")
    if today != current_date:
        current_date = today
        cat_present = False
        print(f"新的一天 ({current_date})，今日統計重新開始！")

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
            print(f"[{current_date}] 偵測到貓咪進入！")
            post_enter()
    else:
        if cat_present and (current_time - last_seen_time > ABSENCE_COOLDOWN):
            cat_present = False
            print("貓咪已離開鏡頭範圍")
            post_leave()

    # 將辨識結果（框框、類別名稱、信心度）畫在畫面上
    annotated_frame = results[0].plot()

    # 在畫面左上角顯示今日次數（尿尿／大便分開）與目前的評估
    with stats_lock:
        count = today_stats["catCount"]
        urine = today_stats["urine24h"]
        poop = today_stats["poop24h"]
        level = today_stats["level"]

    status_text = (
        f"[{current_date}] Count: {count} | "
        f"Pee: {urine} | Poop: {poop} | "
        f"{'In View' if cat_present else 'Away'}"
    )

    cv2.rectangle(annotated_frame, (10, 10), (760, 50), (0, 0, 0), -1)
    cv2.putText(
        annotated_frame,
        status_text,
        (20, 38),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 0) if cat_present else (200, 200, 200),
        2
    )

    cv2.putText(
        annotated_frame,
        f"Excretion: {level}",
        (20, 78),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (0, 200, 255),
        2
    )

    # 顯示在視窗中
    cv2.imshow(window_name, annotated_frame)

    # 按鍵控制：'q' / 'ESC' 結束程式，'r' 重新整理今日統計
    key = cv2.waitKey(1) & 0xFF
    if key == ord("q") or key == 27:
        # 貓還在畫面裡就離開程式時，補送一次 leave，避免留下開著的紀錄
        if cat_present:
            send_leave_sync()
        print("結束監控程式")
        break
    elif key == ord("r"):
        refresh_stats()
        with stats_lock:
            print(
                f"已重新整理：尿尿 {today_stats['urine24h']} 次、"
                f"大便 {today_stats['poop24h']} 次，"
                f"排泄狀況：{today_stats['level']}"
            )

cap.release()
cv2.destroyAllWindows()
