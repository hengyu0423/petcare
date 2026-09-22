import os

# 一定要放在 import cv2 前面
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
os.environ["OPENCV_VIDEOIO_DEBUG"] = "1"

import cv2
import math
import time
import threading
import requests

from contextlib import asynccontextmanager
from collections import deque, Counter
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO


# =========================================================
# 基本設定
# =========================================================

# ⚠️ 這裡換成你真正的 RTSP 網址
# 不要把帳號密碼上傳到 GitHub
CAMERA_SOURCE = "rtsp://nigel1:nigel123@nigel-petcam.asuscomm.com:554/stream2"

# COCO:
# 15 = cat
# 16 = dog
PET_CLASSES = [15, 16]

# YOLO
model = YOLO("yolov8n.pt")

# Node.js API
PET_API_URL = "http://localhost:4000"

# ⚠️ 改成你 Neon pets 資料表裡這隻寵物的 id
PET_ID = 8


# =========================================================
# 行為紀錄 / 離開鏡頭設定
# =========================================================

# 每幾秒保存一次行為資料
# 一天的行為圖表不需要每一幀都存，60 秒一次就夠
MOOD_RECORD_INTERVAL_SECONDS = 60

# YOLO 偶爾會漏掉一兩幀，所以先容許幾秒
MISSING_GRACE_SECONDS = 5

# 連續多久沒有看到寵物才通知主人
MISSING_ALERT_MINUTES = 20

# 長時間未偵測後，重新出現時是否通知
NOTIFY_ON_REAPPEAR = True

# Node.js 通知 API
NOTIFICATION_API_URL = f"{PET_API_URL}/api/notifications"


# =========================================================
# 全域資料
# =========================================================

current_status = {
    "detected": False,
    "behavior": "讀取中...",
    "mood": "讀取中...",
    "confidence": 0,
    "aspectRatio": 0.0,
    "movement": 0,
    "lastSeenAt": None,
    "missingSince": None,
    "missingSeconds": 0,
    "missingMinutes": 0,
}

# 上一個位置
prev_center = None

# 最新攝影機畫面
latest_jpeg = None

# 攝影機狀態
camera_connected = False
camera_error = ""

# 行為 / 推測狀態歷史
# 60 秒一筆時，2000 筆約可保留 33 小時
mood_history = deque(maxlen=2000)

# 離開鏡頭 / 重新出現事件
presence_history = deque(maxlen=500)

# 上次行為紀錄時間
last_mood_record_time = None

# 最後一次看到寵物
last_seen_at = None

# 連續未偵測從何時開始
not_detected_since = None

# 此次未偵測事件是否已發過提醒
missing_alert_sent = False


# =========================================================
# Thread Lock
# =========================================================

frame_lock = threading.Lock()
status_lock = threading.Lock()
history_lock = threading.Lock()

stop_event = threading.Event()


# =========================================================
# 工具函式
# =========================================================

def iso_or_none(value):
    """datetime -> ISO 字串。"""
    return value.isoformat() if value else None


def format_duration(seconds):
    """把秒數轉成簡單中文時間文字。"""
    seconds = max(0, int(seconds))

    if seconds < 60:
        return f"{seconds} 秒"

    minutes = seconds // 60

    if minutes < 60:
        return f"{minutes} 分鐘"

    hours = minutes // 60
    remain_minutes = minutes % 60

    if remain_minutes == 0:
        return f"{hours} 小時"

    return f"{hours} 小時 {remain_minutes} 分鐘"


# =========================================================
# 把推測狀態送到 Node.js API → PostgreSQL
# =========================================================

def save_mood_to_database(data):
    try:
        payload = {
            "petId": PET_ID,
            "mood": data["mood"],
            "behavior": data["behavior"],
            "confidence": data["confidence"],
            "aspectRatio": data["aspectRatio"],
            "movement": data["movement"],
        }

        response = requests.post(
            f"{PET_API_URL}/api/mood-records",
            json=payload,
            timeout=5,
        )

        response.raise_for_status()

        print(
            f"💾 已寫入資料庫："
            f"{data['mood']}"
        )

    except Exception as e:
        print(
            "❌ 推測狀態寫入資料庫失敗：",
            e,
        )


