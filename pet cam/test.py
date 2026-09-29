from pathlib import Path
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent

model = YOLO("yolov8n.pt") 

results = model.train(
    data=str(BASE_DIR / "data.yaml"), 
    epochs=100,                      
    imgsz=640,                       
    batch=16,                        
    patience=20,                     
    project="runs/train",            
    name="pawcare_v1"                 
)

print("訓練完成 模型已儲存於 runs/train/pawcare_v1/weights/best.pt")