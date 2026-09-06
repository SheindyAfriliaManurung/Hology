/* =========================================================
   TOMATO MONITOR / TomaTrack
   Dashboard Application
   MQTT + SENSOR + AI + ESP32-CAM
========================================================= */


/* =========================================================
   MQTT CONFIGURATION
========================================================= */

const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";


/* =========================================================
   LOCAL AI SERVER + ESP32-CAM
========================================================= */

const AI_API_BASE = "http:/your ip ";

const ESP32_CAM_STREAM =
    "http://your ip/stream";


/* =========================================================
   MQTT TOPICS
========================================================= */

const TOPICS = {

    temperature:
        "plantguard/sensor/temperature",

    humidity:
        "plantguard/sensor/humidity",

    soil:
        "plantguard/sensor/soil",

    sensorStatus:
        "plantguard/sensor/status",

    disease:
        "plantguard/ai/disease",

    diseaseLegacy:
        "plantguard/disease",

    confidence:
        "plantguard/ai/confidence",

    confidenceLegacy:
        "plantguard/confidence",

    detectionStatus:
        "plantguard/ai/status",

    image:
        "plantguard/image"

};


/* =========================================================
   APPLICATION STATE
========================================================= */

let client = null;

let mqttConnecting = false;

let mqttReconnectTimer = null;

let sensorData = {

    temperature: null,

    humidity: null,

    soil: null,

    disease: null,

    confidence: null

};

let latestImage = null;

let historyData = [];


/* =========================================================
   DISEASE RECOMMENDATIONS
========================================================= */

const diseaseRecommendations = {

    "Tomato___Bacterial_spot": {

        title: "Bacterial Spot",

        recommendations: [
            "Hindari penyiraman dari atas yang membuat daun tetap basah.",
            "Kurangi kontak air dengan permukaan daun.",
            "Tingkatkan sirkulasi udara di sekitar tanaman.",
            "Pantau perkembangan bercak pada daun secara berkala."
        ],

        source: "University of Minnesota Extension",

        url:
            "https://extension.umn.edu/agriculture/specialty-crops/vegetable-farming/disease-management/bacterial-spot-of-tomato-and-pepper"

    },


    "Tomato___Early_blight": {

        title: "Early Blight",

        recommendations: [
            "Hindari kondisi daun terlalu sering basah.",
            "Gunakan penyiraman langsung ke media tanah.",
            "Jaga jarak tanaman agar sirkulasi udara lebih baik.",
            "Pantau daun bagian bawah karena gejala sering muncul di bagian tersebut."
        ],

        source: "UC Integrated Pest Management",

        url:
            "https://ipm.ucanr.edu/agriculture/tomato/early-blight/"

    },


    "Tomato___Late_blight": {

        title: "Late Blight",

        recommendations: [
            "Hindari daun tetap basah dalam waktu lama.",
            "Hindari penyiraman dari atas yang membasahi daun.",
            "Tingkatkan sirkulasi udara di sekitar tanaman.",
            "Pantau perkembangan bercak pada daun secara berkala."
        ],

        source: "Penn State Extension",

        url:
            "https://extension.psu.edu/tomato-potato-late-blight-in-the-home-garden"

    },


    "Tomato___Leaf_Mold": {

        title: "Leaf Mold",

        recommendations: [
            "Kurangi kelembapan berlebih di sekitar tanaman.",
            "Tingkatkan sirkulasi udara.",
            "Hindari daun tetap basah.",
            "Gunakan penyiraman langsung ke media tanah."
        ],

        source: "University of Minnesota Extension",

        url:
            "https://extension.umn.edu/agriculture/specialty-crops/vegetable-farming/disease-management/tomato-leaf-mold"

    },


    "Tomato___Septoria_leaf_spot": {

        title: "Septoria Leaf Spot",

        recommendations: [
            "Hindari penyiraman dari atas yang membasahi daun.",
            "Jaga daun tetap kering apabila memungkinkan.",
            "Tingkatkan sirkulasi udara di sekitar tanaman.",
            "Pantau perkembangan bercak pada daun."
        ],

        source: "Penn State Extension",

        url:
            "https://extension.psu.edu/tomato-diseases-and-disorders-in-the-home-garden"

    },


    "Tomato___Spider_mites_Two_spotted_spider_mite": {

        title: "Spider Mites",

        recommendations: [
            "Pantau tanaman yang mengalami stres air.",
            "Periksa permukaan daun secara berkala.",
            "Pastikan tanaman mendapatkan air yang cukup.",
            "Pantau perkembangan populasi tungau."
        ],

        source: "UC Integrated Pest Management",

        url:
            "https://ipm.ucanr.edu/home-and-landscape/spider-mites/"

    },


    "Tomato___Target_Spot": {

        title: "Target Spot",

        recommendations: [
            "Hindari penyiraman dari atas.",
            "Tingkatkan sirkulasi udara di sekitar tanaman.",
            "Kurangi kondisi yang membuat daun tetap basah.",
            "Pantau daun yang menunjukkan perkembangan bercak."
        ],

        source: "Pacific Pests, Pathogens & Weeds",

        url:
            "https://apps.lucidcentral.org/pppw_v13/text/web_mini/entities/tomato_target_spot_163.htm"

    },


    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {

        title: "Tomato Yellow Leaf Curl Virus",

        recommendations: [
            "Pantau keberadaan whitefly pada tanaman.",
            "Pisahkan atau singkirkan tanaman yang menunjukkan gejala berat sesuai praktik budidaya setempat.",
            "Gunakan bahan tanam yang sehat dan, bila tersedia, varietas yang memiliki ketahanan.",
            "Lakukan pemantauan rutin terhadap perkembangan gejala."
        ],

        source: "UC Integrated Pest Management",

        url:
            "https://ipm.ucanr.edu/agriculture/tomato/tomato-yellow-leaf-curl/"

    },


    "Tomato___Tomato_mosaic_virus": {

        title: "Tomato Mosaic Virus",

        recommendations: [
            "Tidak ada pengobatan yang menghilangkan virus dari tanaman yang sudah terinfeksi.",
            "Pisahkan tanaman yang dicurigai terinfeksi.",
            "Jaga kebersihan tangan dan peralatan setelah menangani tanaman.",
            "Pantau tanaman lain untuk gejala serupa."
        ],

        source: "University of Minnesota Extension",

        url:
            "https://extension.umn.edu/agriculture/specialty-crops/vegetable-farming/disease-management/tomato-viruses"

    },


    "Tomato___healthy": {

        title: "Healthy",

        recommendations: [
            "Pertahankan kondisi tanaman yang sedang terpantau.",
            "Pantau suhu dan kelembapan secara berkala.",
            "Pantau kondisi kelembapan media menggunakan sensor.",
            "Lakukan pemeriksaan visual secara rutin."
        ],

        source: "Penn State Extension",

        url:
            "https://extension.psu.edu/tomatoes-from-seedlings-to-fruit"

    }

};


