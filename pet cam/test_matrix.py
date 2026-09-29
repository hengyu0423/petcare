from ultralytics import YOLO

model = YOLO("yolov8n.pt")
metrics = model.val(data="data.yaml", split="val")

print("驗證完成")