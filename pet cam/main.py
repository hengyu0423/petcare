import cv2
import math
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("yolov8n.pt")
CAMERA_SOURCE = "rtsp://nigel1:nigel123@nigel-petcam.asuscomm.com:554/stream2"

current_status = {
    "behavior": "讀取中...",
    "mood": "讀取中...",
    "confidence": 0,
    "aspectRatio": 0.0,
    "movement": 0
}

prev_center = None

def analyze_live_frame(x1, y1, x2, y2, conf):
    global prev_center
    
    w = x2 - x1
    h = max(y2 - y1, 1)
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    
    aspect_ratio = round(w / float(h), 2)
    confidence = int(conf * 100)
    
    movement = 0
    if prev_center is not None:
        dx = cx - prev_center[0]
        dy = cy - prev_center[1]
        movement = int(math.sqrt(dx**2 + dy**2))
    prev_center = (cx, cy)
    
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

def generate_frames():
    global current_status, prev_center
    cap = cv2.VideoCapture(CAMERA_SOURCE, cv2.CAP_FFMPEG)

    if not cap.isOpened():
        print("無法開啟鏡頭串流")
        return

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        results = model(frame, conf=0.4, classes=[15, 16])
        annotated_frame = results[0].plot()

        pet_found = False
        for box in results[0].boxes:
            pet_found = True
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            
            current_status = analyze_live_frame(x1, y1, x2, y2, conf)
            break 
                
        if not pet_found:
            prev_center = None
            current_status = {
                "behavior": "未偵測到寵物",
                "mood": "待機中",
                "confidence": 0,
                "aspectRatio": 0.0,
                "movement": 0
            }

        ret, buffer = cv2.imencode('.jpg', annotated_frame)
        if not ret:
            continue

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

@app.get("/video_feed")
def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/status")
def get_status():
    return current_status

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)