/* =========================================================
   DOM HELPER
========================================================= */

function el(id) {

    return document.getElementById(id);

}


function setText(id, value) {

    const element = el(id);

    if (element) {
        element.textContent = value;
    }

}


function setWidth(id, value) {

    const element = el(id);

    if (!element) {
        return;
    }

    const safe =
        Math.max(
            0,
            Math.min(
                100,
                Number(value) || 0
            )
        );

    element.style.width = safe + "%";

}


/* =========================================================
   MQTT STATUS
========================================================= */

function updateMQTTStatus(
    connected,
    customText = null
) {

    const text =
        customText ||
        (
            connected
                ? "MQTT Connected"
                : "MQTT Disconnected"
        );


    /*
       HTML KAMU:
       sidebar-status-dot
       sidebar-mqtt-status
       dashboard-mqtt
       mqtt-message

       Tidak memakai:
       mqtt-dot
       mqtt-status
       connection-badge
    */

    const sidebarDot =
        el("sidebar-status-dot");

    const sidebarText =
        el("sidebar-mqtt-status");

    const dashboardMQTT =
        el("dashboard-mqtt");

    const mqttMessage =
        el("mqtt-message");


    if (sidebarDot) {

        sidebarDot.className =
            connected
                ? "status-dot online"
                : "status-dot disconnected";

    }


    if (sidebarText) {

        sidebarText.textContent =
            text;

    }


    if (dashboardMQTT) {

        dashboardMQTT.textContent =
            connected
                ? "Connected"
                : text;

    }


    if (mqttMessage) {

        mqttMessage.textContent =
            connected
                ? "MQTT connected. Menunggu data sensor..."
                : text;

    }


    const headerLive =
        el("header-live");

    if (headerLive) {

        headerLive.textContent =
            connected
                ? "LIVE"
                : "OFFLINE";

    }


    console.log(
        "MQTT STATUS:",
        connected ? "CONNECTED" : "DISCONNECTED",
        text
    );

}


/* =========================================================
   MQTT CONNECT
========================================================= */

