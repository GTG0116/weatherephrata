// ==========================================================
// 1. YOUR CUSTOM FORECAST DATA
// Easily edit this section to control your own forecasts!
// Update the 'icon' paths to point to your local custom images.
// ==========================================================
const MY_CUSTOM_FORECAST = {
    hourly: [
        { time: "Now", temp: 68, icon: "icons/sun.png" },
        { time: "1 PM", temp: 70, icon: "icons/sun-cloud.png" },
        { time: "2 PM", temp: 72, icon: "icons/cloud.png" },
        { time: "3 PM", temp: 71, icon: "icons/rain.png" },
        { time: "4 PM", temp: 68, icon: "icons/rain.png" },
        { time: "5 PM", temp: 65, icon: "icons/cloud.png" }
    ],
    daily: [
        { day: "Today", low: 55, high: 72, icon: "icons/sun.png" },
        { day: "Mon",   low: 52, high: 68, icon: "icons/sun-cloud.png" },
        { day: "Tue",   low: 50, high: 65, icon: "icons/cloud.png" },
        { day: "Wed",   low: 48, high: 60, icon: "icons/rain.png" },
        { day: "Thu",   low: 45, high: 58, icon: "icons/rain.png" },
        { day: "Fri",   low: 42, high: 62, icon: "icons/sun.png" },
        { day: "Sat",   low: 44, high: 66, icon: "icons/sun.png" },
        { day: "Sun",   low: 48, high: 70, icon: "icons/sun-cloud.png" },
        { day: "Mon",   low: 51, high: 73, icon: "icons/sun.png" },
        { day: "Tue",   low: 54, high: 75, icon: "icons/sun.png" }
    ]
};

// Config: Default to Akron, PA
const LAT = 40.0865;
const LON = -76.2012;
const GOOGLE_POLLEN_API_KEY = 'YOUR_GOOGLE_API_KEY_HERE';

// ==========================================================
// 2. RENDER CUSTOM FORECASTS
// ==========================================================
function renderCustomForecasts() {
    const hourlyContainer = document.getElementById('hourly-forecast');
    hourlyContainer.innerHTML = MY_CUSTOM_FORECAST.hourly.map(hour => `
        <div class="hourly-item">
            <span>${hour.time}</span>
            <img src="${hour.icon}" alt="weather icon" class="custom-icon" onerror="this.src='https://cdn-icons-png.flaticon.com/512/869/869869.png'">
            <span style="font-weight: 600;">${hour.temp}°</span>
        </div>
    `).join('');

    const dailyContainer = document.getElementById('daily-forecast');
    dailyContainer.innerHTML = MY_CUSTOM_FORECAST.daily.map(day => `
        <div class="daily-item">
            <span class="daily-day">${day.day}</span>
            <img src="${day.icon}" alt="weather icon" class="custom-icon" onerror="this.src='https://cdn-icons-png.flaticon.com/512/869/869869.png'">
            <div class="daily-temps">
                <span class="temp-low">${day.low}°</span>
                <span style="font-weight: 600;">${day.high}°</span>
            </div>
        </div>
    `).join('');
}

// ==========================================================
// 3. FETCH LIVE DATA (Open-Meteo & Google Pollen)
// ==========================================================
async function fetchCurrentConditions() {
    // Open-Meteo Weather
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`);
    const weatherData = await weatherRes.json();
    
    document.getElementById('current-temp').innerText = `${Math.round(weatherData.current.temperature_2m)}°`;
    document.getElementById('current-high').innerText = Math.round(weatherData.daily.temperature_2m_max[0]);
    document.getElementById('current-low').innerText = Math.round(weatherData.daily.temperature_2m_min[0]);
    document.getElementById('current-condition').innerText = "Active"; // You can map weatherData.current.weather_code to text if desired

    // Open-Meteo Air Quality
    const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=us_aqi`);
    const aqiData = await aqiRes.json();
    document.getElementById('aqi-value').innerText = aqiData.current.us_aqi;

    // Google Pollen API (Requires Key)
    try {
        if(GOOGLE_POLLEN_API_KEY !== 'YOUR_GOOGLE_API_KEY_HERE') {
            const pollenRes = await fetch(`https://pollen.googleapis.com/v1/forecast:lookup?key=${GOOGLE_POLLEN_API_KEY}&location.latitude=${LAT}&location.longitude=${LON}&days=1`);
            const pollenData = await pollenRes.json();
            // Simplify finding the highest index
            const maxIndex = pollenData.dailyInfo[0].pollenTypeInfo.reduce((max, p) => p.indexInfo.value > max ? p.indexInfo.value : max, 0);
            document.getElementById('pollen-value').innerText = maxIndex > 0 ? maxIndex : "Low";
        } else {
            document.getElementById('pollen-value').innerText = "No Key";
        }
    } catch (e) {
        document.getElementById('pollen-value').innerText = "N/A";
    }
}

// ==========================================================
// 4. RAINVIEWER RADAR (Playback & Stretching)
// ==========================================================
function initRadar() {
    const map = L.map('radar-map', { zoomControl: false }).setView([LAT, LON], 6);
    
    // Dark base map
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(res => res.json())
        .then(data => {
            // Get up to the last 10 scans
            const pastFrames = data.radar.past.slice(-10);
            const radarLayers = [];
            
            // Create a tile layer for each frame
            pastFrames.forEach(frame => {
                const layer = L.tileLayer(`https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
                    maxNativeZoom: 7, // Stretches automatically past zoom level 7
                    maxZoom: 18,
                    opacity: 0,
                    zIndex: 10
                }).addTo(map);
                radarLayers.push({ layer, time: frame.time });
            });

            // Playback animation loop
            let currentFrameIndex = 0;
            setInterval(() => {
                radarLayers.forEach(l => l.layer.setOpacity(0)); // Hide all
                radarLayers[currentFrameIndex].layer.setOpacity(0.7); // Show current
                
                // Update time display
                const date = new Date(radarLayers[currentFrameIndex].time * 1000);
                document.getElementById('radar-time').innerText = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                currentFrameIndex = (currentFrameIndex + 1) % radarLayers.length;
            }, 800); // 800ms per frame
        });
}

// Initialize everything
renderCustomForecasts();
fetchCurrentConditions();
initRadar();