# =========================================================
# 把通知送到 Node.js API
# =========================================================

def send_camera_notification(notification_type, title, message):
    try:
        payload = {
            "petId": PET_ID,
            "type": notification_type,
            "title": title,
            "message": message,
        }

        response = requests.post(
            NOTIFICATION_API_URL,
            json=payload,
            timeout=5,
        )

        response.raise_for_status()

        print(f"🔔 通知已送出：{title}")

    except Exception as e:
        # 如果 Node.js 尚未做 /notifications 路由，攝影機本身仍可繼續工作
        print(
            "❌ 通知送出失敗：",
            e,
        )


# =========================================================
# 儲存行為 / 推測狀態歷史
# =========================================================

def save_mood_history(status):
    global last_mood_record_time

    now = datetime.now()
    mood = status["mood"]

    # 沒偵測到寵物、攝影機待機時不要當成行為資料保存
    if mood in ["待機中", "未偵測"]:
        return

    # 每隔固定秒數紀錄一次
    if last_mood_record_time is not None:
        diff = (
            now - last_mood_record_time
        ).total_seconds()

        if diff < MOOD_RECORD_INTERVAL_SECONDS:
            return

    data = {
        "mood": status["mood"],
        "behavior": status["behavior"],
        "confidence": float(status["confidence"]),
        "aspectRatio": float(status["aspectRatio"]),
        "movement": int(status["movement"]),
        "time": now,
    }

    # 本機記憶體
    with history_lock:
        mood_history.append(data)

    last_mood_record_time = now

    print(
        f"📊 行為紀錄："
        f"{data['mood']} "
        f"| 行為：{data['behavior']} "
        f"| 信心度：{data['confidence']}% "
        f"| {now.strftime('%H:%M:%S')}"
    )

    # PostgreSQL
    # 開 thread，避免資料庫連線卡住攝影機 YOLO
    threading.Thread(
        target=save_mood_to_database,
        args=(data,),
        daemon=True,
    ).start()


# =========================================================
# 分析寵物狀態
# =========================================================

def analyze_live_frame(x1, y1, x2, y2, conf):
    global prev_center

    # Bounding Box 寬高
    w = x2 - x1
    h = max(y2 - y1, 1)

    # 中心點
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2

    # 長寬比
    aspect_ratio = round(
        w / float(h),
        2,
    )

    # YOLO 信心度
    confidence = int(conf * 100)

    # =====================================================
    # 移動距離
    # =====================================================

    movement = 0

    if prev_center is not None:
        dx = cx - prev_center[0]
        dy = cy - prev_center[1]

        movement = int(
            math.sqrt(
                dx ** 2 + dy ** 2
            )
        )

    prev_center = (
        cx,
        cy,
    )

    # =====================================================
    # 行為 / 狀態推估
    #
    # 注意：這是根據畫面中的活動量、位置變化與外框比例推估，
    # 不代表醫療診斷，也不代表寵物真實心理狀態。
    # =====================================================

    if movement > 20:
        behavior = "跑跳 / 活動中"
        mood = "活躍"

    elif movement > 5:
        behavior = "走動 / 探索中"
        mood = "好奇 / 探索"

    else:
        if aspect_ratio > 1.3:
            behavior = "休息中"
            mood = "休息 / 放鬆"

        elif aspect_ratio < 0.85:
            behavior = "坐姿 / 站立"
            mood = "觀察"

        else:
            behavior = "靜止放鬆"
            mood = "平靜"

    return {
        "behavior": behavior,
        "mood": mood,
        "confidence": confidence,
        "aspectRatio": aspect_ratio,
        "movement": movement,
    }


# =========================================================
# 開啟攝影機
# =========================================================

def open_camera():
    print("")
    print("📷 正在連接 RTSP 攝影機...")
    print("嘗試使用 FFmpeg + TCP")

    cap = cv2.VideoCapture(
        CAMERA_SOURCE,
        cv2.CAP_FFMPEG,
    )

    if cap.isOpened():
        print("✅ RTSP 攝影機連線成功")
        return cap

    # 第一次失敗
    cap.release()

    print("⚠️ FFmpeg 開啟失敗")
    print("改用 OpenCV 預設模式...")

    cap = cv2.VideoCapture(
        CAMERA_SOURCE
    )

    if cap.isOpened():
        print("✅ 預設模式連線成功")
        return cap

    cap.release()

    print("❌ RTSP 攝影機連線失敗")
    return None