function connectMQTT() {

    if (mqttConnecting) {
        return;
    }


    if (
        typeof mqtt === "undefined"
    ) {

        console.error(
            "MQTT.js belum tersedia."
        );

        updateMQTTStatus(
            false,
            "MQTT Library Error"
        );

        clearTimeout(
            mqttReconnectTimer
        );

        mqttReconnectTimer =
            setTimeout(
                connectMQTT,
                3000
            );

        return;

    }


    mqttConnecting = true;


    const clientId =
        "PlantGuardV1_" +
        Math.random()
            .toString(16)
            .slice(2) +
        Date.now()
            .toString(16);


    console.log(
        "================================="
    );

    console.log(
        "MQTT CONNECTING"
    );

    console.log(
        "Broker:",
        MQTT_BROKER
    );

    console.log(
        "Client ID:",
        clientId
    );

    console.log(
        "================================="
    );


    try {

        if (client) {

            try {

                client.removeAllListeners();
                client.end(
                    true
                );

            }

            catch (error) {

                console.warn(
                    "Previous client cleanup:",
                    error
                );

            }

        }


        client =
            mqtt.connect(
                MQTT_BROKER,
                {

                    clientId:
                        clientId,

                    clean:
                        true,

                    connectTimeout:
                        15000,

                    keepalive:
                        30,

                    reconnectPeriod:
                        5000,

                    protocolVersion:
                        4

                }
            );


        client.on(
            "connect",
            function() {

                onMQTTConnected();

            }
        );


        client.on(
            "message",
            function(
                topic,
                payload
            ) {

                onMQTTMessage(
                    topic,
                    payload
                );

            }
        );


        client.on(
            "reconnect",
            function() {

                mqttConnecting =
                    true;

                console.log(
                    "MQTT reconnecting..."
                );

                updateMQTTStatus(
                    false,
                    "MQTT Reconnecting"
                );

            }
        );


        client.on(
            "offline",
            function() {

                mqttConnecting =
                    false;

                console.warn(
                    "MQTT offline"
                );

                updateMQTTStatus(
                    false,
                    "MQTT Offline"
                );

            }
        );


        client.on(
            "close",
            function() {

                mqttConnecting =
                    false;

                console.warn(
                    "MQTT connection closed"
                );

                updateMQTTStatus(
                    false,
                    "MQTT Disconnected"
                );

            }
        );


        client.on(
            "error",
            function(error) {

                mqttConnecting =
                    false;

                console.error(
                    "MQTT ERROR:",
                    error
                );

                updateMQTTStatus(
                    false,
                    "MQTT Error"
                );

            }
        );

    }

    catch (error) {

        mqttConnecting =
            false;

        console.error(
            "MQTT connect exception:",
            error
        );

        updateMQTTStatus(
            false,
            "MQTT Error"
        );


        clearTimeout(
            mqttReconnectTimer
        );


        mqttReconnectTimer =
            setTimeout(
                connectMQTT,
                5000
            );

    }

}


/* =========================================================
   MQTT CONNECTED
========================================================= */

function onMQTTConnected() {

    mqttConnecting =
        false;


    console.log(
        "================================="
    );

    console.log(
        "MQTT CONNECTED SUCCESSFULLY"
    );

    console.log(
        "Broker:",
        MQTT_BROKER
    );

    console.log(
        "================================="
    );


    updateMQTTStatus(
        true,
        "MQTT Connected"
    );


    subscribeTopics();

}


/* =========================================================
   MQTT SUBSCRIBE
========================================================= */

function subscribeTopics() {

    if (
        !client ||
        !client.connected
    ) {

        console.warn(
            "Cannot subscribe: MQTT belum connected."
        );

        return;

    }


    const topics =
        Object.values(
            TOPICS
        );


    console.log(
        "Subscribing to topics:",
        topics
    );


    let completed = 0;


    topics.forEach(
        function(topic) {

            client.subscribe(
                topic,
                {
                    qos: 0
                },
                function(error) {

                    if (error) {

                        console.error(
                            "Subscribe failed:",
                            topic,
                            error
                        );

                    }

                    else {

                        console.log(
                            "Subscribed:",
                            topic
                        );

                    }


                    completed++;


                    if (
                        completed ===
                        topics.length
                    ) {

                        console.log(
                            "MQTT topic subscription completed."
                        );

                        setText(
                            "mqtt-message",
                            "MQTT Connected — listening for sensor data..."
                        );

                    }

                }
            );

        }
    );

}


/* =========================================================
   MQTT MESSAGE
========================================================= */

function onMQTTMessage(
    topic,
    payloadBuffer
) {

    let payload = "";

    try {

        payload =
            payloadBuffer.toString();

    }

    catch (error) {

        payload =
            String(payloadBuffer);

    }


    onMessageArrived(
        {
            destinationName:
                topic,

            payloadString:
                payload
        }
    );

}


/* =========================================================
   MESSAGE ARRIVED
========================================================= */

