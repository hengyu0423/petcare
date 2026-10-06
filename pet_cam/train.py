from ultralytics import YOLO
import os

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    print("程式位置：", base_dir)
    print("目前工作目錄：", os.getcwd())

    model = YOLO(os.path.join(base_dir, "yolov8n.pt"))

    results = model.train(
        data=os.path.join(base_dir, "data.yaml"),
        epochs=100,
        imgsz=640,
        batch=8,
        patience=20,
        project=os.path.join(base_dir, "runs"),
        name="petv1",
        exist_ok=True
    )

    print("\n訓練完成")

if __name__ == "__main__":
    main()