import os
import io
import cv2
import base64
import numpy as np
from PIL import Image
from flask import Flask, render_template, request, jsonify, send_from_directory
import torch
from ultralytics import YOLO

app = Flask(__name__)

# ── Load YOLO-World: zero-shot open-vocabulary detection ──
current_dir = os.path.dirname(os.path.abspath(__file__))
print("Loading YOLO-World model...")
yolo_world = YOLO('yolov8s-worldv2.pt')

# Comprehensive class list — covers everyday objects, statues, landmarks, animals, vehicles, food etc.
CLASSES = [
    # People & body
    "person", "face", "hand",
    # Statues & monuments
    "statue", "sculpture", "monument", "idol", "figurine",
    # Animals
    "cat", "dog", "bird", "horse", "cow", "elephant", "lion", "tiger",
    "bear", "zebra", "giraffe", "monkey", "fish", "snake", "rabbit", "deer",
    # Vehicles
    "car", "truck", "bus", "motorcycle", "bicycle", "train", "airplane", "boat",
    "ambulance", "fire truck", "police car", "tractor",
    # Food
    "pizza", "burger", "sandwich", "cake", "apple", "banana", "orange",
    "bottle", "cup", "bowl",
    # Furniture & indoor
    "chair", "table", "sofa", "bed", "door", "window", "clock", "lamp",
    "television", "laptop", "phone", "keyboard", "mouse",
    # Outdoor & nature
    "tree", "flower", "building", "bridge", "road", "sign", "traffic light",
    "mountain", "river", "beach",
    # Sports & misc
    "ball", "bat", "racket", "helmet", "bag", "umbrella", "book", "pen"
]
yolo_world.set_classes(CLASSES)
print(f"YOLO-World ready with {len(CLASSES)} classes including statues/monuments!")


