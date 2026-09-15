import os

# 一定要放在 import cv2 前面
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
os.environ["OPENCV_VIDEOIO_DEBUG"] = "1"

import cv2
import math
import time
import threading

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


# =========================================================
# 全域資料
# =========================================================

current_status = {
    "behavior": "讀取中...",
    "mood": "讀取中...",
    "confidence": 0,
    "aspectRatio": 0.0,
    "movement": 0
}

# 上一個位置
prev_center = None

# 最新攝影機畫面
latest_jpeg = None

# 攝影機狀態
camera_connected = False
camera_error = ""

# 心情紀錄
mood_history = deque(maxlen=2000)

# 上次紀錄時間
last_mood_record_time = None


# =========================================================
# Thread Lock
# =========================================================

frame_lock = threading.Lock()
status_lock = threading.Lock()
history_lock = threading.Lock()

stop_event = threading.Event()


# =========================================================
# 儲存心情歷史
# =========================================================

def save_mood_history(mood, confidence):

    global last_mood_record_time

    now = datetime.now()

    # 沒有偵測到寵物時不要存
    if mood == "待機中":
        return

    # 每 10 秒紀錄一次
    if last_mood_record_time is not None:

        diff = (
            now - last_mood_record_time
        ).total_seconds()

        if diff < 10:
            return

    data = {
        "mood": mood,
        "confidence": float(confidence),
        "time": now
    }

    with history_lock:
        mood_history.append(data)

    last_mood_record_time = now

    print(
        f"📊 心情紀錄：{mood}"
        f" | 信心度：{confidence}%"
        f" | {now.strftime('%H:%M:%S')}"
    )


# =========================================================
# 分析貓咪狀態
# =========================================================

def analyze_live_frame(
    x1,
    y1,
    x2,
    y2,
    conf
):

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
        2
    )

    # YOLO 信心度
    confidence = int(
        conf * 100
    )


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
        cy
    )


    # =====================================================
    # 行為 / 心情推估
    # =====================================================

    if movement > 20:

        behavior = "跑跳 / 活動中"
        mood = "興奮開心"


    elif movement > 5:

        behavior = "走動 / 探索中"
        mood = "好奇專注"


    else:

        if aspect_ratio > 1.3:

            behavior = "休息中"
            mood = "放鬆慵懶"


        elif aspect_ratio < 0.85:

            behavior = "坐姿 / 站立"
            mood = "警戒觀察"


        else:

            behavior = "靜止放鬆"
            mood = "平靜舒適"


    return {
        "behavior": behavior,
        "mood": mood,
        "confidence": confidence,
        "aspectRatio": aspect_ratio,
        "movement": movement
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
        cv2.CAP_FFMPEG
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


    while not stop_event.is_set():

        # =================================================
        # 嘗試開啟攝影機
        # =================================================

        cap = open_camera()


        if cap is None:

            camera_connected = False
            camera_error = "無法連接 RTSP 攝影機"

            with status_lock:

                current_status = {
                    "behavior": "攝影機離線",
                    "mood": "待機中",
                    "confidence": 0,
                    "aspectRatio": 0.0,
                    "movement": 0
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

                camera_error = (
                    "RTSP 已連線，但目前無法讀取畫面"
                )

                break


            # =============================================
            # YOLO
            # =============================================

            try:

                results = model(
                    frame,
                    conf=0.4,
                    classes=PET_CLASSES,
                    verbose=False
                )


            except Exception as e:

                print(
                    "❌ YOLO 分析錯誤：",
                    e
                )

                continue


            # YOLO 畫框
            annotated_frame = (
                results[0].plot()
            )


            pet_found = False


            # =============================================
            # 找寵物
            # =============================================

            for box in results[0].boxes:

                pet_found = True


                x1, y1, x2, y2 = map(
                    int,
                    box.xyxy[0]
                )


                conf = float(
                    box.conf[0]
                )


                new_status = (
                    analyze_live_frame(
                        x1,
                        y1,
                        x2,
                        y2,
                        conf
                    )
                )


                # 更新目前狀態
                with status_lock:

                    current_status = (
                        new_status
                    )


                # 儲存歷史
                save_mood_history(
                    new_status["mood"],
                    new_status["confidence"]
                )


                # 目前只分析第一隻
                break


            # =============================================
            # 沒偵測到寵物
            # =============================================

            if not pet_found:

                prev_center = None


                with status_lock:

                    current_status = {
                        "behavior": "未偵測到寵物",
                        "mood": "待機中",
                        "confidence": 0,
                        "aspectRatio": 0.0,
                        "movement": 0
                    }


            # =============================================
            # JPG
            # =============================================

            ret, buffer = cv2.imencode(
                ".jpg",
                annotated_frame
            )


            if ret:

                with frame_lock:

                    latest_jpeg = (
                        buffer.tobytes()
                    )


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
        daemon=True
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
    allow_headers=["*"]
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
        )
    )


