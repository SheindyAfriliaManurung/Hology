// =====================================================
// TOMATO MONITOR
// MQTT + NAVIGATION + HISTORY + CONTROL
// =====================================================


// =====================================================
// MQTT CONFIGURATION
// =====================================================

const MQTT_BROKER = "ws://localhost:9001";

const MQTT_USERNAME = "admin";

const MQTT_PASSWORD = "123456789";


// =====================================================
// GLOBAL DATA
// =====================================================

let sensorData = {

    temperature: null,

    soil: null,

    prediction: null,

    confidence: null

};


let historyData =
    JSON.parse(
        localStorage.getItem("tomatoHistory")
    ) || [];


// =====================================================
// MQTT CONNECTION
// =====================================================

const client = mqtt.connect(
    MQTT_BROKER,
    {

        username: MQTT_USERNAME,

        password: MQTT_PASSWORD,

        reconnectPeriod: 3000

    }
);


// =====================================================
// TIME
// =====================================================

function getCurrentTime() {

    const now = new Date();

    return now.toLocaleTimeString(
        "id-ID",
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    );

}


function updateClock() {

    const time =
        getCurrentTime();


    const clock =
        document.getElementById(
            "current-time"
        );


    if (clock) {

        clock.innerText = time;

    }


    document
        .querySelectorAll(".card-time")
        .forEach(
            function (element) {

                element.innerText = time;

            }
        );

}


setInterval(
    updateClock,
    1000
);


updateClock();


// =====================================================
// MQTT CONNECTED
// =====================================================

client.on(
    "connect",
    function () {

        console.log(
            "Connected to MQTT!"
        );


        updateMQTTStatus(
            true
        );


        // TEST TOPIC

        client.subscribe(
            "test"
        );


        // SENSOR TOPICS

        client.subscribe(
            "tomato/temperature"
        );


        client.subscribe(
            "tomato/soil_moisture"
        );


        // AI TOPICS

        client.subscribe(
            "tomato/prediction"
        );


        client.subscribe(
            "tomato/confidence"
        );

    }
);


// =====================================================
// MQTT STATUS
// =====================================================

function updateMQTTStatus(
    connected
) {

    const sidebarStatus =
        document.getElementById(
            "sidebar-mqtt-status"
        );


    const sidebarDot =
        document.getElementById(
            "sidebar-status-dot"
        );


    const dashboardMQTT =
        document.getElementById(
            "dashboard-mqtt"
        );


    const headerLive =
        document.getElementById(
            "header-live"
        );


    if (connected) {

        if (sidebarStatus) {

            sidebarStatus.innerText =
                "MQTT Connected";

        }


        if (sidebarDot) {

            sidebarDot.classList.remove(
                "disconnected"
            );

            sidebarDot.classList.add(
                "connected"
            );

        }


        if (dashboardMQTT) {

            dashboardMQTT.innerText =
                "Connected";

        }


        if (headerLive) {

            headerLive.innerText =
                "LIVE";

        }

    }

    else {

        if (sidebarStatus) {

            sidebarStatus.innerText =
                "MQTT Disconnected";

        }


        if (sidebarDot) {

            sidebarDot.classList.remove(
                "connected"
            );

            sidebarDot.classList.add(
                "disconnected"
            );

        }


        if (dashboardMQTT) {

            dashboardMQTT.innerText =
                "Disconnected";

        }


        if (headerLive) {

            headerLive.innerText =
                "OFFLINE";

        }

    }

}


// =====================================================
// MQTT MESSAGE
// =====================================================

client.on(
    "message",
    function (
        topic,
        message
    ) {

        const value =
            message
                .toString()
                .trim();


        console.log(
            "Topic:",
            topic,
            "Message:",
            value
        );


        // =================================================
        // TEST
        // =================================================

        if (topic === "test") {

            const mqttMessage =
                document.getElementById(
                    "mqtt-message"
                );


            if (mqttMessage) {

                mqttMessage.innerText =
                    value;

            }

        }


        // =================================================
        // TEMPERATURE
        // =================================================

        if (
            topic ===
            "tomato/temperature"
        ) {

            const temperature =
                parseFloat(value);


            if (
                !isNaN(
                    temperature
                )
            ) {

                sensorData.temperature =
                    temperature;

            }


            updateTemperature(
                temperature
            );


            updateHealthStatus();

            saveHistory();

        }


        // =================================================
        // SOIL MOISTURE
        // =================================================

        if (
            topic ===
            "tomato/soil_moisture"
        ) {

            const soil =
                parseFloat(value);


            if (
                !isNaN(
                    soil
                )
            ) {

                sensorData.soil =
                    soil;

            }


            updateSoil(
                soil
            );


            updateHealthStatus();

            saveHistory();

        }


        // =================================================
        // PREDICTION
        // =================================================

        if (
            topic ===
            "tomato/prediction"
        ) {

            sensorData.prediction =
                value;


            updatePrediction(
                value
            );


            updateHealthStatus();

            saveHistory();

        }


        // =================================================
        // CONFIDENCE
        // =================================================

        if (
            topic ===
            "tomato/confidence"
        ) {

            const confidence =
                parseFloat(value);


            if (
                !isNaN(
                    confidence
                )
            ) {

                sensorData.confidence =
                    confidence;

            }


            updateConfidence(
                confidence
            );


            saveHistory();

        }

    }
);


