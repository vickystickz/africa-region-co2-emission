const southWest = L.latLng(-40, -30);
const northEast = L.latLng(40, 60);
const bounds = L.latLngBounds(southWest, northEast);

const map = L.map('map', {
    center: [1.0, 15.0],
    zoom: 3.5,
    minZoom: 3,
    maxZoom: 10,
    maxBounds: bounds,
    maxBoundsViscosity: 1.0, // 1.0 makes the bounds "hard" (user can't pull past them)
    zoomControl: false // We will move it to the top-right
});


// 1. Select your buttons
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const controlContainer = document.querySelector('.control');

// 2. Add the click functionality
zoomInBtn.addEventListener('click', () => {
    map.zoomIn();
});

zoomOutBtn.addEventListener('click', () => {
    map.zoomOut();
});

// 3. IMPORTANT: Prevent map clicks when clicking the buttons
// This stops the map from "dragging" or "double clicking" when you click your buttons
L.DomEvent.disableClickPropagation(controlContainer);

// 2. Define Base Layers
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
});

const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
});

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

// 3. Add default layer to map
dark.addTo(map);

// 4. Create Base Map Switcher object
const baseMaps = {
    "Dark Mode": dark,
    "Standard Map": osm,
    "Satellite View": satellite
};

// 5. Add Layer Control and Zoom Control
// L.control.layers(baseMaps, null, { position: 'bottomleft' }).addTo(map);
// L.control.zoom({ position: 'topleft' }).addTo(map);

let selectedRegion = null;


function onEachFeature(feature, layer) {

    if (feature.properties && feature.properties.Region_1) {
        let center;

        // Check if it's a MultiPolygon
        if (feature.geometry.type === 'MultiPolygon') {
            let maxArea = 0;
            let largestPolygon = null;

            // Iterate through each part of the MultiPolygon
            feature.geometry.coordinates.forEach((coords) => {
                // GeoJSON coordinates for MultiPolygon are usually [[[lng, lat], ...]]
                // We convert them to LatLngs for Leaflet
                const latLngs = coords[0].map(coord => [coord[1], coord[0]]);
                const tempPoly = L.polygon(latLngs);

                // Calculate approximate area of this specific part
                const bounds = tempPoly.getBounds();
                const area = (bounds.getNorth() - bounds.getSouth()) * (bounds.getEast() - bounds.getWest());

                if (area > maxArea) {
                    maxArea = area;
                    largestPolygon = tempPoly;
                }
            });

            // Use the center of the largest polygon found
            center = largestPolygon.getBounds().getCenter();
        } else {
            // It's a simple Polygon, use standard center
            center = layer.getBounds().getCenter();
        }

        // --- 2. HOVER TOOLTIP (Attribute Information) ---
        // This shows up ONLY when hovering over the polygon
        layer.bindTooltip(`
        <div style="font-family: sans-serif; padding: 5px;">
            <strong style="font-size: 14px; color: #800026;">${feature.properties.Region_1}</strong><br/>
            <hr style="margin: 5px 0; border: 0; border-top: 1px solid #ccc;">
            <b>2020:</b> ${feature.properties['2020']} mil. tones<br/>
            <b>2021:</b> ${feature.properties['2021']} mil. tones<br/>
            <b>2022:</b> ${feature.properties['2022']} mil. tones<br/>
        </div>
    `, {
            sticky: true, // Tooltip follows the mouse
            direction: 'auto',
            className: 'hover-tooltip'
        });

        // Create the invisible marker and label at the precise center
        const labelMarker = L.marker(center, { opacity: 0 });
        labelMarker.bindTooltip(feature.properties.Region_1, {
            permanent: true,
            direction: 'center',
            className: 'map-label',
            offset: [0, 0]
        }).addTo(map);


    }

    // Click event to update chart
    layer.on('click', function (e) {
        if (feature === selectedRegion) {
            // If the same region is clicked again, do nothing
            resetSelectedRegion();
            return;
        }
        selectedRegion = feature;

        // A. HIDE PREVIOUS INFO (if any)
        document.getElementById('chart-container').classList.remove('active');

        document.getElementById('region-title').innerText = `${feature.properties.Region_1} Co2 Statistics from 2020 - 2022.`;
        // Mock historical data from GeoJSON properties
        const stats = [feature.properties['2020'], feature.properties['2021'], feature.properties['2022']] || [0, 0, 0];

        emissionChart.data.datasets[0].data = stats;
        emissionChart.data.datasets[0].label = `Emissions for ${feature.properties.Region_1}`;
        emissionChart.update();

        // C. TRIGGER THE ANIMATION (Slide the modal in)
        document.getElementById('chart-container').classList.add('active');

        generateProportionSymbol(feature);
        console.log(feature);

        // Ensure map doesn't zoom or change weirdly on click
        L.DomEvent.stopPropagation(e);


    });

    layer.on('mouseover', function () {
        this.setStyle({
            weight: 4,             // Thicker border
            color: '#FFFFFF',      // White glow (or use '#FFD700' for Gold)
            fillOpacity: 0.9,      // Make the color deeper
            dashArray: ''          // Solid line
        });
    });

    layer.on('mouseout', function () {
        this.setStyle({
            weight: 1,
            color: 'black',
            fillOpacity: 0.8
        });
    });

    // once I click on one polygon the other part of the map is dimmed
}

