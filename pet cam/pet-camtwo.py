import json
import os
import queue
import time
import threading
from datetime import datetime
from pathlib import Path

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

# 只有貓（class 0）會建立如廁紀錄
CAT_CLASS = 0

CONF_THRESHOLD = float(os.environ.get("PET_CONF", "0.55"))

# Node.js 後端 API 網址
PET_API_URL = os.environ.get("PET_API_URL", "http://localhost:4000")
CAMERA_ID = os.environ.get("PET_CAM_ID", "cam2")
STATS_REFRESH_SECONDS = 10  # 多久跟後端同步一次今日統計

# ==========================================
# 1-1. 如廁偵測的把關條件
#
# 原本只要任何一幀偵測到「貓」就立刻算進入，所以：
#   人走過貓砂盆前、開關燈／紅外切換造成的畫面變化、
#   貓只是路過，都會產生一筆停留 0～2 秒的紀錄，
#   而這些紀錄又會被推估成「尿尿」，導致次數明顯偏高。
#
# 現在要建立一筆紀錄，必須同時通過下面幾關：
#   位置（貓砂盆範圍）→ 框的大小／比例 → 連續停留時間，
#   而且不能在開關燈的暫停期間；
#   結束一次則要連續離開超過 ABSENCE_COOLDOWN 秒。
# ==========================================

# (1) 位置：貓的框必須主要落在貓砂盆範圍內（人走過去、貓路過都不算）
#     格式是正規化座標 [x1, y1, x2, y2]（0~1）。
#     執行時按 b 可以用滑鼠框出貓砂盆，結果存到 litter_box_roi.json，
#     下次啟動自動讀取；也可以用環境變數
#     LITTER_BOX_ROI="0.30,0.45,0.85,1.00" 直接指定。
ROI_FILE = Path(__file__).resolve().parent / "litter_box_roi.json"


def load_roi():
    # 環境變數優先，其次讀 litter_box_roi.json
    raw = os.environ.get("LITTER_BOX_ROI", "").strip()

    if not raw and ROI_FILE.exists():
        try:
            with open(ROI_FILE, "r", encoding="utf-8") as file:
                value = json.load(file)
            if isinstance(value, list) and len(value) == 4:
                return [float(item) for item in value]
        except Exception as err:
            print("讀取 litter_box_roi.json 失敗：", err)
        return None

    if raw:
        try:
            value = [float(item) for item in raw.replace(";", ",").split(",")]
            return value if len(value) == 4 else None
        except ValueError:
            print("LITTER_BOX_ROI 格式不正確，已忽略。")

    return None


LITTER_BOX_ROI = load_roi()

ROI_OVERLAP_MIN = float(os.environ.get("PET_ROI_OVERLAP", "0.4"))  # 至少 40% 落在貓砂盆內

# (2) 大小與比例：陰影、衣服、遠處小物件的框通常過小、過大或過長
MIN_BOX_AREA_RATIO = 0.002  # 至少佔畫面 0.2%
MAX_BOX_AREA_RATIO = 0.60   # 最多佔畫面 60%（整個人貼著鏡頭）
MIN_BOX_ASPECT = 0.35       # 寬 / 高
MAX_BOX_ASPECT = 3.5

# (3) 連續停留：至少連續 MIN_DWELL_SECONDS 秒都看到貓才算進入一次
#     人走過去通常 1～3 秒、單幀誤判更短，都不會進資料庫
MIN_DWELL_SECONDS = float(os.environ.get("PET_MIN_DWELL", "6"))

# (4) 離開判定：貓離開超過 ABSENCE_COOLDOWN 秒才算結束一次
#     原本 5 秒太短，中途漏偵測會被拆成好幾筆
ABSENCE_COOLDOWN = float(os.environ.get("PET_ABSENCE_COOLDOWN", "15"))

# 連續偵測允許中斷幾秒（貓被遮擋、瞬間畫面雜訊）
DETECTION_GAP_SECONDS = 2.0

# 開關燈／紅外切換時畫面亮度會瞬間大變化，這段時間不建立新紀錄
LIGHT_CHANGE_DELTA = 28.0
LIGHT_CHANGE_HOLD_SECONDS = 3.0