function onMessageArrived(message) {

    const topic =
        message.destinationName;

    const payload =
        message.payloadString;


    console.log(
        "MQTT MESSAGE:",
        topic,
        payload
    );


    /*
       Tampilkan pesan terakhir
       di MQTT card.
    */

    setText(
        "mqtt-message",
        `${topic} → ${payload}`
    );


    try {

        switch (topic) {

            case TOPICS.temperature:

                updateTemperature(
                    parseFloat(payload)
                );

                break;


            case TOPICS.humidity:

                updateHumidity(
                    parseFloat(payload)
                );

                break;


            case TOPICS.soil:

                updateSoil(
                    parseFloat(payload)
                );

                break;


            case TOPICS.sensorStatus:

                updateSensorStatus(
                    payload
                );

                break;


            case TOPICS.disease:
            case TOPICS.diseaseLegacy:

                updateDisease(
                    payload
                );

                break;


            case TOPICS.confidence:
            case TOPICS.confidenceLegacy:

                updateConfidence(
                    parseFloat(payload)
                );

                break;


            case TOPICS.detectionStatus:

                updateDetectionStatus(
                    payload
                );

                break;


            case TOPICS.image:

                updateImage(
                    payload
                );

                break;

        }

    }

    catch (error) {

        /*
           Jangan sampai satu error UI
           memutus pemrosesan MQTT.
        */

        console.error(
            "MQTT message UI error:",
            error
        );

    }


    updateOverallStatus();

}


/* =========================================================
   TEMPERATURE
========================================================= */

function updateTemperature(value) {

    if (
        !Number.isFinite(value)
    ) {

        return;

    }


    sensorData.temperature =
        value;


    setText(
        "temperature",
        value.toFixed(1)
    );


    setText(
        "dashboard-temperature",
        value.toFixed(1) + " °C"
    );


    setText(
        "health-temperature",
        value.toFixed(1) + " °C"
    );


    setText(
        "analysis-temperature",
        value.toFixed(1) + " °C"
    );


    let status =
        "Monitoring";


    if (value < 15) {

        status =
            "Low temperature";

    }

    else if (value > 35) {

        status =
            "High temperature";

    }


    setText(
        "temperature-status",
        status
    );


    setText(
        "dashboard-temp-status",
        "Active"
    );


    setWidth(
        "temperature-progress",
        ((value - 10) / 35) * 100
    );


    const badge =
        el("temperature-badge");


    if (badge) {

        if (
            value >= 20 &&
            value <= 32
        ) {

            badge.textContent =
                "NORMAL";

            badge.className =
                "badge badge-normal";

        }

        else {

            badge.textContent =
                "CHECK";

            badge.className =
                "badge badge-ai";

        }

    }


    updatePlantStatus();

}


/* =========================================================
   HUMIDITY
========================================================= */

function updateHumidity(value) {

    if (
        !Number.isFinite(value)
    ) {

        return;

    }


    sensorData.humidity =
        value;


    /*
       HTML saat ini tidak punya
       kartu humidity.
       Data tetap disimpan agar
       sistem MQTT lengkap.
    */


    setText(
        "humidity",
        value.toFixed(1)
    );


    setText(
        "humidity-status",
        value >= 85
            ? "Very humid"
            : value >= 70
                ? "High humidity"
                : value < 40
                    ? "Low humidity"
                    : "Monitoring"
    );


    setText(
        "humidity-analysis",
        `Kelembapan udara terpantau ${value.toFixed(1)}%.`
    );


    updatePlantStatus();

}


/* =========================================================
   SOIL MOISTURE
========================================================= */

function updateSoil(value) {

    if (
        !Number.isFinite(value)
    ) {

        return;

    }


    sensorData.soil =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );


    const soil =
        sensorData.soil;


    setText(
        "soil",
        soil.toFixed(0)
    );


    setText(
        "dashboard-soil",
        soil.toFixed(0) + " %"
    );


    setText(
        "health-soil",
        soil.toFixed(0) + " %"
    );


    setText(
        "analysis-soil",
        soil.toFixed(0) + " %"
    );


    setWidth(
        "soil-progress",
        soil
    );


    let status =
        "Monitoring";


    if (soil < 25) {

        status =
            "Low moisture";

    }

    else if (soil > 85) {

        status =
            "High moisture";

    }


    setText(
        "soil-status",
        status
    );


    setText(
        "dashboard-soil-status",
        "Active"
    );


    const badge =
        el("soil-badge");


    if (badge) {

        if (
            soil >= 50 &&
            soil <= 80
        ) {

            badge.textContent =
                "OPTIMAL";

            badge.className =
                "badge badge-optimal";

        }

        else {

            badge.textContent =
                "CHECK";

            badge.className =
                "badge badge-ai";

        }

    }


    setText(
        "soil-analysis",
        `Nilai sensor kelembapan media terkalibrasi sekitar ${soil.toFixed(0)}%. Gunakan sebagai indikator kondisi air media, bukan indikator nutrisi.`
    );


    updatePlantStatus();

}


/* =========================================================
   SENSOR STATUS
========================================================= */

function updateSensorStatus(status) {

    const text =
        String(status)
            .toLowerCase();


    const active =
        text.includes("online") ||
        text.includes("active") ||
        text.includes("connected") ||
        text.includes("ready");


    setStatusDot(
        "sensor-dot",
        active
    );


    setText(
        "sensor-status",
        active
            ? "Sensor Active"
            : "Sensor Offline"
    );


    setText(
        "dashboard-temp-status",
        active
            ? "Active"
            : "Offline"
    );


    setText(
        "dashboard-soil-status",
        active
            ? "Active"
            : "Offline"
    );


    updateOverallStatus();

}


