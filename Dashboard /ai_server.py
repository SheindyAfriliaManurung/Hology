import base64
import threading
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import paho.mqtt.client as mqtt
import requests
import tensorflow as tf
from flask import Flask, jsonify, request

# =========================================================
# PLANTGUARD V1 CONFIGURATION
# =========================================================

ESP32_CAM_IP = "Your IP"
ESP32_CAPTURE_URL = f"http://{ESP32_CAM_IP}/capture"

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "tomato_model.keras"
CAPTURE_DIR = BASE_DIR / "captures"

MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883

# Batas waktu (detik) menunggu proses publish MQTT selesai.
# Kalau broker lambat/nge-hang, request /api/capture tetap lanjut
# mengirim hasil ke dashboard tanpa menunggu MQTT selesai.
MQTT_PUBLISH_TIMEOUT = 5

TOPIC_DISEASE = "plantguard/ai/disease"
TOPIC_CONFIDENCE = "plantguard/ai/confidence"
TOPIC_STATUS = "plantguard/ai/status"
TOPIC_IMAGE = "plantguard/image"

# Legacy topics are also published so older dashboard revisions still work.
TOPIC_DISEASE_LEGACY = "plantguard/disease"
TOPIC_CONFIDENCE_LEGACY = "plantguard/confidence"

CLASS_NAMES = [
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites_Two_spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy",
]

MIN_CONFIDENCE = 65.0
MIN_CONFIDENCE_GAP = 15.0
MIN_GREEN_RATIO = 0.05

# =========================================================
# INITIALIZATION
# =========================================================

app = Flask(__name__)
CAPTURE_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 60)
print("PLANTGUARD V1 - AI SERVER")
print("=" * 60)
print("Loading model:", MODEL_PATH)

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model tidak ditemukan: {MODEL_PATH}\n"
        "Letakkan tomato_model.keras di folder yang sama dengan ai_server.py"
    )

MODEL = tf.keras.models.load_model(MODEL_PATH)
MODEL_LOCK = threading.Lock()
print("Model berhasil dimuat.")

# =========================================================
# CORS FOR LOCAL DASHBOARD
# =========================================================

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    response.headers["Cache-Control"] = "no-store"
    return response

# =========================================================
# IMAGE / AI
# =========================================================

def get_green_ratio(image_bgr):
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    lower_green = np.array([35, 40, 30])
    upper_green = np.array([95, 255, 255])
    mask = cv2.inRange(hsv, lower_green, upper_green)
    return float(np.count_nonzero(mask)) / float(mask.size)


def capture_image():
    response = requests.get(
        ESP32_CAPTURE_URL,
        timeout=15,
    )
    response.raise_for_status()

    content_type = response.headers.get("Content-Type", "").lower()
    if "image" not in content_type and len(response.content) < 1000:
        raise ValueError("ESP32-CAM tidak mengembalikan data gambar yang valid")

    filename = f"daun_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
    image_path = CAPTURE_DIR / filename
    image_path.write_bytes(response.content)

    return image_path, filename, response.content


def run_ai(image_path):
    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError("Foto hasil capture tidak dapat dibaca oleh OpenCV")

    green_ratio = get_green_ratio(image)

    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image_resized = cv2.resize(image_rgb, (224, 224))

    # Model sudah memiliki layer Rescaling(1/255), jadi JANGAN dibagi 255 lagi.
    input_image = np.expand_dims(image_resized, axis=0)

    with MODEL_LOCK:
        prediction = MODEL.predict(input_image, verbose=0)[0]

    order = np.argsort(prediction)[::-1]
    top3 = [
        {
            "class": CLASS_NAMES[int(index)],
            "confidence": float(prediction[index] * 100),
        }
        for index in order[:3]
    ]

    predicted_class = top3[0]["class"]
    confidence = top3[0]["confidence"]
    confidence_gap = top3[0]["confidence"] - top3[1]["confidence"]

    unknown_reasons = []
    if confidence < MIN_CONFIDENCE:
        unknown_reasons.append("confidence rendah")
    if confidence_gap < MIN_CONFIDENCE_GAP:
        unknown_reasons.append("selisih prediksi kecil")
    if green_ratio < MIN_GREEN_RATIO:
        unknown_reasons.append("karakteristik daun hijau rendah")

    is_unknown = len(unknown_reasons) > 0
    disease = "UNKNOWN" if is_unknown else predicted_class
    status = "UNKNOWN" if is_unknown else "DETECTED"

    return {
        "disease": disease,
        "raw_prediction": predicted_class,
        "confidence": confidence,
        "confidence_gap": confidence_gap,
        "green_ratio": green_ratio,
        "top3": top3,
        "is_unknown": is_unknown,
        "unknown_reasons": unknown_reasons,
        "status": status,
    }