UPLOAD_FOLDER = os.path.join(current_dir, 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def encode_pil(img):
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG", quality=92)
    return 'data:image/jpeg;base64,' + base64.b64encode(buffered.getvalue()).decode("utf-8")


def compute_iou(box1, box2):
    """Compute Intersection over Union (IoU) of two bounding boxes."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_area = max(0, x2 - x1) * max(0, y2 - y1)
    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
    
    if float(box1_area + box2_area - inter_area) == 0:
        return 0.0
    return inter_area / float(box1_area + box2_area - inter_area)

def parse_detections_world(results):
    """Parse detections from YOLO-World ultralytics results and filter overlaps."""
    raw_detections = []
    if results and len(results) > 0:
        r = results[0]
        if r.boxes is not None and len(r.boxes) > 0:
            for box in r.boxes:
                cls_id = int(box.cls[0].item())
                conf   = float(box.conf[0].item())
                x1, y1, x2, y2 = [round(v) for v in box.xyxy[0].tolist()]
                label = CLASSES[cls_id] if cls_id < len(CLASSES) else f'class_{cls_id}'
                raw_detections.append({
                    'label': label,
                    'confidence': round(conf * 100, 1),
                    'bbox': [x1, y1, x2, y2]
                })
    
    # Filter out generic labels if they overlap heavily with specific labels
    filtered_detections = []
    generic_labels = ['person', 'face', 'hand']
    
    # Sort by confidence descending so we process highest confidence first
    # BUT we want to prioritize non-generic labels, so we sort by (is_specific, confidence)
    raw_detections.sort(key=lambda x: (x['label'] not in generic_labels, x['confidence']), reverse=True)
    
    for d in raw_detections:
        keep = True
        for kept_d in filtered_detections:
            iou = compute_iou(d['bbox'], kept_d['bbox'])
            # If they overlap by more than 60%, they are likely the same object
            if iou > 0.6:
                # If the kept one is specific and the new one is generic (like person), drop the generic one
                if kept_d['label'] not in generic_labels and d['label'] in generic_labels:
                    keep = False
                    break
                # If both are specific or both generic, keep the one with higher confidence (already handled by sort)
                else:
                    keep = False
                    break
        if keep:
            filtered_detections.append(d)
            
    return filtered_detections


def run_world_detection(img_pil):
    """Run YOLO-World on a PIL image and return annotated PIL image + detections."""
    # Lower confidence and raise IoU so YOLO returns multiple overlapping labels (e.g. Person + Statue)
    # Our custom parse_detections_world logic will filter out the generic ones.
    results = yolo_world.predict(img_pil, conf=0.05, iou=0.9, verbose=False)
    detections = parse_detections_world(results)
    
    # We need to manually draw the filtered bounding boxes so it matches the filtered UI list
    # Convert PIL to cv2 image
    img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
    
    for det in detections:
        label = f"{det['label']} {det['confidence']/100:.2f}"
        bbox = det['bbox']
        # Draw rectangle
        cv2.rectangle(img_cv, (bbox[0], bbox[1]), (bbox[2], bbox[3]), (255, 79, 160), 2)
        # Draw label background
        (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
        cv2.rectangle(img_cv, (bbox[0], bbox[1] - 20), (bbox[0] + w, bbox[1]), (255, 79, 160), -1)
        # Draw text
        cv2.putText(img_cv, label, (bbox[0], bbox[1] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

    annotated_img = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
    return annotated_img, detections


# ── Routes ──────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/static/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# ── Image Detection ─────────────────────────────────────────

@app.route('/detect', methods=['POST'])
def detect():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    file = request.files['image']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400
    try:
        img = Image.open(io.BytesIO(file.read())).convert('RGB')
        original_b64 = encode_pil(img)

        annotated_img, detections = run_world_detection(img)
        result_b64 = encode_pil(annotated_img)

        return jsonify({
            'success': True,
            'original_image': original_b64,
            'result_image': result_b64,
            'detections': detections,
            'count': len(detections)
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ── Single Frame Detection (for live camera) ────────────────

@app.route('/detect_frame', methods=['POST'])
def detect_frame():
    data = request.get_json()
    if not data or 'frame' not in data:
        return jsonify({'error': 'No frame provided'}), 400
    try:
        # Decode base64 frame
        header, encoded = data['frame'].split(',', 1)
        img_bytes = base64.b64decode(encoded)
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')

        annotated_img, detections = run_world_detection(img)
        result_b64 = encode_pil(annotated_img)

        return jsonify({
            'success': True,
            'result_image': result_b64,
            'detections': detections,
            'count': len(detections)
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ── Video Detection ─────────────────────────────────────────

@app.route('/detect_video', methods=['POST'])
def detect_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video provided'}), 400
    file = request.files['video']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400
    try:
        # Save uploaded video
        input_path = os.path.join(UPLOAD_FOLDER, 'input_video.mp4')
        output_path = os.path.join(UPLOAD_FOLDER, 'output_video.mp4')
        file.save(input_path)

        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            return jsonify({'error': 'Could not open video file'}), 400

        fps    = cap.get(cv2.CAP_PROP_FPS) or 25
        width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # Use avc1 (H.264) codec for HTML5 web compatibility
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        out    = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        all_labels = {}  # Format: {label: [conf1, conf2, ...]}
        frame_idx  = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Run inference every frame (or skip for speed)
            img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img_pil = Image.fromarray(img_rgb)
            
            # Use YOLO-World directly here to get both image and raw results
            results = yolo_world.predict(img_pil, conf=0.20, verbose=False)
            
            # Plot the annotated frame
            annotated_arr = results[0].plot()  # BGR numpy array
            out.write(annotated_arr)

            # Collect labels and confidences
            if results and len(results) > 0:
                r = results[0]
                if r.boxes is not None and len(r.boxes) > 0:
                    for box in r.boxes:
                        cls_id = int(box.cls[0].item())
                        conf   = float(box.conf[0].item())
                        label = CLASSES[cls_id] if cls_id < len(CLASSES) else f'class_{cls_id}'
                        
                        if label not in all_labels:
                            all_labels[label] = []
                        all_labels[label].append(conf)

            frame_idx += 1

        cap.release()
        out.release()

        # Build detection summary with average confidences
        detections = []
        for k, v in all_labels.items():
            avg_conf = round((sum(v) / len(v)) * 100, 1)
            detections.append({
                'label': k,
                'count': len(v),
                'confidence': avg_conf
            })

        return jsonify({
            'success': True,
            'video_url': '/static/uploads/output_video.mp4',
            'detections': detections,
            'frames_processed': frame_idx,
            'total_frames': total
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def get_next_run_dir(base_dir):
    os.makedirs(base_dir, exist_ok=True)
    existing = os.listdir(base_dir)
    exp_dirs = []
    for d in existing:
        if d == 'exp':
            exp_dirs.append(1)
        elif d.startswith('exp') and d[3:].isdigit():
            exp_dirs.append(int(d[3:]))
    if not exp_dirs:
        return 'exp'
    next_num = max(exp_dirs) + 1
    return f'exp{next_num}'


@app.route('/data_images_list')
def data_images_list():
    data_images_dir = os.path.join(current_dir, 'data', 'images')
    if not os.path.exists(data_images_dir):
        return jsonify([])
    files = []
    for f in os.listdir(data_images_dir):
        if os.path.isfile(os.path.join(data_images_dir, f)):
            is_video = f.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))
            is_image = f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.bmp'))
            if is_image:
                files.append({'filename': f, 'type': 'image'})
            elif is_video:
                files.append({'filename': f, 'type': 'video'})
    return jsonify(files)


@app.route('/runs_list')
def runs_list():
    detect_dir = os.path.join(current_dir, 'runs', 'detect')
    if not os.path.exists(detect_dir):
        return jsonify([])
    dirs = [d for d in os.listdir(detect_dir) if os.path.isdir(os.path.join(detect_dir, d))]
    
    def parse_exp(name):
        if name == 'exp':
            return 1
        if name.startswith('exp') and name[3:].isdigit():
            return int(name[3:])
        return 0
        
    dirs.sort(key=parse_exp, reverse=True)
    return jsonify(dirs)


@app.route('/run_details/<run_name>')
def run_details(run_name):
    detect_dir = os.path.join(current_dir, 'runs', 'detect')
    run_path = os.path.join(detect_dir, run_name)
    if not os.path.exists(run_path):
        return jsonify({'error': 'Run not found'}), 404
        
    files = []
    for f in os.listdir(run_path):
        if os.path.isfile(os.path.join(run_path, f)):
            is_video = f.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))
            is_image = f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.bmp'))
            if is_image:
                files.append({'filename': f, 'type': 'image'})
            elif is_video:
                files.append({'filename': f, 'type': 'video'})
                
    return jsonify({
        'run_name': run_name,
        'files': files
    })


@app.route('/serve_run/<run_name>/<filename>')
def serve_run(run_name, filename):
    detect_dir = os.path.join(current_dir, 'runs', 'detect')
    run_path = os.path.join(detect_dir, run_name)
    return send_from_directory(run_path, filename)


@app.route('/run_batch_detect', methods=['POST'])
def run_batch_detect():
    data_images_dir = os.path.join(current_dir, 'data', 'images')
    if not os.path.exists(data_images_dir):
        return jsonify({'error': 'data/images directory not found'}), 400
    
    files = [f for f in os.listdir(data_images_dir) if os.path.isfile(os.path.join(data_images_dir, f))]
    if not files:
        return jsonify({'error': 'No files in data/images to process'}), 400
        
    detect_dir = os.path.join(current_dir, 'runs', 'detect')
    run_name = get_next_run_dir(detect_dir)
    run_path = os.path.join(detect_dir, run_name)
    os.makedirs(run_path, exist_ok=True)
    
    processed_files = []
    
    for filename in files:
        input_file_path = os.path.join(data_images_dir, filename)
        output_file_path = os.path.join(run_path, filename)
        
        is_video = filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))
        is_image = filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.bmp'))
        
        if is_image:
            try:
                img = Image.open(input_file_path).convert('RGB')
                results = model(img)
                results.render()
                rendered_img = Image.fromarray(results.ims[0])
                rendered_img.save(output_file_path)
                processed_files.append({
                    'filename': filename,
                    'type': 'image',
                    'success': True
                })
            except Exception as e:
                processed_files.append({
                    'filename': filename,
                    'type': 'image',
                    'success': False,
                    'error': str(e)
                })
        elif is_video:
            try:
                cap = cv2.VideoCapture(input_file_path)
                if not cap.isOpened():
                    raise Exception("Could not open video file")
                
                fps    = cap.get(cv2.CAP_PROP_FPS) or 25
                width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                
                fourcc = cv2.VideoWriter_fourcc(*'avc1')
                out = cv2.VideoWriter(output_file_path, fourcc, fps, (width, height))
                
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = model(img_rgb, size=640)
                    results.render()
                    annotated = cv2.cvtColor(results.ims[0], cv2.COLOR_RGB2BGR)
                    out.write(annotated)
                    
                cap.release()
                out.release()
                processed_files.append({
                    'filename': filename,
                    'type': 'video',
                    'success': True
                })
            except Exception as e:
                processed_files.append({
                    'filename': filename,
                    'type': 'video',
                    'success': False,
                    'error': str(e)
                })
                
    return jsonify({
        'success': True,
        'run_name': run_name,
        'results': processed_files
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