// =====================================================
// TEMPERATURE UPDATE
// =====================================================

function updateTemperature(
    value
) {

    if (isNaN(value)) {
        return;
    }


    const temperature =
        document.getElementById(
            "temperature"
        );


    if (temperature) {

        temperature.innerText =
            value.toFixed(1);

    }


    const dashboard =
        document.getElementById(
            "dashboard-temperature"
        );


    if (dashboard) {

        dashboard.innerText =
            value.toFixed(1) +
            " °C";

    }


    const health =
        document.getElementById(
            "health-temperature"
        );


    if (health) {

        health.innerText =
            value.toFixed(1) +
            " °C";

    }


    const analysis =
        document.getElementById(
            "analysis-temperature"
        );


    if (analysis) {

        analysis.innerText =
            value.toFixed(1) +
            " °C";

    }


    const status =
        document.getElementById(
            "temperature-status"
        );


    if (status) {

        status.innerText =
            "Data received";

    }


    const dashboardStatus =
        document.getElementById(
            "dashboard-temp-status"
        );


    if (dashboardStatus) {

        dashboardStatus.innerText =
            "Active";

    }


    // Progress

    let progress =
        (value / 50) * 100;


    progress =
        Math.max(
            0,
            Math.min(
                100,
                progress
            )
        );


    const progressBar =
        document.getElementById(
            "temperature-progress"
        );


    if (progressBar) {

        progressBar.style.width =
            progress + "%";

    }


    // Temperature status

    const badge =
        document.getElementById(
            "temperature-badge"
        );


    if (badge) {

        if (
            value >= 25 &&
            value <= 32
        ) {

            badge.innerText =
                "NORMAL";

            badge.style.background =
                "#28afd0";

        }

        else {

            badge.innerText =
                "WARNING";

            badge.style.background =
                "#f3a400";

        }

    }


    const dot =
        document.getElementById(
            "temperature-dot"
        );


    if (dot) {

        dot.style.background =
            "#4acb69";

    }

}


// =====================================================
// SOIL UPDATE
// =====================================================

function updateSoil(
    value
) {

    if (isNaN(value)) {
        return;
    }


    const soil =
        document.getElementById(
            "soil"
        );


    if (soil) {

        soil.innerText =
            value.toFixed(1);

    }


    const dashboard =
        document.getElementById(
            "dashboard-soil"
        );


    if (dashboard) {

        dashboard.innerText =
            value.toFixed(1) +
            " %";

    }


    const health =
        document.getElementById(
            "health-soil"
        );


    if (health) {

        health.innerText =
            value.toFixed(1) +
            " %";

    }


    const analysis =
        document.getElementById(
            "analysis-soil"
        );


    if (analysis) {

        analysis.innerText =
            value.toFixed(1) +
            " %";

    }


    const status =
        document.getElementById(
            "soil-status"
        );


    if (status) {

        status.innerText =
            "Data received";

    }


    const dashboardStatus =
        document.getElementById(
            "dashboard-soil-status"
        );


    if (dashboardStatus) {

        dashboardStatus.innerText =
            "Active";

    }


    // Progress

    const progress =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );


    const progressBar =
        document.getElementById(
            "soil-progress"
        );


    if (progressBar) {

        progressBar.style.width =
            progress + "%";

    }


    // Status

    const badge =
        document.getElementById(
            "soil-badge"
        );


    if (badge) {

        if (
            value >= 50 &&
            value <= 80
        ) {

            badge.innerText =
                "OPTIMAL";

            badge.style.background =
                "#62cf3c";

        }

        else {

            badge.innerText =
                "CHECK";

            badge.style.background =
                "#f3a400";

        }

    }


    const dot =
        document.getElementById(
            "soil-dot"
        );


    if (dot) {

        dot.style.background =
            "#4acb69";

    }

}