/* =========================================================
   DISEASE
========================================================= */

function updateDisease(
    disease
) {

    if (!disease) {
        return;
    }


    sensorData.disease =
        String(disease).trim();


    const pretty =
        formatDiseaseName(
            sensorData.disease
        );


    /*
       Monitoring card
    */

    setText(
        "prediction",
        pretty
    );


    /*
       Dashboard
    */

    setText(
        "dashboard-prediction",
        pretty
    );


    /*
       Analysis page
    */

    setText(
        "analysis-prediction",
        pretty
    );


    /*
       Health card
    */

    setText(
        "health-disease",
        pretty
    );


    /*
       Old / optional IDs
       tetap didukung kalau nanti
       ditambahkan ke HTML.
    */

    setText(
        "disease",
        pretty
    );


    setText(
        "disease-analysis",
        `Hasil deteksi terbaru: ${pretty}. Hasil ini berasal dari analisis citra daun menggunakan model AI.`
    );


    updateRecommendation(
        sensorData.disease
    );


    updatePlantStatus();


    addHistory();

}


/* =========================================================
   CONFIDENCE
========================================================= */

function updateConfidence(
    value
) {

    if (
        !Number.isFinite(value)
    ) {

        return;

    }


    sensorData.confidence =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );


    const confidence =
        sensorData.confidence;


    setText(
        "confidence",
        "Confidence: " +
        confidence.toFixed(2) +
        "%"
    );


    setText(
        "dashboard-confidence",
        confidence.toFixed(2) +
        "%"
    );


    setText(
        "analysis-confidence",
        confidence.toFixed(2) +
        "%"
    );


    setText(
        "average-confidence",
        confidence.toFixed(2) +
        "%"
    );


    setWidth(
        "confidence-progress",
        confidence
    );


    setWidth(
        "camera-confidence-progress",
        confidence
    );


    setText(
        "camera-confidence",
        confidence.toFixed(2) +
        "%"
    );


    addHistory();

}


/* =========================================================
   DETECTION STATUS
========================================================= */

function updateDetectionStatus(
    status
) {

    const text =
        String(status || "");


    const lower =
        text.toLowerCase();


    const active =
        lower.includes("online") ||
        lower.includes("active") ||
        lower.includes("ready") ||
        lower.includes("success") ||
        lower.includes("detected") ||
        lower.includes("complete");


    setStatusDot(
        "detection-dot",
        active
    );


    setText(
        "detection-status",
        active
            ? "Detection Active"
            : "Detection Offline"
    );


    setText(
        "dashboard-ai-status",
        active
            ? "Active"
            : "Waiting"
    );


    const badge =
        el("detection-badge");


    if (badge) {

        badge.textContent =
            active
                ? "ACTIVE"
                : "WAITING";

    }


    if (status) {

        setText(
            "camera-status",
            text
        );

    }


    updateOverallStatus();

}


/* =========================================================
   IMAGE
========================================================= */

function updateImage(
    source,
    filename = null
) {

    if (!source) {
        return;
    }


    const image =
        el("latest-plant-image");


    const placeholder =
        el("image-placeholder");


    const cameraStatus =
        el("camera-status");


    const imageTime =
        el("image-time");


    const imageFile =
        el("image-file");


    if (!image) {
        return;
    }


    const isDataUrl =
        String(source)
            .startsWith(
                "data:image/"
            );


    const cleanName =
        filename ||
        String(source)
            .split(/[\\/]/)
            .pop();


    latestImage =
        cleanName;


    image.onload =
        function() {

            image.classList
                .remove(
                    "hidden"
                );


            image.style.display =
                "block";


            if (placeholder) {

                placeholder.style.display =
                    "none";

            }


            if (cameraStatus) {

                cameraStatus.textContent =
                    "CAPTURED";

            }

        };


    image.onerror =
        function() {

            if (cameraStatus) {

                cameraStatus.textContent =
                    "IMAGE ERROR";

            }

        };


    image.src =
        isDataUrl
            ? source
            : "captures/" +
              encodeURIComponent(
                  cleanName
              ) +
              "?t=" +
              Date.now();


    if (imageTime) {

        imageTime.textContent =
            new Date()
                .toLocaleTimeString();

    }


    if (imageFile) {

        imageFile.textContent =
            cleanName;

    }

}


/* =========================================================
   RECOMMENDATION
========================================================= */