def publish_mqtt(result, filename):
    """
    Berjalan di thread terpisah (lihat pemanggilnya di capture_and_detect).
    Kalau broker lambat/nge-hang, ini cuma bikin thread ini yang telat
    selesai — request /api/capture di thread utama TIDAK ikut nge-block,
    karena thread utama cuma nunggu maksimal MQTT_PUBLISH_TIMEOUT detik.
    """
    client = mqtt.Client()
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()

        client.publish(TOPIC_STATUS, result["status"], qos=0, retain=False)
        client.publish(TOPIC_DISEASE, result["disease"], qos=0, retain=False)
        client.publish(TOPIC_CONFIDENCE, f'{result["confidence"]:.2f}', qos=0, retain=False)
        client.publish(TOPIC_IMAGE, filename, qos=0, retain=False)

        # Compatibility with older dashboard topic names.
        client.publish(TOPIC_DISEASE_LEGACY, result["disease"], qos=0, retain=False)
        client.publish(TOPIC_CONFIDENCE_LEGACY, f'{result["confidence"]:.2f}', qos=0, retain=False)

    finally:
        client.loop_stop()
        client.disconnect()


def publish_mqtt_with_timeout(result, filename):
    """
    Menjalankan publish_mqtt() di thread terpisah dan menunggu
    maksimal MQTT_PUBLISH_TIMEOUT detik. Kalau lebih lama dari itu,
    fungsi ini langsung return supaya /api/capture tetap responsif,
    sementara thread MQTT tetap jalan di background sampai selesai
    (atau mati sendiri kalau proses server berhenti, karena daemon=True).
    """
    mqtt_error_holder = {}

    def runner():
        try:
            publish_mqtt(result, filename)
        except Exception as error:
            mqtt_error_holder["error"] = str(error)

    mqtt_thread = threading.Thread(target=runner, daemon=True)
    mqtt_thread.start()
    mqtt_thread.join(timeout=MQTT_PUBLISH_TIMEOUT)

    if mqtt_thread.is_alive():
        return f"MQTT belum selesai dalam {MQTT_PUBLISH_TIMEOUT} detik, dilanjutkan tanpa menunggu (proses tetap jalan di background)."

    if "error" in mqtt_error_holder:
        return mqtt_error_holder["error"]

    return None

# =========================================================
# API
# =========================================================

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify(
        {
            "ok": True,
            "model_loaded": MODEL is not None,
            "esp32_capture_url": ESP32_CAPTURE_URL,
        }
    )


@app.route("/api/capture", methods=["POST", "OPTIONS"])
def capture_and_detect():
    if request.method == "OPTIONS":
        return ("", 204)

    try:
        print("\n[1/4] Mengambil foto dari ESP32-CAM...")
        image_path, filename, image_bytes = capture_image()
        print("      OK:", filename)

        print("[2/4] Menjalankan model MobileNetV2...")
        result = run_ai(image_path)
        print(
            "      Result:",
            result["disease"],
            f'{result["confidence"]:.2f}%'
        )

        print("[3/4] Mengirim hasil ke MQTT...")
        mqtt_warning = publish_mqtt_with_timeout(result, filename)
        if mqtt_warning:
            print("      MQTT WARNING:", mqtt_warning)
        else:
            print("      MQTT OK")

        print("[4/4] Mengirim hasil ke dashboard...")
        image_data_url = (
            "data:image/jpeg;base64," +
            base64.b64encode(image_bytes).decode("ascii")
        )

        return jsonify(
            {
                "ok": True,
                "filename": filename,
                "image_data_url": image_data_url,
                "disease": result["disease"],
                "raw_prediction": result["raw_prediction"],
                "confidence": round(result["confidence"], 2),
                "confidence_gap": round(result["confidence_gap"], 2),
                "green_ratio": round(result["green_ratio"] * 100, 2),
                "top3": result["top3"],
                "is_unknown": result["is_unknown"],
                "unknown_reasons": result["unknown_reasons"],
                "status": result["status"],
                "mqtt_warning": mqtt_warning,
            }
        )

    except requests.RequestException as error:
        print("CAMERA ERROR:", error)
        return jsonify(
            {
                "ok": False,
                "error": (
                    "ESP32-CAM tidak dapat diakses. "
                    "Periksa IP kamera, Wi-Fi, dan endpoint /capture. "
                    f"Detail: {error}"
                ),
            }
        ), 502

    except Exception as error:
        print("SERVER ERROR:", error)
        return jsonify(
            {
                "ok": False,
                "error": str(error),
            }
        ), 500


if __name__ == "__main__":
    print("AI API: http://127.0.0.1:5000")
    print("Health: http://127.0.0.1:5000/api/health")
    print("Dashboard boleh dibuka lewat VS Code Live Server.")
    print("Tekan Ctrl+C untuk menghentikan server.")
    print("=" * 60)
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False,
        threaded=True,
    )
