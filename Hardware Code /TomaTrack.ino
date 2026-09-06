#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =====================
// PIN CONFIG
// =====================
#define DHT_PIN 4
#define DHT_TYPE DHT22

#define SOIL_PIN 34
#define BUZZER_PIN 25
#define BUTTON_PIN 27

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

// =====================
// SOIL CALIBRATION
// =====================
// Berdasarkan hasil pengujian kamu:
// kering/udara ≈ 4095
// basah ≈ 2064

const int SOIL_DRY = 4095;
const int SOIL_WET = 2064;

// =====================
// WIFI CONFIG
// =====================
const char* WIFI_SSID = "Your SSID";
const char* WIFI_PASSWORD = "Your Password";

// =====================
// MQTT CONFIG
// =====================
const char* MQTT_BROKER = "broker.hivemq.com";
const int MQTT_PORT = 1883;

const char* TOPIC_TEMPERATURE = "plantguard/sensor/temperature";
const char* TOPIC_HUMIDITY = "plantguard/sensor/humidity";
const char* TOPIC_SOIL = "plantguard/sensor/soil";
const char* TOPIC_STATUS = "plantguard/sensor/status";

// =====================
// OBJECTS
// =====================
DHT dht(DHT_PIN, DHT_TYPE);

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  OLED_RESET
);

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// =====================
// VARIABLES
// =====================
float temperature = 0;
float humidity = 0;

int soilRaw = 0;
int soilPercent = 0;

bool monitoringActive = true;

unsigned long previousSensorMillis = 0;
unsigned long previousMqttMillis = 0;

const unsigned long SENSOR_INTERVAL = 2000;
const unsigned long MQTT_INTERVAL = 2000;

// =====================
// WIFI
// =====================
void connectWiFi() {
  Serial.println();
  Serial.print("Menghubungkan ke WiFi ");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi terhubung");

  Serial.print("IP ESP32: ");
  Serial.println(WiFi.localIP());
}

// =====================
// MQTT
// =====================
void connectMQTT() {
  while (!mqttClient.connected()) {

    Serial.print("Menghubungkan MQTT...");

    String clientId = "PlantGuard-ESP32-";
    clientId += String(random(0xffff), HEX);

    if (mqttClient.connect(clientId.c_str())) {

      Serial.println(" berhasil");

      mqttClient.publish(
        TOPIC_STATUS,
        "ONLINE",
        true
      );

    } else {

      Serial.print(" gagal, rc=");
      Serial.println(mqttClient.state());

      delay(2000);
    }
  }
}

// =====================
// SOIL
// =====================
int readSoilPercentage() {

  soilRaw = analogRead(SOIL_PIN);

  int percent = map(
    soilRaw,
    SOIL_DRY,
    SOIL_WET,
    0,
    100
  );

  percent = constrain(percent, 0, 100);

  return percent;
}

// =====================
// BUZZER
// =====================
void buzzerBeep(int frequency, int duration) {

  tone(
    BUZZER_PIN,
    frequency,
    duration
  );

  delay(duration);

  noTone(BUZZER_PIN);
}

void soilWarning() {

  if (soilPercent <= 30) {

    buzzerBeep(2000, 150);
    delay(100);

    buzzerBeep(2000, 150);
  }
}

// =====================
// OLED
// =====================
void updateOLED() {

  display.clearDisplay();

  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(1);

  display.setCursor(0, 0);
  display.println("PLANTGUARD V1");

  display.drawLine(
    0,
    10,
    127,
    10,
    SSD1306_WHITE
  );

  display.setCursor(0, 18);

  if (!monitoringActive) {

    display.println("Monitoring OFF");

    display.setCursor(0, 35);
    display.println("Tekan tombol");

    display.setCursor(0, 45);
    display.println("untuk mulai");

  } else {

    display.print("T : ");
    display.print(temperature, 1);
    display.println(" C");

    display.print("H : ");
    display.print(humidity, 1);
    display.println(" %");

    display.print("Soil : ");
    display.print(soilPercent);
    display.println(" %");

    if (soilPercent <= 30) {

      display.setCursor(0, 52);
      display.println("STATUS: TANAH KERING");

    } else {

      display.setCursor(0, 52);
      display.println("STATUS: NORMAL");
    }
  }

  display.display();
}