function resetSelectedRegion() {
    selectedRegion = null;
    document.getElementById('selected-layer-container').classList.remove('active');
    const stats = [0, 0, 0];
    emissionChart.data.datasets[0].data = stats;
    emissionChart.data.datasets[0].label = '';
    emissionChart.update();
}

const ColorRamp = {
    "1": "#B3E2CD", // Very Low
    "2": "#FDCDAC", // Low
    "3": "#D7B09E", // Medium
    "4": "#F4F1EA", // High
    "5": "#E6F5C9"  // Very High
}

function generateProportionSymbol(feature) {
    const container = document.getElementById('selected-layer-container');
    const title = document.getElementById('selected-title');
    const description = document.getElementById('selected-description');
    const propInfo = document.querySelector('.proportional-info');
    const selectedColor = document.getElementById('selected-color');

    // Set the color based on the feature's fid property
    const fillColor = ColorRamp[feature.properties.fid] || '#C0C0C0'; // Default to gray if fid not found
    selectedColor.style.backgroundColor = fillColor;

    const props = feature.properties;
    const content = feature.properties.description;
    const years = ['2020', '2021', '2022'];

    // 1. Update Title
    title.innerText = props.Region_1;

    // 2. Update Text Description
    // description.innerHTML = `
    //     <p style="margin-bottom: 15px; font-size: 13px;">${content}</p>
    // `;

    // --- SIZING LOGIC ---
    // Adjust scale factor so they grow but stay within bounds
    const scaleFactor = 3.5;

    let html = '<div class="proportional-container">';

    years.forEach(year => {
        const val = parseFloat(props[`F${year}_per`]) || 0;
        // Diameter calculation
        const size = Math.max(val * scaleFactor, 130);

        html += `
            <div class="prop-circle circle-${year}" style="width: ${size}px; height: ${size}px;">
                <div>
                    <Img src="./public/co2_icon.svg" alt="CO2 Icon" style="width: 30px; height: 30px;">
                </div>
                
                <div class="main-value">
                    ${val}%
                </div>

                <p class="year-badge">  
                    ${year}
                </p>
            </div>
        `;
    });

    html += '</div>';
    propInfo.innerHTML = html;

    container.classList.add('active');

}

fetch('data/africa_region_co2_2020_to_2022.geojson')
    .then(res => res.json())
    .then(data => {
        geoJsonLayer = data
        L.geoJSON(data, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);
    });


function getColor(d) {
    return d === 5 ? '#E6F5C9' : // Very High (Dark Red)
        d === 4 ? '#F4F1EA' : // High (Red)
            d === 3 ? '#D7B09E' : // Medium (Orange)
                d === 2 ? '#FDCDAC' : // Low (Light Orange)
                    d === 1 ? ' #B3E2CD' : // Very Low (Yellow)
                        '#C0C0C0'; // Default (Gray for no data)
}


function style(feature) {
    console.log(feature);
    return {
        fillColor: getColor(feature.properties.fid), // Ensure GeoJSON has this property
        weight: 1,
        opacity: 1,
        color: 'black',
        fillOpacity: 0.8
    };
}





const ctx = document.getElementById('emissionChart').getContext('2d');
let emissionChart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['2020', '2021', '2022'], // Placeholder years
        datasets: [{
            label: '',
            data: [0, 0, 0],
            backgroundColor: ['#FD8D3C', '#E31A1C', '#800026'],
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: {
                display: false,
            }
        },
        maintainAspectRatio: false, // This allows the chart to stretch vertically
        scales: {
            y: {
                beginAtZero: true,
                // --- Y-AXIS LABEL CONFIGURATION ---
                title: {
                    display: true,
                    text: '( Million Tonnes )', // Your label text
                    color: '#B9BEC9',                       // Optional: Label color
                    font: {
                        size: 13,                        // Optional: Font size
                        weight: 'bold'                   // Optional: Font weight
                    },
                    padding: { bottom: 10 }              // Optional: Space from axis
                },
                grid: {
                    color: '#D6DBED66',
                    borderColor: '#D6DBED66',
                    tickColor: '#D6DBED66',
                    lineWidth: 0.2,
                    tickWidth: 0.2
                }
            },
            x: {
                // --- X-AXIS LABEL CONFIGURATION (Optional) ---
                title: {
                    display: true,
                    text: 'Reporting Year',
                    color: '#B9BEC9',
                },
                grid: {
                    color: '#D6DBED66',
                    borderColor: '#D6DBED66',
                    tickColor: '#D6DBED66',
                    lineWidth: 0.2,
                    tickWidth: 0.2
                }
            }
        }
    }
});