# =========================================================
# API：目前狀態
# =========================================================

@app.get("/status")
def get_status():

    with status_lock:

        data = dict(
            current_status
        )


    data["cameraConnected"] = (
        camera_connected
    )

    data["cameraError"] = (
        camera_error
    )


    return data


# =========================================================
# API：攝影機狀態
# =========================================================

@app.get("/camera-status")
def get_camera_status():

    return {
        "connected": camera_connected,
        "error": camera_error
    }


# =========================================================
# API：最近一段時間的心情
# =========================================================

@app.get("/mood-summary")
def get_mood_summary(
    minutes: int = 10
):

    # 避免傳奇怪數字
    minutes = max(
        1,
        min(minutes, 120)
    )


    now = datetime.now()

    cutoff = (
        now
        -
        timedelta(
            minutes=minutes
        )
    )


    # =====================================================
    # 取得指定時間紀錄
    # =====================================================

    with history_lock:

        recent_data = [

            item

            for item in mood_history

            if item["time"] >= cutoff

        ]


    # =====================================================
    # 沒資料
    # =====================================================

    if len(recent_data) == 0:

        return {
            "success": False,
            "message": "目前還沒有足夠的心情資料",
            "minutes": minutes,
            "samples": 0,
            "cameraConnected": camera_connected
        }


    # =====================================================
    # 心情統計
    # =====================================================

    moods = [

        item["mood"]

        for item in recent_data

    ]


    counter = Counter(
        moods
    )


    main_mood, count = (
        counter.most_common(1)[0]
    )


    percentage = round(
        count
        /
        len(recent_data)
        *
        100
    )


    # =====================================================
    # 各心情比例
    # =====================================================

    mood_distribution = {}


    for mood, mood_count in counter.items():

        mood_distribution[mood] = round(
            mood_count
            /
            len(recent_data)
            *
            100
        )


    # =====================================================
    # 警示條件
    # =====================================================

    warning_moods = [
        "警戒觀察"
    ]


    # 至少需要 6 筆資料
    # 每 10 秒一次 = 約 1 分鐘
    enough_samples = (
        len(recent_data) >= 6
    )


    should_notify = (
        enough_samples
        and
        main_mood in warning_moods
        and
        percentage >= 60
    )


    # =====================================================
    # 通知文字
    # =====================================================

    if should_notify:

        notification = (

            f"⚠️ 貓咪過去 {minutes} 分鐘"

            f"有 {percentage}% 的時間"

            f"呈現「{main_mood}」，"

            f"建議查看即時監控。"
        )


    else:

        notification = (

            f"🐱 貓咪過去 {minutes} 分鐘"

            f"主要呈現「{main_mood}」，"

            f"約佔 {percentage}% 的時間。"
        )


    return {

        "success": True,

        "minutes": minutes,

        "mainMood": main_mood,

        "percentage": percentage,

        "samples": len(recent_data),

        "distribution": (
            mood_distribution
        ),

        "shouldNotify": (
            should_notify
        ),

        "notification": (
            notification
        ),

        "cameraConnected": (
            camera_connected
        ),

        "updatedAt": (
            now.strftime(
                "%H:%M:%S"
            )
        )
    }


# =========================================================
# 測試 API
# =========================================================

@app.get("/")
def root():

    return {
        "message": "PawCare Camera API 正常運作",
        "cameraConnected": camera_connected
    }


# =========================================================
# 啟動 Server
# =========================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000
    )