# 🎯 YOLOv5 Object Detection Web Application

A modern, full-featured object detection web app powered by **YOLO-World** — capable of detecting **77+ classes** including statues, monuments, animals, vehicles, food, and everyday objects — all through a sleek web interface.

---

## ✨ Features

- 🖼️ **Image Detection** — Upload any image and detect objects instantly
- 🎬 **Video Detection** — Upload a video and get a fully annotated output video
- 📷 **Live Camera** — Real-time object detection using your webcam
- 📁 **Batch Analyzer** — Run detection on multiple images from the `data/images` folder at once, with results saved to `runs/detect/`
- 🧠 **YOLO-World Model** — Open-vocabulary zero-shot detection (no retraining needed!)
- 🎨 **Modern Dark UI** — Beautiful glassmorphism design with smooth animations

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/Bramhateja1234/yolov5-web-application.git
cd yolov5-web-application
```

### 2. Install Dependencies
```bash
pip install flask torch torchvision opencv-python pillow ultralytics
```

### 3. Download the YOLO-World Model
The model (`yolov8s-worldv2.pt`) will be **auto-downloaded** on first run. Make sure you have an internet connection.

### 4. Run the App
```bash
python app.py
```

### 5. Open in Browser
Navigate to **[http://localhost:5000](http://localhost:5000)**

---

## 🗂️ Project Structure

```
yolov5-web-application/
│
├── app.py                  # Flask backend — all API routes & YOLO-World detection
├── requirements.txt        # Python dependencies
├── .gitignore              # Ignores model weights, runs, cache
│
├── templates/
│   └── index.html          # Main HTML page (tabs UI)
│
└── static/
    ├── style.css           # Dark glassmorphism design
    └── script.js           # Frontend logic (tabs, upload, webcam, results)
```

---

## 🧠 How It Works

The app uses **YOLO-World** (`yolov8s-worldv2.pt`), an open-vocabulary zero-shot object detection model by Ultralytics. Unlike traditional models limited to 80 COCO classes, YOLO-World can detect any category you define in plain English.

### Detectable Classes (77 total)
| Category | Examples |
|---|---|
| People | person, face, hand |
| Statues & Monuments | statue, sculpture, monument, idol, figurine |
| Animals | cat, dog, elephant, lion, tiger, zebra, bird... |
| Vehicles | car, truck, bus, train, airplane, boat... |
| Food | pizza, burger, cake, apple, banana... |
| Indoor | chair, table, laptop, phone, television... |
| Outdoor | tree, building, bridge, traffic light... |

> 💡 To add a new class, simply add its English name to the `CLASSES` list in `app.py` — no retraining needed!

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python, Flask |
| **Detection** | YOLO-World (Ultralytics YOLOv8) |
| **Image Processing** | OpenCV, Pillow |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **ML Framework** | PyTorch |

---

## 📸 Screenshots

> Upload images, videos, or use your live webcam to detect objects in real time.

---

## 📝 License

This project is for educational and research purposes.

---

## 🙌 Acknowledgements

- [Ultralytics YOLOv5](https://github.com/ultralytics/yolov5)
- [Ultralytics YOLO-World](https://docs.ultralytics.com/models/yolo-world/)