// =====================================================
// PREDICTION UPDATE
// =====================================================

function updatePrediction(
    value
) {

    const prediction =
        document.getElementById(
            "prediction"
        );


    if (prediction) {

        prediction.innerText =
            value;

    }


    const dashboard =
        document.getElementById(
            "dashboard-prediction"
        );


    if (dashboard) {

        dashboard.innerText =
            value;

    }


    const health =
        document.getElementById(
            "health-disease"
        );


    if (health) {

        health.innerText =
            value;

    }


    const analysis =
        document.getElementById(
            "analysis-prediction"
        );


    if (analysis) {

        analysis.innerText =
            value;

    }


    const aiStatus =
        document.getElementById(
            "dashboard-ai-status"
        );


    if (aiStatus) {

        aiStatus.innerText =
            "Active";

    }

}


// =====================================================
// CONFIDENCE UPDATE
// =====================================================

function updateConfidence(
    value
) {

    if (isNaN(value)) {
        return;
    }


    const text =
        "Confidence: " +
        value.toFixed(1) +
        "%";


    const confidence =
        document.getElementById(
            "confidence"
        );


    if (confidence) {

        confidence.innerText =
            text;

    }


    const dashboard =
        document.getElementById(
            "dashboard-confidence"
        );


    if (dashboard) {

        dashboard.innerText =
            value.toFixed(1) +
            "%";

    }


    const analysis =
        document.getElementById(
            "analysis-confidence"
        );


    if (analysis) {

        analysis.innerText =
            value.toFixed(1) +
            "%";

    }


    const average =
        document.getElementById(
            "average-confidence"
        );


    if (average) {

        average.innerText =
            value.toFixed(1) +
            "%";

    }


    const progress =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );


    const progressBar =
        document.getElementById(
            "confidence-progress"
        );


    if (progressBar) {

        progressBar.style.width =
            progress + "%";

    }

}


// =====================================================
// PLANT HEALTH STATUS
// =====================================================

function updateHealthStatus() {

    const status =
        document.getElementById(
            "plant-status"
        );


    const description =
        document.getElementById(
            "plant-status-description"
        );


    if (!status) {
        return;
    }


    const temperature =
        sensorData.temperature;


    const soil =
        sensorData.soil;


    if (
        temperature === null &&
        soil === null
    ) {

        status.innerText =
            "Waiting for sensor data";

        description.innerText =
            "Sistem sedang menunggu data dari sensor tanaman.";

        return;

    }


    let plantStatus =
        "Tanaman dalam kondisi baik";


    let plantDescription =
        "Kondisi sensor berada dalam rentang yang sesuai.";


    if (
        temperature !== null &&
        (
            temperature < 25 ||
            temperature > 32
        )
    ) {

        plantStatus =
            "Perlu perhatian";

        plantDescription =
            "Suhu tanaman berada di luar rentang ideal.";

    }


    if (
        soil !== null &&
        (
            soil < 50 ||
            soil > 80
        )
    ) {

        plantStatus =
            "Perlu perhatian";

        plantDescription =
            "Kelembapan tanah berada di luar rentang ideal.";

    }


    status.innerText =
        plantStatus;


    description.innerText =
        plantDescription;


    // Recommendation

    const recommendation =
        document.getElementById(
            "recommendation"
        );


    if (recommendation) {

        if (
            soil !== null &&
            soil < 50
        ) {

            recommendation.innerText =
                "Kelembapan tanah rendah. " +
                "Disarankan untuk melakukan penyiraman " +
                "agar kelembapan kembali ke rentang ideal 50% - 80%.";

        }

        else if (
            temperature !== null &&
            temperature > 32
        ) {

            recommendation.innerText =
                "Suhu tanaman cukup tinggi. " +
                "Periksa kondisi lingkungan dan pastikan " +
                "tanaman mendapatkan sirkulasi udara yang baik.";

        }

        else {

            recommendation.innerText =
                "Kondisi sensor tanaman berada pada " +
                "rentang yang sesuai. Lanjutkan monitoring " +
                "secara berkala.";

        }

    }

}


// =====================================================
// SAVE HISTORY
// =====================================================