function updateRecommendation(
    disease
) {

    /*
       HTML kamu saat ini punya:
       id="recommendation"

       Jadi kita gunakan itu.

       Kalau nanti dibuat container
       recommendation-content,
       tetap akan didukung.
    */

    const container =
        el("recommendation") ||
        el("recommendation-content");


    if (!container) {
        return;
    }


    const data =
        diseaseRecommendations[
            disease
        ];


    if (!data) {

        container.innerHTML = `
            <div class="recommendation-empty">
                <div>⚠️</div>
                <p>
                    Belum tersedia rekomendasi
                    untuk kelas ini.
                </p>
            </div>
        `;

        return;

    }


    let html =
        `<div class="recommendation-list">`;


    data.recommendations
        .forEach(
            function(item) {

                html += `
                    <div class="recommendation-item">
                        ${item}
                    </div>
                `;

            }
        );


    html +=
        `</div>`;


    container.innerHTML =
        html;


    /*
       Optional source UI
    */

    const sourceBox =
        el("recommendation-source");


    if (sourceBox) {

        sourceBox.style.display =
            "flex";

    }


    setText(
        "source-name",
        data.source
    );


    const sourceLink =
        el("source-link");


    if (sourceLink) {

        sourceLink.href =
            data.url;

    }

}


/* =========================================================
   PLANT STATUS
========================================================= */

function updatePlantStatus() {

    const status =
        el("plant-status");


    if (!status) {
        return;
    }


    const disease =
        sensorData.disease;


    if (!disease) {

        status.textContent =
            "Waiting for sensor data";

        return;

    }


    if (
        disease ===
        "Tomato___healthy"
    ) {

        status.textContent =
            "Healthy";

    }

    else {

        status.textContent =
            "Attention";

    }

}


/* =========================================================
   OVERALL STATUS
========================================================= */

function updateOverallStatus() {

    const hasSensor =
        sensorData.temperature !== null ||
        sensorData.humidity !== null ||
        sensorData.soil !== null;


    if (hasSensor) {

        setStatusDot(
            "sensor-dot",
            true
        );


        setText(
            "sensor-status",
            "Sensor Active"
        );

    }


    if (sensorData.disease) {

        setStatusDot(
            "detection-dot",
            true
        );


        setText(
            "detection-status",
            "Detection Active"
        );


        setText(
            "dashboard-ai-status",
            "Active"
        );

    }

}


/* =========================================================
   STATUS DOT HELPER
========================================================= */

function setStatusDot(
    id,
    active
) {

    const element =
        el(id);


    if (!element) {
        return;
    }


    element.className =
        active
            ? "status-dot online"
            : "status-dot error";

}


/* =========================================================
   FORMAT DISEASE NAME
========================================================= */

function formatDiseaseName(
    disease
) {

    if (!disease) {

        return "Waiting for detection";

    }


    const names = {

        "Tomato___Bacterial_spot":
            "Bacterial Spot",

        "Tomato___Early_blight":
            "Early Blight",

        "Tomato___Late_blight":
            "Late Blight",

        "Tomato___Leaf_Mold":
            "Leaf Mold",

        "Tomato___Septoria_leaf_spot":
            "Septoria Leaf Spot",

        "Tomato___Spider_mites_Two_spotted_spider_mite":
            "Spider Mites",

        "Tomato___Target_Spot":
            "Target Spot",

        "Tomato___Tomato_Yellow_Leaf_Curl_Virus":
            "Tomato Yellow Leaf Curl Virus",

        "Tomato___Tomato_mosaic_virus":
            "Tomato Mosaic Virus",

        "Tomato___healthy":
            "Healthy"

    };


    return (
        names[disease] ||
        disease
            .replace(
                "Tomato___",
                ""
            )
            .replaceAll(
                "_",
                " "
            )
    );

}


/* =========================================================
   HISTORY
========================================================= */

function addHistory() {

    if (
        sensorData.temperature === null &&
        sensorData.humidity === null &&
        sensorData.soil === null &&
        sensorData.disease === null
    ) {

        return;

    }


    const item = {

        time:
            new Date()
                .toLocaleTimeString(),

        temperature:
            sensorData.temperature,

        soil:
            sensorData.soil,

        disease:
            sensorData.disease,

        confidence:
            sensorData.confidence

    };


    /*
       Hindari terlalu banyak
       duplicate history dari
       satu event.
    */

    const previous =
        historyData[0];


    if (
        previous &&
        previous.time === item.time &&
        previous.disease === item.disease &&
        previous.temperature === item.temperature &&
        previous.soil === item.soil &&
        previous.confidence === item.confidence
    ) {

        return;

    }


    historyData.unshift(
        item
    );


    historyData =
        historyData.slice(
            0,
            30
        );


    renderHistory();

}


/* =========================================================
   RENDER HISTORY
========================================================= */

