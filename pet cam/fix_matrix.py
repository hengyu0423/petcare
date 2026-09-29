import os
import glob
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent  # pet cam 目錄

# 自動偵測 best.pt 所在路徑（同時搜尋根目錄與 pet cam 目錄）
possible_paths = [
    BASE_DIR.parent / "runs" / "detect" / "runs" / "train" / "pawcare_v1" / "weights" / "best.pt",
    BASE_DIR / "runs" / "detect" / "runs" / "train" / "pawcare_v1" / "weights" / "best.pt",
    BASE_DIR / "runs" / "train" / "pawcare_v1" / "weights" / "best.pt",
]

model_path = None
for p in possible_paths:
    if p.exists():
        model_path = p
        break

if model_path is None:
    raise FileNotFoundError("仍找不到 best.pt 檔案，請確認 runs 資料夾位置。")

print(f"成功載入模型權重：{model_path}")
model = YOLO(str(model_path))

# 矩陣陣列 [Predicted, True] -> 0: cat, 1: dog, 2: background
matrix = np.zeros((3, 3), dtype=int)
img_paths = glob.glob(str(BASE_DIR / "valid" / "images" / "*.*"))

for img_path in img_paths:
    label_path = img_path.replace("images", "labels").rsplit(".", 1)[0] + ".txt"
    
    # 讀取真實標籤 (資料集 0=cat, 1=dog)
    gt_class = 2  # 預設為 background
    if os.path.exists(label_path):
        with open(label_path, 'r') as f:
            lines = f.readlines()
            if lines:
                cls_id = int(lines[0].split()[0])
                if cls_id == 0: gt_class = 0
                elif cls_id == 1: gt_class = 1

    # 模型推理 (自訓練模型不需要帶入 classes=[15, 16])
    results = model(img_path, conf=0.25, verbose=False)
    boxes = results[0].boxes

    pred_class = 2  # 預設為 background
    if len(boxes) > 0:
        top_cls = int(boxes[0].cls[0])
        if top_cls == 0: pred_class = 0    # 自訓練模型 0 代表 Cat
        elif top_cls == 1: pred_class = 1  # 自訓練模型 1 代表 Dog

    matrix[pred_class, gt_class] += 1

# 繪製 3x3 混淆矩陣
fig, ax = plt.subplots(figsize=(6, 5))
cax = ax.matshow(matrix, cmap='Blues')
fig.colorbar(cax)

ax.set_xticks([0, 1, 2])
ax.set_yticks([0, 1, 2])
ax.set_xticklabels(['Cat', 'Dog', 'Background'])
ax.set_yticklabels(['Cat', 'Dog', 'Background'])

for i in range(3):
    for j in range(3):
        color = 'white' if matrix[i, j] > matrix.max() / 2 else 'black'
        ax.text(j, i, str(matrix[i, j]), va='center', ha='center', color=color)

plt.xlabel('True (Actual)')
plt.ylabel('Predicted')
plt.title('PawCare - Fine-tuned Model Confusion Matrix')
plt.tight_layout()

output_path = BASE_DIR / "cat_dog_confusion_matrix.png"
plt.savefig(output_path)
print(f"成功生成混淆矩陣圖檔：{output_path.name}")