# 截圖樣品：判定進入／離開時各存一張，用來看偵測有沒有抓對。
# 只存到本機 snapshots 資料夾，不進資料庫，覺得佔空間可以直接刪。
SNAPSHOT_ENABLED = os.environ.get("PET_SNAPSHOTS", "1") != "0"
SNAPSHOT_DIR = Path(
    os.environ.get("PET_SNAPSHOT_DIR", str(Path(__file__).resolve().parent / "snapshots"))
)

# 除錯樣品：把「被擋掉的偵測」也存到 snapshots/cam2/_rejected，
# 用來看把關是不是太嚴（例如貓砂盆範圍框歪了、貓被當成太大框）。
# 每 DEBUG_SNAPSHOT_INTERVAL_SECONDS 秒最多存一張，不會塞爆資料夾。
DEBUG_SNAPSHOTS = os.environ.get("PET_DEBUG_SNAPSHOTS", "1") != "0"
DEBUG_SNAPSHOT_INTERVAL_SECONDS = float(
    os.environ.get("PET_DEBUG_SNAPSHOT_INTERVAL", "20")
)

# 至少看到幾秒才被當成「被擋掉的短暫停」存圖（單幀閃爍太雜，不存）
REJECTED_SNAPSHOT_MIN_SECONDS = 1.0

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


def iso_at(timestamp):
    # 進入時間要用「第一次看到貓的時間」，不是通過把關條件的時間，
    # 否則每次都會少算 MIN_DWELL_SECONDS 那麼多秒
    return datetime.fromtimestamp(timestamp).astimezone().isoformat()