# =========================================================
# 背景攝影機分析
# =========================================================

def camera_worker():
    global current_status
    global prev_center
    global latest_jpeg
    global camera_connected
    global camera_error
    global last_seen_at
    global not_detected_since
    global missing_alert_sent

    while not stop_event.is_set():

        # =================================================
        # 嘗試開啟攝影機
        # =================================================

        cap = open_camera()

        if cap is None:
            camera_connected = False
            camera_error = "無法連接 RTSP 攝影機"

            # 攝影機本身離線不能算成寵物離開鏡頭
            not_detected_since = None
            missing_alert_sent = False
            prev_center = None

            with status_lock:
                current_status = {
                    "detected": False,
                    "behavior": "攝影機離線",
                    "mood": "待機中",
                    "confidence": 0,
                    "aspectRatio": 0.0,
                    "movement": 0,
                    "lastSeenAt": iso_or_none(last_seen_at),
                    "missingSince": None,
                    "missingSeconds": 0,
                    "missingMinutes": 0,
                }

            print("🔄 5 秒後重新連線...")
            time.sleep(5)
            continue

        # =================================================
        # 連線成功
        # =================================================

        camera_connected = True
        camera_error = ""
        prev_center = None

        # =================================================
        # 持續讀取
        # =================================================

        while (
            cap.isOpened()
            and
            not stop_event.is_set()
        ):
            success, frame = cap.read()

            # =============================================
            # 無法取得畫面
            # =============================================

            if not success:
                print("❌ RTSP 畫面中斷")

                camera_connected = False
                camera_error = "RTSP 已連線，但目前無法讀取畫面"

                # 畫面中斷不能算成寵物消失
                not_detected_since = None
                missing_alert_sent = False
                prev_center = None

                with status_lock:
                    current_status = {
                        "detected": False,
                        "behavior": "攝影機畫面中斷",
                        "mood": "待機中",
                        "confidence": 0,
                        "aspectRatio": 0.0,
                        "movement": 0,
                        "lastSeenAt": iso_or_none(last_seen_at),
                        "missingSince": None,
                        "missingSeconds": 0,
                        "missingMinutes": 0,
                    }

                break

            # =============================================
            # YOLO
            # =============================================

            try:
                results = model(
                    frame,
                    conf=0.4,
                    classes=PET_CLASSES,
                    verbose=False,
                )

            except Exception as e:
                print(
                    "❌ YOLO 分析錯誤：",
                    e,
                )
                continue

            # YOLO 畫框
            annotated_frame = results[0].plot()

            pet_found = False

            # =============================================
            # 找寵物
            # =============================================

            for box in results[0].boxes:
                pet_found = True
                now = datetime.now()

                # 判斷前一段時間是否曾離開鏡頭
                missing_started_at = not_detected_since
                was_missing = False
                missing_duration_seconds = 0

                if missing_started_at is not None:
                    missing_duration_seconds = int(
                        (
                            now - missing_started_at
                        ).total_seconds()
                    )

                    if missing_duration_seconds >= MISSING_GRACE_SECONDS:
                        was_missing = True

                # 記住這次是否已經發過「長時間未偵測」通知
                had_missing_alert = missing_alert_sent

                # 現在重新看到寵物
                last_seen_at = now
                not_detected_since = None
                missing_alert_sent = False

                x1, y1, x2, y2 = map(
                    int,
                    box.xyxy[0],
                )

                conf = float(
                    box.conf[0]
                )

                new_status = analyze_live_frame(
                    x1,
                    y1,
                    x2,
                    y2,
                    conf,
                )

                # 加入鏡頭狀態
                new_status.update({
                    "detected": True,
                    "lastSeenAt": now.isoformat(),
                    "missingSince": None,
                    "missingSeconds": 0,
                    "missingMinutes": 0,
                })

                # 更新目前狀態
                with status_lock:
                    current_status = new_status

                # 儲存行為歷史
                save_mood_history(new_status)

                # 如果剛剛真的離開鏡頭超過容許秒數
                if was_missing:
                    event = {
                        "type": "reappeared",
                        "missingStartedAt": missing_started_at,
                        "reappearedAt": now,
                        "durationSeconds": missing_duration_seconds,
                        "durationMinutes": round(
                            missing_duration_seconds / 60,
                            1,
                        ),
                    }

                    with history_lock:
                        presence_history.append(event)

                    print(
                        f"🐱 寵物重新出現在鏡頭中 "
                        f"| 離開鏡頭 "
                        f"{format_duration(missing_duration_seconds)}"
                    )

                    # 為避免太吵：只有先前真的發過長時間未偵測提醒
                    # 才補發「重新出現」通知
                    if (
                        had_missing_alert
                        and
                        NOTIFY_ON_REAPPEAR
                    ):
                        threading.Thread(
                            target=send_camera_notification,
                            args=(
                                "camera_reappeared",
                                "🐱 寵物重新出現在鏡頭中",
                                (
                                    f"寵物於 {now.strftime('%H:%M')} "
                                    f"重新出現在攝影機畫面中，"
                                    f"本次離開鏡頭約 "
                                    f"{format_duration(missing_duration_seconds)}。"
                                ),
                            ),
                            daemon=True,
                        ).start()

                # 目前只分析第一隻寵物
                break

            # =============================================
            # 沒偵測到寵物
            # =============================================

            if not pet_found:
                prev_center = None
                now = datetime.now()

                # 第一次沒看到 → 開始計時
                if not_detected_since is None:
                    not_detected_since = now

                missing_seconds = int(
                    (
                        now - not_detected_since
                    ).total_seconds()
                )

                # 前幾秒可能只是 YOLO 短暫漏偵測
                if missing_seconds >= MISSING_GRACE_SECONDS:
                    missing_minutes = missing_seconds // 60

                    with status_lock:
                        current_status = {
                            "detected": False,
                            "behavior": "目前未出現在鏡頭中",
                            "mood": "未偵測",
                            "confidence": 0,
                            "aspectRatio": 0.0,
                            "movement": 0,
                            "lastSeenAt": iso_or_none(last_seen_at),
                            "missingSince": iso_or_none(not_detected_since),
                            "missingSeconds": missing_seconds,
                            "missingMinutes": missing_minutes,
                        }

                    # 超過設定時間 → 一次未偵測事件只通知一次
                    if (
                        missing_seconds >= MISSING_ALERT_MINUTES * 60
                        and
                        not missing_alert_sent
                    ):
                        missing_alert_sent = True

                        if last_seen_at:
                            last_seen_text = last_seen_at.strftime("%H:%M")
                        else:
                            last_seen_text = "目前沒有紀錄"

                        # 記錄長時間未偵測事件
                        event = {
                            "type": "missing_alert",
                            "missingStartedAt": not_detected_since,
                            "alertAt": now,
                            "durationSeconds": missing_seconds,
                            "durationMinutes": round(
                                missing_seconds / 60,
                                1,
                            ),
                        }

                        with history_lock:
                            presence_history.append(event)

                        threading.Thread(
                            target=send_camera_notification,
                            args=(
                                "camera_missing",
                                "⚠️ 長時間未偵測到寵物",
                                (
                                    f"攝影機已連續 "
                                    f"{MISSING_ALERT_MINUTES} 分鐘 "
                                    f"未偵測到寵物。"
                                    f"最後偵測時間：{last_seen_text}。"
                                    f"寵物可能只是位於鏡頭範圍外，"
                                    f"可查看即時監控確認。"
                                ),
                            ),
                            daemon=True,
                        ).start()

            # =============================================
            # JPG
            # =============================================

            ret, buffer = cv2.imencode(
                ".jpg",
                annotated_frame,
            )

            if ret:
                with frame_lock:
                    latest_jpeg = buffer.tobytes()

        # =============================================
        # 斷線
        # =============================================

        cap.release()

        print("🔄 2 秒後重新連接攝影機...")
        time.sleep(2)