function renderHistory() {

    /*
       HTML:
       <tbody id="history-table">
    */

    const body =
        el("history-table");


    if (!body) {
        return;
    }


    if (
        historyData.length === 0
    ) {

        body.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty-table">
                    Belum ada data monitoring.
                </td>
            </tr>
        `;

        return;

    }


    body.innerHTML =
        historyData
            .map(
                function(item) {

                    return `
                        <tr>

                            <td>
                                ${item.time}
                            </td>

                            <td>
                                ${
                                    item.temperature !== null
                                        ? item.temperature.toFixed(1) + " °C"
                                        : "--"
                                }
                            </td>

                            <td>
                                ${
                                    item.soil !== null
                                        ? item.soil.toFixed(0) + " %"
                                        : "--"
                                }
                            </td>

                            <td>
                                ${
                                    item.disease
                                        ? formatDiseaseName(
                                            item.disease
                                        )
                                        : "--"
                                }
                            </td>

                            <td>
                                ${
                                    item.confidence !== null
                                        ? item.confidence.toFixed(2) + "%"
                                        : "--"
                                }
                            </td>

                        </tr>
                    `;

                }
            )
            .join("");

}


/* =========================================================
   CLEAR HISTORY
========================================================= */

function initHistoryButton() {

    const button =
        el("clear-history");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        function() {

            historyData =
                [];

            renderHistory();

        }
    );

}


/* =========================================================
   NAVIGATION
========================================================= */

function initNavigation() {

    const links =
        document.querySelectorAll(
            ".nav-item"
        );


    links.forEach(
        function(link) {

            link.addEventListener(
                "click",
                function(event) {

                    event.preventDefault();


                    const page =
                        this.dataset.page;


                    links.forEach(
                        function(item) {

                            item.classList
                                .remove(
                                    "active"
                                );

                        }
                    );


                    this.classList
                        .add(
                            "active"
                        );


                    document
                        .querySelectorAll(
                            ".page-content"
                        )
                        .forEach(
                            function(section) {

                                section.classList
                                    .remove(
                                        "active-page"
                                    );

                            }
                        );


                    const target =
                        el(
                            "page-" +
                            page
                        );


                    if (target) {

                        target.classList
                            .add(
                                "active-page"
                            );

                    }

                }
            );

        }
    );

}


/* =========================================================
   CAMERA STREAM
========================================================= */

function initCameraStream(retryCount = 0) {

    const oldStream =
        el("camera-stream");


    const streamStatus =
        el("stream-status");


    const overlay =
        el(
            "camera-offline-overlay"
        );


    if (!oldStream) {
        return;
    }


    /*
       Ganti elemen <img> dengan yang
       baru (bukan cuma ganti src),
       supaya browser dipaksa buka
       koneksi HTTP baru ke ESP32-CAM,
       bukan nyoba reuse koneksi lama
       yang mungkin udah "rusak" /
       ke-block gara-gara stream
       sebelumnya diputus paksa.
    */

    const stream =
        oldStream.cloneNode(
            false
        );

    oldStream.replaceWith(
        stream
    );


    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1500;


    stream.onload =
        function() {

            if (streamStatus) {

                streamStatus.innerHTML =
                    '<span class="live-dot"></span> CAMERA LIVE';

                streamStatus.className =
                    "live-badge active";

            }


            if (overlay) {

                overlay.classList
                    .add(
                        "hidden"
                    );

            }

        };


    stream.onerror =
        function() {

            /*
               ESP32-CAM kadang butuh jeda
               sesaat buat lepas koneksi lama
               (misal abis dipakai capture)
               sebelum siap streaming lagi.
               Coba ulang beberapa kali dulu
               sebelum dianggap benar-benar
               offline.
            */

            if (retryCount < MAX_RETRIES) {

                if (streamStatus) {

                    streamStatus.innerHTML =
                        '<span class="live-dot"></span> CAMERA RECONNECTING...';

                    streamStatus.className =
                        "live-badge error";

                }

                setTimeout(
                    function() {

                        initCameraStream(
                            retryCount + 1
                        );

                    },
                    RETRY_DELAY_MS
                );

                return;

            }


            if (streamStatus) {

                streamStatus.innerHTML =
                    '<span class="live-dot"></span> CAMERA OFFLINE';

                streamStatus.className =
                    "live-badge error";

            }


            if (overlay) {

                overlay.classList
                    .remove(
                        "hidden"
                    );

            }

        };


    stream.src =
        ESP32_CAM_STREAM +
        "?t=" +
        Date.now();

}


/* =========================================================
   AI SERVER CHECK
========================================================= */

async function checkAIServer() {

    const status =
        el("ai-server-status");


    try {

        const response =
            await fetch(
                AI_API_BASE +
                "/api/health",
                {
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "AI server tidak merespons."
            );

        }


        const data =
            await response.json();


        if (status) {

            status.innerHTML =
                data.model_loaded
                    ? '<span class="live-dot"></span> AI SERVER READY'
                    : '<span class="live-dot"></span> MODEL NOT READY';


            status.className =
                data.model_loaded
                    ? "live-badge active"
                    : "live-badge error";

        }


        return (
            data.model_loaded === true
        );

    }

    catch (error) {

        console.warn(
            "AI server:",
            error.message
        );


        if (status) {

            status.innerHTML =
                '<span class="live-dot"></span> AI SERVER OFFLINE';

            status.className =
                "live-badge error";

        }


        return false;

    }

}


/* =========================================================
   CAMERA DETECTION UI
========================================================= */

function updateCameraDetectionUI(
    disease,
    confidence,
    statusText
) {

    setText(
        "camera-prediction",
        disease
            ? formatDiseaseName(
                disease
            )
            : "Waiting..."
    );


    const confidenceValue =
        Number(confidence) || 0;


    setText(
        "camera-confidence",
        confidenceValue.toFixed(2) +
        "%"
    );


    setWidth(
        "camera-confidence-progress",
        confidenceValue
    );


    setText(
        "camera-status",
        statusText ||
        "Detection complete."
    );

}


/* =========================================================
   CAPTURE & DETECT
========================================================= */

async function captureAndDetect() {

    const button =
        el(
            "capture-detect-button"
        );


    const processStatus =
        el(
            "capture-process-status"
        );


    if (!button) {
        return;
    }


    const originalText =
        button.textContent;


    button.disabled =
        true;


    button.textContent =
        "⏳ Capturing & Analyzing...";


    if (processStatus) {

        processStatus.textContent =
            "Mengambil foto dari ESP32-CAM dan menjalankan deteksi...";

    }


    updateDetectionStatus(
        "PROCESSING"
    );


    updateCameraDetectionUI(
        null,
        0,
        "AI sedang menganalisis gambar..."
    );

    try {

        const response =
            await fetch(
                AI_API_BASE +
                "/api/capture",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        "{}"
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.ok
        ) {

            throw new Error(
                data.error ||
                "Capture gagal."
            );

        }


        /*
           IMAGE
        */

        updateImage(
            data.image_data_url,
            data.filename
        );


        /*
           DISEASE
        */

        updateDisease(
            data.disease
        );


        /*
           CONFIDENCE
        */

        updateConfidence(
            Number(
                data.confidence
            )
        );


        /*
           CAMERA RESULT
        */

        updateCameraDetectionUI(
            data.disease,
            Number(
                data.confidence
            ),
            data.status ||
            "Detection complete."
        );


        updateDetectionStatus(
            data.status ||
            "DETECTED"
        );


        if (processStatus) {

            const pretty =
                formatDiseaseName(
                    data.disease
                );


            processStatus.textContent =
                `Selesai: ${pretty} (${Number(data.confidence).toFixed(2)}%)`;

        }

    }

    catch (error) {

        console.error(
            "Capture & detect gagal:",
            error
        );


        updateDetectionStatus(
            "ERROR"
        );


        updateCameraDetectionUI(
            null,
            0,
            "Detection Error"
        );


        if (processStatus) {

            processStatus.textContent =
                "Gagal: " +
                error.message;

        }


        alert(
            "Capture & Detect gagal.\n\n" +
            error.message +
            "\n\n" +
            "Pastikan ai_server.py sedang berjalan " +
            "dan ESP32-CAM dapat diakses."
        );

    }

    finally {

        button.disabled =
            false;


        button.textContent =
            originalText;

    }

}


/* =========================================================
   BUTTONS / CONTROLS
========================================================= */

function initControls() {

    const captureButton =
        el(
            "capture-detect-button"
        );


    if (captureButton) {

        captureButton.addEventListener(
            "click",
            captureAndDetect
        );

    }


    const saveControl =
        el("save-control");


    if (saveControl) {

        saveControl.addEventListener(
            "click",
            function() {

                const minMoisture =
                    el(
                        "min-moisture"
                    );


                const maxTemperature =
                    el(
                        "max-temperature"
                    );


                console.log(
                    "Control settings:",
                    {
                        minMoisture:
                            minMoisture
                                ? minMoisture.value
                                : null,

                        maxTemperature:
                            maxTemperature
                                ? maxTemperature.value
                                : null
                    }
                );


                alert(
                    "Pengaturan berhasil disimpan."
                );

            }
        );

    }

}


/* =========================================================
   CLOCK
========================================================= */

function updateClock() {

    const now =
        new Date();


    setText(
        "current-time",
        now.toLocaleTimeString()
    );

}


function initClock() {

    updateClock();


    setInterval(
        updateClock,
        1000
    );

}


/* =========================================================
   START APPLICATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        console.log(
            "================================="
        );

        console.log(
            "TOMATO MONITOR / PLANTGUARD V1"
        );

        console.log(
            "Application starting..."
        );

        console.log(
            "================================="
        );


        /*
           Initial UI
        */

        updateMQTTStatus(
            false,
            "MQTT Connecting..."
        );


        /*
           Independent services
        */

        initCameraStream();

        checkAIServer();

        initHistoryButton();

        initNavigation();

        initControls();

        initClock();


        /*
           MQTT
        */

        connectMQTT();


        /*
           AI server health check
        */

        setInterval(
            checkAIServer,
            10000
        );


        /*
           Initial history
        */

        renderHistory();

    }
);