// =====================
// SENSOR
// =====================
void readSensors() {

  humidity = dht.readHumidity();
  temperature = dht.readTemperature();

  soilPercent = readSoilPercentage();

  Serial.println();
  Serial.println("===== PLANTGUARD =====");

  if (isnan(temperature) || isnan(humidity)) {

    Serial.println("DHT22 gagal dibaca");

  } else {

    Serial.print("Temperature : ");
    Serial.print(temperature);
    Serial.println(" C");

    Serial.print("Humidity    : ");
    Serial.print(humidity);
    Serial.println(" %");
  }

  Serial.print("Soil Raw    : ");
  Serial.println(soilRaw);

  Serial.print("Soil        : ");
  Serial.print(soilPercent);
  Serial.println(" %");

  Serial.println("======================");
}

// =====================
// MQTT PUBLISH
// =====================
void publishSensorData() {

  if (!mqttClient.connected()) {
    connectMQTT();
  }

  if (
    isnan(temperature) ||
    isnan(humidity)
  ) {
    return;
  }

  char tempPayload[16];
  char humidityPayload[16];
  char soilPayload[16];

  dtostrf(
    temperature,
    1,
    2,
    tempPayload
  );

  dtostrf(
    humidity,
    1,
    2,
    humidityPayload
  );

  sprintf(
    soilPayload,
    "%d",
    soilPercent
  );

  mqttClient.publish(
    TOPIC_TEMPERATURE,
    tempPayload
  );

  mqttClient.publish(
    TOPIC_HUMIDITY,
    humidityPayload
  );

  mqttClient.publish(
    TOPIC_SOIL,
    soilPayload
  );

  Serial.println("Data berhasil dikirim ke MQTT");
}

// =====================
// BUTTON
// =====================
void checkButton() {

  static bool lastButtonState = HIGH;
  static unsigned long lastDebounceTime = 0;

  bool currentButtonState =
    digitalRead(BUTTON_PIN);

  if (
    currentButtonState == LOW &&
    lastButtonState == HIGH &&
    millis() - lastDebounceTime > 250
  ) {

    monitoringActive = !monitoringActive;

    lastDebounceTime = millis();

    Serial.println();

    if (monitoringActive) {

      Serial.println("MONITORING ON");

      buzzerBeep(
        1500,
        100
      );

    } else {

      Serial.println("MONITORING OFF");

      buzzerBeep(
        800,
        150
      );
    }

    updateOLED();
  }

  lastButtonState =
    currentButtonState;
}

// =====================
// SETUP
// =====================
void setup() {

  Serial.begin(115200);

  pinMode(
    BUTTON_PIN,
    INPUT_PULLUP
  );

  pinMode(
    BUZZER_PIN,
    OUTPUT
  );

  dht.begin();

  Wire.begin(
    21,
    22
  );

  if (
    !display.begin(
      SSD1306_SWITCHCAPVCC,
      0x3C
    )
  ) {

    Serial.println(
      "OLED gagal"
    );

    while (true);
  }

  display.clearDisplay();

  display.setTextColor(
    SSD1306_WHITE
  );

  display.setTextSize(1);

  display.setCursor(20, 20);

  display.println(
    "PLANTGUARD V1"
  );

  display.setCursor(20, 35);

  display.println(
    "Starting..."
  );

  display.display();

  delay(1000);

  connectWiFi();

  mqttClient.setServer(
    MQTT_BROKER,
    MQTT_PORT
  );

  connectMQTT();

  buzzerBeep(
    1200,
    100
  );

  readSensors();

  updateOLED();
}

// =====================
// LOOP
// =====================
void loop() {

  mqttClient.loop();

  checkButton();

  if (!monitoringActive) {
    return;
  }

  unsigned long currentMillis =
    millis();

  if (
    currentMillis -
    previousSensorMillis >=
    SENSOR_INTERVAL
  ) {

    previousSensorMillis =
      currentMillis;

    readSensors();

    updateOLED();

    soilWarning();
  }

  if (
    currentMillis -
    previousMqttMillis >=
    MQTT_INTERVAL
  ) {

    previousMqttMillis =
      currentMillis;

    publishSensorData();
  }
}