function saveHistory() {

    // Hanya simpan jika minimal ada satu data

    if (
        sensorData.temperature === null &&
        sensorData.soil === null &&
        sensorData.prediction === null &&
        sensorData.confidence === null
    ) {

        return;

    }


    const record = {

        time:
            getCurrentTime(),

        temperature:
            sensorData.temperature,

        soil:
            sensorData.soil,

        prediction:
            sensorData.prediction,

        confidence:
            sensorData.confidence

    };


    historyData.unshift(
        record
    );


    // Batasi 100 data

    if (
        historyData.length > 100
    ) {

        historyData =
            historyData.slice(
                0,
                100
            );

    }


    localStorage.setItem(
        "tomatoHistory",
        JSON.stringify(
            historyData
        )
    );


    renderHistory();

}


// =====================================================
// RENDER HISTORY
// =====================================================

function renderHistory() {

    const table =
        document.getElementById(
            "history-table"
        );


    if (!table) {
        return;
    }


    if (
        historyData.length === 0
    ) {

        table.innerHTML = `
            <tr>
                <td colspan="5"
                    class="empty-table">
                    Belum ada data monitoring.
                </td>
            </tr>
        `;

        return;

    }


    table.innerHTML =
        historyData
        .slice(0, 30)
        .map(
            function (data) {

                return `

                    <tr>

                        <td>
                            ${data.time || "--"}
                        </td>

                        <td>
                            ${
                                data.temperature !== null
                                ? data.temperature + " °C"
                                : "--"
                            }
                        </td>

                        <td>
                            ${
                                data.soil !== null
                                ? data.soil + " %"
                                : "--"
                            }
                        </td>

                        <td>
                            ${
                                data.prediction || "--"
                            }
                        </td>

                        <td>
                            ${
                                data.confidence !== null
                                ? data.confidence + "%"
                                : "--"
                            }
                        </td>

                    </tr>

                `;

            }
        )
        .join("");

}


// =====================================================
// CLEAR HISTORY
// =====================================================

const clearHistoryButton =
    document.getElementById(
        "clear-history"
    );


if (clearHistoryButton) {

    clearHistoryButton.addEventListener(
        "click",
        function () {

            const confirmed =
                confirm(
                    "Hapus seluruh history monitoring?"
                );


            if (!confirmed) {
                return;
            }


            historyData = [];


            localStorage.removeItem(
                "tomatoHistory"
            );


            renderHistory();

        }
    );

}


// =====================================================
// NAVIGATION
// =====================================================

const navItems =
    document.querySelectorAll(
        ".nav-item"
    );


const pages =
    document.querySelectorAll(
        ".page-content"
    );


navItems.forEach(
    function (item) {

        item.addEventListener(
            "click",
            function (event) {

                event.preventDefault();


                const page =
                    item.dataset.page;


                // Remove active

                navItems.forEach(
                    function (nav) {

                        nav.classList.remove(
                            "active"
                        );

                    }
                );


                // Active menu

                item.classList.add(
                    "active"
                );


                // Hide all pages

                pages.forEach(
                    function (pageElement) {

                        pageElement.classList.remove(
                            "active-page"
                        );

                    }
                );


                // Show selected page

                const selectedPage =
                    document.getElementById(
                        "page-" + page
                    );


                if (selectedPage) {

                    selectedPage.classList.add(
                        "active-page"
                    );

                }


                // Scroll top

                window.scrollTo(
                    {
                        top: 0,
                        behavior: "smooth"
                    }
                );

            }
        );

    }
);


// =====================================================
// CONTROL PANEL
// =====================================================

const irrigationSwitch =
    document.getElementById(
        "irrigation-switch"
    );


const alertSwitch =
    document.getElementById(
        "alert-switch"
    );


const aiSwitch =
    document.getElementById(
        "ai-switch"
    );


if (irrigationSwitch) {

    irrigationSwitch.addEventListener(
        "change",
        function () {

            console.log(
                "Irrigation:",
                irrigationSwitch.checked
            );


            if (
                irrigationSwitch.checked
            ) {

                showNotification(
                    "Automatic Irrigation diaktifkan."
                );

            }

            else {

                showNotification(
                    "Automatic Irrigation dimatikan."
                );

            }

        }
    );

}


if (alertSwitch) {

    alertSwitch.addEventListener(
        "change",
        function () {

            showNotification(
                alertSwitch.checked
                ? "Alert Notification diaktifkan."
                : "Alert Notification dimatikan."
            );

        }
    );

}


if (aiSwitch) {

    aiSwitch.addEventListener(
        "change",
        function () {

            showNotification(
                aiSwitch.checked
                ? "AI Disease Detection diaktifkan."
                : "AI Disease Detection dimatikan."
            );

        }
    );

}


// =====================================================
// SAVE CONTROL
// =====================================================