# =========================================================
# FastAPI 啟動 / 關閉
# =========================================================

@asynccontextmanager
async def lifespan(app):
    print("🚀 PawCare Camera AI 啟動")

    worker = threading.Thread(
        target=camera_worker,
        daemon=True,
    )

    worker.start()

    yield

    stop_event.set()

    print("🛑 PawCare Camera AI 關閉")


app = FastAPI(
    lifespan=lifespan
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# 影像串流 Generator
# =========================================================

def generate_frames():
    while True:
        frame = None

        with frame_lock:
            if latest_jpeg is not None:
                frame = latest_jpeg

        if frame is None:
            time.sleep(0.1)
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame
            + b"\r\n"
        )

        # 約 10 FPS 傳送到前端
        time.sleep(0.1)


# =========================================================
# API：影像
# =========================================================

@app.get("/video_feed")
def video_feed():
    return StreamingResponse(
        generate_frames(),
        media_type=(
            "multipart/x-mixed-replace;"
            " boundary=frame"
        ),
    )


# =========================================================
# API：目前狀態
# =========================================================

@app.get("/status")
def get_status():
    with status_lock:
        data = dict(current_status)

    data["cameraConnected"] = camera_connected
    data["cameraError"] = camera_error

    # 告訴前端這是行為推估，不是醫療或絕對心理判斷
    data["stateNotice"] = (
        "目前狀態為依據攝影機偵測到的活動量、位置變化與姿態所做的推測。"
    )

    return data


