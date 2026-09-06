#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>

// ===========================
// Select camera model in board_config.h
// ===========================
#include "board_config.h"

// ===========================
// Enter your WiFi credentials
// ===========================
const char *ssid = "**********";
const char *password = "**********";

void startCameraServer();
void setupLedFlash();

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

  camera_config_t config;

  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;

  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;

  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;

  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;

  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;

  config.xclk_freq_hz = 20000000;

  // =====================================================
  // CAMERA CONFIGURATION
  // =====================================================
  // Kamera yang kita pakai sebelumnya berhasil menggunakan
  // RGB565 pada resolusi QVGA (320x240).
  // =====================================================
  config.frame_size = FRAMESIZE_QVGA;
  config.pixel_format = PIXFORMAT_RGB565;

  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;

  // RGB565 tidak menggunakan JPEG quality.
  config.jpeg_quality = 12;
  config.fb_count = 1;

  // =====================================================
  // CAMERA INIT
  // =====================================================
  esp_err_t err = esp_camera_init(&config);

  if (err != ESP_OK) {
    Serial.printf(
      "Camera init failed with error 0x%x\n",
      err
    );

    return;
  }

  Serial.println("Camera initialized successfully.");

  // =====================================================
  // CAMERA SENSOR SETTINGS
  // =====================================================
  sensor_t *s = esp_camera_sensor_get();

  if (s == nullptr) {
    Serial.println("ERROR: Camera sensor not found.");
    return;
  }

  // Untuk sensor tertentu
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);
    s->set_brightness(s, 1);
    s->set_saturation(s, -2);
  }

#if defined(CAMERA_MODEL_M5STACK_WIDE) || \
    defined(CAMERA_MODEL_M5STACK_ESP32CAM)

  s->set_vflip(s, 1);
  s->set_hmirror(s, 1);

#endif

#if defined(CAMERA_MODEL_ESP32S3_EYE)

  s->set_vflip(s, 1);

#endif

  // =====================================================
  // FLASH LED
  // =====================================================
#if defined(LED_GPIO_NUM)

  setupLedFlash();

#endif

  // =====================================================
  // WIFI
  // =====================================================
  WiFi.begin(ssid, password);

  // Disable WiFi sleep supaya koneksi ke laptop/server
  // lebih stabil.
  WiFi.setSleep(false);

  Serial.print("WiFi connecting");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");

  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // =====================================================
  // CAMERA WEB SERVER
  // =====================================================
  startCameraServer();

  Serial.print("Camera Ready! Use 'http://");
  Serial.print(WiFi.localIP());
  Serial.println("' to connect");

  Serial.println();
  Serial.println("Camera configuration:");
  Serial.println("Resolution : 320x240");
  Serial.println("Format     : RGB565");
}

// =====================================================
// LOOP
// =====================================================
void loop() {
  // Camera WebServer berjalan pada task tersendiri.
  delay(10000);
}