const saveControl =
    document.getElementById(
        "save-control"
    );


if (saveControl) {

    saveControl.addEventListener(
        "click",
        function () {

            const minMoisture =
                document.getElementById(
                    "min-moisture"
                ).value;


            const maxTemperature =
                document.getElementById(
                    "max-temperature"
                ).value;


            localStorage.setItem(
                "minMoisture",
                minMoisture
            );


            localStorage.setItem(
                "maxTemperature",
                maxTemperature
            );


            showNotification(
                "Pengaturan berhasil disimpan."
            );

        }
    );

}


// =====================================================
// LOAD CONTROL SETTINGS
// =====================================================

function loadControlSettings() {

    const minMoisture =
        localStorage.getItem(
            "minMoisture"
        );


    const maxTemperature =
        localStorage.getItem(
            "maxTemperature"
        );


    if (minMoisture) {

        document.getElementById(
            "min-moisture"
        ).value =
            minMoisture;

    }


    if (maxTemperature) {

        document.getElementById(
            "max-temperature"
        ).value =
            maxTemperature;

    }

}


loadControlSettings();


// =====================================================
// SETTINGS
// =====================================================

const settingsSwitches =
    document.querySelectorAll(
        "#page-settings input[type='checkbox']"
    );


settingsSwitches.forEach(
    function (setting) {

        setting.addEventListener(
            "change",
            function () {

                showNotification(
                    "Setting diperbarui."
                );

            }
        );

    }
);


// =====================================================
// LOGOUT
// =====================================================

const logoutButton =
    document.getElementById(
        "logout-button"
    );


const logoutModal =
    document.getElementById(
        "logout-modal"
    );


const cancelLogout =
    document.getElementById(
        "cancel-logout"
    );


const confirmLogout =
    document.getElementById(
        "confirm-logout"
    );


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        function () {

            logoutModal.classList.add(
                "show"
            );

        }
    );

}


if (cancelLogout) {

    cancelLogout.addEventListener(
        "click",
        function () {

            logoutModal.classList.remove(
                "show"
            );

        }
    );

}


if (confirmLogout) {

    confirmLogout.addEventListener(
        "click",
        function () {

            logoutModal.classList.remove(
                "show"
            );


            showNotification(
                "Logout berhasil."
            );


            // Kembali ke Dashboard

            navItems.forEach(
                function (nav) {

                    nav.classList.remove(
                        "active"
                    );

                }
            );


            const dashboardMenu =
                document.querySelector(
                    '[data-page="dashboard"]'
                );


            if (dashboardMenu) {

                dashboardMenu.classList.add(
                    "active"
                );

            }


            pages.forEach(
                function (page) {

                    page.classList.remove(
                        "active-page"
                    );

                }
            );


            const dashboard =
                document.getElementById(
                    "page-dashboard"
                );


            if (dashboard) {

                dashboard.classList.add(
                    "active-page"
                );

            }

        }
    );

}


// =====================================================
// CLICK OUTSIDE MODAL
// =====================================================

if (logoutModal) {

    logoutModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                logoutModal
            ) {

                logoutModal.classList.remove(
                    "show"
                );

            }

        }
    );

}


// =====================================================
// NOTIFICATION
// =====================================================

function showNotification(
    message
) {

    const oldNotification =
        document.querySelector(
            ".app-notification"
        );


    if (oldNotification) {

        oldNotification.remove();

    }


    const notification =
        document.createElement(
            "div"
        );


    notification.className =
        "app-notification";


    notification.innerText =
        message;


    document.body.appendChild(
        notification
    );


    notification.style.cssText = `

        position: fixed;

        right: 25px;

        bottom: 25px;

        background: #333a46;

        color: white;

        padding: 12px 18px;

        border-radius: 7px;

        font-size: 11px;

        z-index: 2000;

        box-shadow:
            0 8px 25px rgba(0,0,0,.15);

    `;


    setTimeout(
        function () {

            notification.remove();

        },
        2500
    );

}


// =====================================================
// MQTT ERROR
// =====================================================

client.on(
    "error",
    function (error) {

        console.error(
            "MQTT Error:",
            error
        );


        updateMQTTStatus(
            false
        );

    }
);


// =====================================================
// MQTT OFFLINE
// =====================================================

client.on(
    "offline",
    function () {

        console.log(
            "MQTT Offline"
        );


        updateMQTTStatus(
            false
        );

    }
);


// =====================================================
// INITIALIZE
// =====================================================

renderHistory();

updateHealthStatus();