# =========================================================
# API：攝影機狀態
# =========================================================

@app.get("/camera-status")
def get_camera_status():
    return {
        "connected": camera_connected,
        "error": camera_error,
    }


# =========================================================
# API：最近一段時間的推測狀態摘要
# =========================================================

@app.get("/mood-summary")
def get_mood_summary(minutes: int = 10):
    # 避免傳奇怪數字
    minutes = max(
        1,
        min(minutes, 1440),
    )

    now = datetime.now()

    cutoff = (
        now
        -
        timedelta(minutes=minutes)
    )

    # 取得指定時間紀錄
    with history_lock:
        recent_data = [
            item
            for item in mood_history
            if item["time"] >= cutoff
        ]

    # 沒資料
    if len(recent_data) == 0:
        return {
            "success": False,
            "message": "目前還沒有足夠的行為資料",
            "minutes": minutes,
            "samples": 0,
            "cameraConnected": camera_connected,
        }

    # 狀態統計
    moods = [
        item["mood"]
        for item in recent_data
    ]

    counter = Counter(moods)

    main_mood, count = counter.most_common(1)[0]

    percentage = round(
        count
        /
        len(recent_data)
        *
        100
    )

    # 各狀態比例
    mood_distribution = {}

    for mood, mood_count in counter.items():
        mood_distribution[mood] = round(
            mood_count
            /
            len(recent_data)
            *
            100
        )

    # 這裡僅做提示，不代表醫療或心理診斷
    warning_moods = [
        "觀察"
    ]

    enough_samples = len(recent_data) >= 3

    should_notify = (
        enough_samples
        and
        main_mood in warning_moods
        and
        percentage >= 60
    )

    if should_notify:
        notification = (
            f"⚠️ 過去 {minutes} 分鐘的畫面中，"
            f"約有 {percentage}% 的紀錄被推測為「{main_mood}」。"
            f"這只是攝影機行為推估，可搭配即時畫面一起查看。"
        )
    else:
        notification = (
            f"🐱 過去 {minutes} 分鐘主要被推測為「{main_mood}」，"
            f"約佔 {percentage}% 的紀錄。"
        )

    return {
        "success": True,
        "minutes": minutes,
        "mainMood": main_mood,
        "percentage": percentage,
        "samples": len(recent_data),
        "distribution": mood_distribution,
        "shouldNotify": should_notify,
        "notification": notification,
        "cameraConnected": camera_connected,
        "updatedAt": now.strftime("%H:%M:%S"),
        "stateNotice": (
            "結果為攝影機依活動量與姿態進行的行為狀態推測，不是醫療診斷。"
        ),
    }