def post_enter(entered_at=None):
    _request_queue.put((
        "/api/litter-box/enter",
        {
            "cameraId": CAMERA_ID,
            "petType": "cat",
            "enteredAt": entered_at or now_iso()
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
# 2-1. 把關條件的判斷函式
# ==========================================

def box_in_roi(box, frame_w, frame_h):
    """貓的框與貓砂盆範圍的重疊比例是否夠高。"""
    if LITTER_BOX_ROI is None:
        return True  # 還沒設定貓砂盆範圍時，退回整個畫面

    x1, y1, x2, y2 = box
    box_area = (x2 - x1) * (y2 - y1)

    rx1 = LITTER_BOX_ROI[0] * frame_w
    ry1 = LITTER_BOX_ROI[1] * frame_h
    rx2 = LITTER_BOX_ROI[2] * frame_w
    ry2 = LITTER_BOX_ROI[3] * frame_h

    overlap_w = max(0.0, min(x2, rx2) - max(x1, rx1))
    overlap_h = max(0.0, min(y2, ry2) - max(y1, ry1))

    return (overlap_w * overlap_h) / box_area >= ROI_OVERLAP_MIN


def box_reject_reason(box, frame_w, frame_h):
    """通過大小／位置檢查時回傳 None，否則回傳原因（給除錯檔名用）。"""
    x1, y1, x2, y2 = box

    width = x2 - x1
    height = y2 - y1

    if width <= 0 or height <= 0:
        return "bad_box"

    area_ratio = (width * height) / float(frame_w * frame_h)

    if area_ratio < MIN_BOX_AREA_RATIO:
        return "too_small"

    if area_ratio > MAX_BOX_AREA_RATIO:
        return "too_large"

    if not MIN_BOX_ASPECT <= width / height <= MAX_BOX_ASPECT:
        return "bad_shape"

    if not box_in_roi(box, frame_w, frame_h):
        return "outside_box"

    return None


def find_cat_box(results, frame_w, frame_h):
    """
    從辨識結果中找貓框。

    回傳 ((x1, y1, x2, y2), 信心度, 被擋掉的原因)：
      通過所有條件 → (框, 信心度, None)
      有貓但被擋掉 → (None, 信心度, 原因)   例：outside_box / too_small
      畫面裡沒有貓 → (None, 0.0, None)
    """
    boxes = results[0].boxes

    if boxes is None or len(boxes) == 0:
        return None, 0.0, None

    best_box = None
    best_conf = 0.0

    rejected_box = None
    rejected_conf = 0.0
    rejected_reason = None

    for box in boxes:
        if int(box.cls[0]) != CAT_CLASS:
            continue

        conf = float(box.conf[0])
        candidate = tuple(float(value) for value in box.xyxy[0])
        reason = box_reject_reason(candidate, frame_w, frame_h)

        if reason is None:
            if conf > best_conf:
                best_conf = conf
                best_box = candidate
        elif conf > rejected_conf:
            rejected_conf = conf
            rejected_box = candidate
            rejected_reason = reason

    if best_box is not None:
        return best_box, best_conf, None

    if rejected_box is not None:
        return None, rejected_conf, rejected_reason

    return None, 0.0, None


def save_snapshot(annotated_frame, visit_started_at, stage, folder_suffix=""):
    """
    存一張當下的畫面當樣品。

    正式樣品（進入/離開是同一個前綴，方便對照）：
      snapshots/cam2/2026-11-18/visit_20261118_153005_enter.jpg
      snapshots/cam2/2026-11-18/visit_20261118_153005_leave.jpg

    被擋掉的除錯樣品（folder_suffix="_rejected"，檔名附原因）：
      snapshots/cam2/_rejected/2026-11-18/reject_20261118_153005_outside_box.jpg

    存的是有畫框與貓砂盆範圍的畫面，比較看得出偵測有沒有抓對。
    """
    if not SNAPSHOT_ENABLED:
        return None

    started = datetime.fromtimestamp(visit_started_at)
    folder = SNAPSHOT_DIR / CAMERA_ID / folder_suffix / started.strftime("%Y-%m-%d")

    if stage == "enter" or stage == "leave":
        name = f"visit_{started.strftime('%Y%m%d_%H%M%S')}_{stage}.jpg"
    else:
        name = f"reject_{started.strftime('%Y%m%d_%H%M%S')}_{stage}.jpg"

    try:
        folder.mkdir(parents=True, exist_ok=True)

        path = folder / name
        cv2.imwrite(str(path), annotated_frame)

        return path

    except Exception as err:
        print("截圖存檔失敗：", err)
        return None


def log_snapshot(visit_started_at, now, stage, path):
    """把樣品記到 snapshots/_log.csv，方便之後對照時間與停留秒數。"""
    if not SNAPSHOT_ENABLED or path is None:
        return

    log_file = SNAPSHOT_DIR / "_log.csv"
    is_new_file = not log_file.exists()

    try:
        with open(log_file, "a", encoding="utf-8") as file:
            if is_new_file:
                file.write("寫入時間,攝影機,階段,開始時間,停留秒數,檔案\n")

            file.write(
                ",".join([
                    now_iso(),
                    CAMERA_ID,
                    stage,
                    iso_at(visit_started_at),
                    str(int(now - visit_started_at)),
                    str(path),
                ])
                + "\n"
            )
    except Exception as err:
        print("寫截圖紀錄失敗：", err)


def frame_brightness(frame):
    """整張畫面的平均亮度，用來判斷是不是開關燈或紅外切換。"""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (80, 45))

    return float(small.mean())


def draw_roi(frame):
    """把貓砂盆範圍畫在畫面上，方便確認位置有沒有抓對。"""
    if LITTER_BOX_ROI is None:
        return

    frame_h, frame_w = frame.shape[:2]

    point1 = (int(LITTER_BOX_ROI[0] * frame_w), int(LITTER_BOX_ROI[1] * frame_h))
    point2 = (int(LITTER_BOX_ROI[2] * frame_w), int(LITTER_BOX_ROI[3] * frame_h))

    cv2.rectangle(frame, point1, point2, (0, 160, 255), 2)


def pick_roi(frame):
    """按 b：用滑鼠框出貓砂盆範圍，存檔後立刻生效。"""
    global LITTER_BOX_ROI

    frame_h, frame_w = frame.shape[:2]
    pick_window = "框出貓砂盆範圍（按 Enter 確認 / 按 C 取消）"

    x, y, width, height = cv2.selectROI(pick_window, frame)
    cv2.destroyWindow(pick_window)

    print("已關閉框選視窗，請用滑鼠點一下主視窗才能繼續操作按鍵。")

    if width <= 0 or height <= 0:
        print("已取消，維持原本的貓砂盆範圍。")
        return

    LITTER_BOX_ROI = [
        x / frame_w,
        y / frame_h,
        (x + width) / frame_w,
        (y + height) / frame_h,
    ]

    try:
        with open(ROI_FILE, "w", encoding="utf-8") as file:
            json.dump([round(value, 4) for value in LITTER_BOX_ROI], file)

        print(f"已設定貓砂盆範圍並存到 {ROI_FILE.name}：{LITTER_BOX_ROI}")
    except Exception as err:
        print(f"已設定貓砂盆範圍（儲存失敗：{err}）：{LITTER_BOX_ROI}")


class LitterBoxTracker:
    """
    貓砂盆進出的判斷狀態。

    進入的條件（三個都要成立，缺一個就不建立紀錄）：
      1. 貓的框通過位置與大小檢查（見 find_cat_box）
      2. 連續停留夠久（MIN_DWELL_SECONDS）
      3. 不在開關燈的暫停期間

    離開要連續 ABSENCE_COOLDOWN 秒都沒看到貓才算，
    中途被遮擋或單幀漏偵測不會把一次如廁拆成好幾筆。
    """

    def __init__(self):
        self.in_box = False            # 已送過 /enter，目前算在貓砂盆裡
        self.streak_started_at = None  # 本輪連續看到貓的開始時間
        self.visit_started_at = None   # 這一輪如廁的開始時間（截圖檔名用）
        self.last_seen_at = 0.0
        self.last_brightness = None
        self.hold_until = 0.0          # 開關燈後，這個時間點之前不建立新紀錄
        self.light_flash = False

        # 被停留時間擋掉的短暫停（只給除錯樣品用）
        self.rejected_started_at = None
        self.rejected_seconds = 0.0
        self.last_debug_snapshot_at = 0.0

    def debug_snapshot_allowed(self, now):
        """除錯樣品每 DEBUG_SNAPSHOT_INTERVAL_SECONDS 秒最多存一張。"""
        if not DEBUG_SNAPSHOTS or not SNAPSHOT_ENABLED:
            return False

        if now - self.last_debug_snapshot_at < DEBUG_SNAPSHOT_INTERVAL_SECONDS:
            return False

        self.last_debug_snapshot_at = now
        return True

    def update_brightness(self, frame, now):
        """檢查這一格是不是開關燈／紅外切換。"""
        brightness = frame_brightness(frame)

        self.light_flash = (
            self.last_brightness is not None
            and abs(brightness - self.last_brightness) >= LIGHT_CHANGE_DELTA
        )

        if self.light_flash:
            self.hold_until = now + LIGHT_CHANGE_HOLD_SECONDS

        self.last_brightness = brightness

    def update(self, cat_box, now):
        """
        回傳本輪要做的事：
          "enter"     建立一筆如廁紀錄（enteredAt 用 streak_started_at）
          "leave"     結束目前這筆
          "rejected"  有看到貓但停留太短被擋掉（只存除錯樣品）
          None        不動作
        """
        self.rejected_started_at = None
        self.rejected_seconds = 0.0

        if cat_box is not None:
            if self.streak_started_at is None:
                self.streak_started_at = now

            self.last_seen_at = now

            if not self.in_box and now >= self.hold_until:
                if now - self.streak_started_at >= MIN_DWELL_SECONDS:
                    self.in_box = True
                    self.visit_started_at = self.streak_started_at
                    return "enter"

            return None

        # 這一幀沒有貓：允許短暫漏偵測，超過容忍時間才算中斷停留
        if (
            self.streak_started_at is not None
            and now - self.last_seen_at > DETECTION_GAP_SECONDS
        ):
            stayed = self.last_seen_at - self.streak_started_at

            # 沒到達停留門檻就走了：人走過去、貓只是路過多數是這種
            if not self.in_box and stayed >= REJECTED_SNAPSHOT_MIN_SECONDS:
                self.rejected_started_at = self.streak_started_at
                self.rejected_seconds = stayed

            self.streak_started_at = None

        if self.in_box and now - self.last_seen_at > ABSENCE_COOLDOWN:
            self.in_box = False
            return "leave"

        if self.rejected_started_at is not None:
            return "rejected"

        return None

    def staying_seconds(self, now):
        """目前這一輪已經連續看到貓幾秒（給畫面顯示用）。"""
        if self.streak_started_at is None:
            return 0.0

        return max(0.0, now - self.streak_started_at)

    def reset(self):
        self.in_box = False
        self.streak_started_at = None
        self.visit_started_at = None
        self.last_seen_at = 0.0
        self.rejected_started_at = None
        self.rejected_seconds = 0.0


# ==========================================
# 3. 載入 YOLO 模型與初始化今日計數
# ==========================================
print("正在載入 YOLO 模型...")
print(f"模型載入完成！執行裝置：{model.device}")

current_date = time.strftime("%Y-%m-%d")

tracker = LitterBoxTracker()

# 最後一張有貓的畫面（停留太短被擋掉時，存的樣品要用這一張）
last_cat_frame = None

print("目前的如廁偵測條件：")
print(f"  信心度 ≥ {CONF_THRESHOLD}")
print(f"  貓砂盆範圍：{LITTER_BOX_ROI if LITTER_BOX_ROI else '未設定（整個畫面）'}"
      f"｜重疊 ≥ {ROI_OVERLAP_MIN * 100:.0f}%")
print(f"  連續停留 ≥ {MIN_DWELL_SECONDS:.0f} 秒才記錄進入")
print(f"  離開超過 {ABSENCE_COOLDOWN:.0f} 秒才算結束（中途漏偵測容忍 {DETECTION_GAP_SECONDS:.0f} 秒）")

if SNAPSHOT_ENABLED:
    print(f"  進入／離開各存一張截圖當樣品：{SNAPSHOT_DIR}")

    if DEBUG_SNAPSHOTS:
        print(
            f"  被擋掉的偵測也會存到 {SNAPSHOT_DIR / CAMERA_ID / '_rejected'}"
            f"（每 {DEBUG_SNAPSHOT_INTERVAL_SECONDS:.0f} 秒最多一張）"
        )
    else:
        print("  被擋掉的偵測：不存樣品（PET_DEBUG_SNAPSHOTS=0）")
else:
    print("  截圖樣品：已關閉（PET_SNAPSHOTS=0）")

if LITTER_BOX_ROI is None:
    print("⚠️ 還沒有設定貓砂盆範圍，人走過去也可能被記錄。")
    print("   執行時按 b 用滑鼠框出貓砂盆，誤判會明顯減少。")

# 啟動時先跟後端拿今天的次數與停留時間（資料庫統計，重啟不會歸零）
refresh_stats()
threading.Thread(target=stats_loop, daemon=True).start()

# ==========================================
# 4. 連線攝影機並開啟即時辨識視窗
# ==========================================
window_name = "Tapo C210 (Q: Quit | R: Refresh | B: 框貓砂盆範圍)"

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
        tracker.reset()
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

    frame_h, frame_w = frame.shape[:2]
    current_time = time.time()

    # 先判斷這格是不是開關燈／紅外切換
    tracker.update_brightness(frame, current_time)

    if tracker.light_flash:
        print(
            "💡 畫面亮度瞬間變化過大（可能是開關燈），"
            f"暫停建立新的如廁紀錄 {LIGHT_CHANGE_HOLD_SECONDS:.0f} 秒"
        )

    # 進行 YOLO 影像辨識（只偵測 cats 與 dogs）
    results = model.predict(
        source=frame,
        classes=PET_CLASSES,
        conf=CONF_THRESHOLD,
        verbose=False
    )

    # 只留位置、大小都合理的貓框（人走過去、陰影通常在這裡就被擋掉）
    cat_box, cat_confidence, reject_reason = find_cat_box(results, frame_w, frame_h)

    # 截圖要用有框與貓砂盆範圍的畫面，所以先把辨識結果畫出來
    annotated_frame = results[0].plot()
    draw_roi(annotated_frame)

    # 記著最後一張有貓的畫面，停留太短被擋掉時要存的是這一張
    if cat_box is not None or reject_reason is not None:
        last_cat_frame = annotated_frame.copy()

    event = tracker.update(cat_box, current_time)

    if event == "enter":
        stayed = current_time - tracker.streak_started_at
        print(
            f"[{current_date}] 貓咪已在貓砂盆前連續停留 {stayed:.0f} 秒，"
            f"記錄為進入貓砂盆（信心度 {cat_confidence:.2f}）"
        )
        post_enter(iso_at(tracker.streak_started_at))

        path = save_snapshot(annotated_frame, tracker.visit_started_at, "enter")
        log_snapshot(tracker.visit_started_at, current_time, "enter", path)

        if path:
            print(f"📸 已存進入時的截圖：{path}")

    elif event == "leave":
        print(
            f"貓咪已離開貓砂盆範圍（超過 {ABSENCE_COOLDOWN:.0f} 秒沒看到）"
        )
        post_leave()

        started = tracker.visit_started_at or tracker.last_seen_at
        path = save_snapshot(annotated_frame, started, "leave")
        log_snapshot(started, current_time, "leave", path)

        if path:
            print(f"📸 已存離開時的截圖：{path}")

    elif event == "rejected":
        # 有看到貓但沒停留夠久：存到 _rejected 當樣品，不進資料庫
        if tracker.debug_snapshot_allowed(current_time):
            started = tracker.rejected_started_at
            stage = f"dwell{int(tracker.rejected_seconds)}s"

            path = save_snapshot(
                last_cat_frame or annotated_frame,
                started,
                stage,
                folder_suffix="_rejected",
            )
            log_snapshot(started, current_time, f"rejected:{stage}", path)

            print(
                f"🚫 只停留 {tracker.rejected_seconds:.0f} 秒（不到 "
                f"{MIN_DWELL_SECONDS:.0f} 秒），不記錄；樣品：{path}"
            )

    elif reject_reason is not None and tracker.debug_snapshot_allowed(current_time):
        # 框被位置／大小條件擋掉（例如貓砂盆範圍框歪了就會一直 outside_box）
        path = save_snapshot(
            annotated_frame,
            current_time,
            reject_reason,
            folder_suffix="_rejected",
        )
        log_snapshot(current_time, current_time, f"blocked:{reject_reason}", path)

        print(f"🚫 擋掉一個 {reject_reason} 的框（信心度 {cat_confidence:.2f}）；樣品：{path}")

    # 在畫面左上角顯示今日次數（尿尿／大便分開）與目前的評估
    with stats_lock:
        count = today_stats["catCount"]
        urine = today_stats["urine24h"]
        poop = today_stats["poop24h"]
        level = today_stats["level"]

    staying = tracker.staying_seconds(current_time)

    if tracker.in_box:
        state_text = "In Litter Box"
    elif tracker.streak_started_at is not None:
        state_text = f"Confirming {staying:.0f}/{MIN_DWELL_SECONDS:.0f}s"
    else:
        state_text = "Away"

    status_text = (
        f"[{current_date}] Count: {count} | "
        f"Pee: {urine} | Poop: {poop} | "
        f"{state_text}"
    )

    cv2.rectangle(annotated_frame, (10, 10), (900, 50), (0, 0, 0), -1)
    cv2.putText(
        annotated_frame,
        status_text,
        (20, 38),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 0) if tracker.in_box else (200, 200, 200),
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

    cv2.putText(
        annotated_frame,
        f"ROI: {'set' if LITTER_BOX_ROI else 'NOT SET - press B'} | conf {CONF_THRESHOLD}",
        (20, 108),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (0, 200, 255) if LITTER_BOX_ROI else (0, 0, 255),
        2
    )

    # 顯示在視窗中
    cv2.imshow(window_name, annotated_frame)

    # 按鍵控制：q/ESC 結束、r 重新整理統計、b 框貓砂盆範圍、x 清除範圍
    key = cv2.waitKey(1) & 0xFF
    if key == ord("q") or key == 27:
        # 貓還在貓砂盆裡就離開程式時，補送一次 leave，避免留下開著的紀錄
        if tracker.in_box:
            send_leave_sync()
        print("結束監控程式")
        break
    elif key == ord("b"):
        pick_roi(annotated_frame)
    elif key == ord("x"):
        LITTER_BOX_ROI = None
        print("已清除貓砂盆範圍，目前會以整個畫面判斷（不建議）。")
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