# =========================================================
# API：一天 / 指定時間範圍行為時間軸
#
# 範例：
# 最近 20 分鐘，每 5 分鐘一格
# /behavior-timeline?minutes=20&bucketMinutes=5
#
# 最近 1 小時，每 10 分鐘一格
# /behavior-timeline?minutes=60&bucketMinutes=10
#
# 最近 24 小時，每 60 分鐘一格
# /behavior-timeline?minutes=1440&bucketMinutes=60
# =========================================================

@app.get("/behavior-timeline")
def get_behavior_timeline(
    minutes: int = 1440,
    bucketMinutes: int = 60,
):
    # 最長查 24 小時
    minutes = max(
        1,
        min(minutes, 1440),
    )

    allowed_buckets = [
        1,
        5,
        10,
        15,
        30,
        60,
    ]

    if bucketMinutes not in allowed_buckets:
        bucketMinutes = 60

    now = datetime.now()
    cutoff = now - timedelta(minutes=minutes)

    with history_lock:
        data = [
            item
            for item in mood_history
            if item["time"] >= cutoff
        ]

    if len(data) == 0:
        return {
            "success": False,
            "message": "目前沒有行為資料",
            "minutes": minutes,
            "bucketMinutes": bucketMinutes,
            "timeline": [],
        }

    buckets = {}

    for item in data:
        item_time = item["time"]

        midnight = item_time.replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

        total_minutes = (
            item_time.hour * 60
            +
            item_time.minute
        )

        bucket_total_minutes = (
            total_minutes
            //
            bucketMinutes
            *
            bucketMinutes
        )

        bucket_time = (
            midnight
            +
            timedelta(minutes=bucket_total_minutes)
        )

        key = bucket_time.isoformat()

        if key not in buckets:
            buckets[key] = []

        buckets[key].append(item)

    timeline = []

    for key in sorted(buckets.keys()):
        items = buckets[key]

        moods = [
            item["mood"]
            for item in items
        ]

        behaviors = [
            item["behavior"]
            for item in items
        ]

        main_mood = Counter(moods).most_common(1)[0][0]
        main_behavior = Counter(behaviors).most_common(1)[0][0]

        average_movement = round(
            sum(
                item["movement"]
                for item in items
            )
            /
            len(items),
            1,
        )

        average_confidence = round(
            sum(
                item["confidence"]
                for item in items
            )
            /
            len(items),
            1,
        )

        timeline.append({
            "time": key,
            "timeLabel": datetime.fromisoformat(key).strftime("%H:%M"),
            "estimatedState": main_mood,
            "behavior": main_behavior,
            "averageMovement": average_movement,
            "averageConfidence": average_confidence,
            "samples": len(items),
        })

    return {
        "success": True,
        "minutes": minutes,
        "bucketMinutes": bucketMinutes,
        "timeline": timeline,
        "stateNotice": (
            "時間軸中的狀態為攝影機依活動量與姿態進行的推測，不是醫療診斷。"
        ),
    }


# =========================================================
# API：離開鏡頭 / 重新出現紀錄
# =========================================================

@app.get("/presence-history")
def get_presence_history(limit: int = 50):
    limit = max(
        1,
        min(limit, 200),
    )

    with history_lock:
        raw_events = list(presence_history)[-limit:]

    events = []

    for item in reversed(raw_events):
        event = dict(item)

        for key in [
            "missingStartedAt",
            "reappearedAt",
            "alertAt",
        ]:
            if key in event and isinstance(event[key], datetime):
                event[key] = event[key].isoformat()

        if "durationSeconds" in event:
            event["durationText"] = format_duration(
                event["durationSeconds"]
            )

        events.append(event)

    return {
        "success": True,
        "events": events,
    }


# =========================================================
# 測試 API
# =========================================================

@app.get("/")
def root():
    return {
        "message": "PawCare Camera API 正常運作",
        "cameraConnected": camera_connected,
        "missingAlertMinutes": MISSING_ALERT_MINUTES,
        "behaviorRecordIntervalSeconds": MOOD_RECORD_INTERVAL_SECONDS,
    }


# =========================================================
# 啟動 Server
# =========================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
    )
