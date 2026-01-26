const southWest = L.latLng(-40, -30);
const northEast = L.latLng(40, 60);
const bounds = L.latLngBounds(southWest, northEast);

const map = L.map('map', {
    center: [1.0, 15.0],
    zoom: 3.5,
    minZoom: 3,
    maxZoom: 10,
    maxBounds: bounds,
    maxBoundsViscosity: 1.0,
    zoomControl: false
});


const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const controlContainer = document.querySelector('.control');
const layerListContainer = document.querySelector('.layer-list');
const hideBtn = document.getElementById('close-info-btn');
const descriptionInfo = document.querySelector('.main-content');

hideBtn.addEventListener('click', () => {
    // Toggle the active class
    descriptionInfo.classList.toggle('active');

    // Rotate the chevron based on the active state
    if (descriptionInfo.classList.contains('active')) {
        hideBtn.style.transform = 'rotate(180deg)';
    } else {
        hideBtn.style.transform = 'rotate(0deg)';
    }
});

// 2. Add the click functionality
zoomInBtn.addEventListener('click', () => {
    map.zoomIn();
});

zoomOutBtn.addEventListener('click', () => {
    map.zoomOut();
});

// 3. Prevent map clicks when clicking the buttons
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


// Africa Region GeoJSON Layer (will be loaded later)
let africaRegionLayer = null;

// 4. Create Base Map Switcher object
const baseMaps = {
    "CartoDB (Dark)": dark,
    "Esri World Imagery": satellite
};


// Generate layer list with radio buttons
layerListContainer.innerHTML = Object.keys(baseMaps).map((layerName, index) => `
    <li class="layer-item ${index === 0 ? 'active-layer' : ''}" data-layer="${layerName}">
        <label style="display: flex; align-items: center; justify-content: space-between; gap:40px; width: 100%; cursor: pointer;">
            <span>${layerName}</span>
            <input type="radio" name="basemap" value="${layerName}" ${index === 0 ? 'checked' : ''} class="layer-radio">
        </label>
    </li>
`).join('');

// Add change event listeners to radio buttons
const radioButtons = document.querySelectorAll('.layer-radio');
radioButtons.forEach(radio => {
    radio.addEventListener('change', function () {
        if (this.checked) {
            const layerName = this.value;
            const layer = baseMaps[layerName];

            // Remove all layers first
            Object.values(baseMaps).forEach(l => map.removeLayer(l));

            // Add selected layer
            layer.addTo(map);

            // Update active state on list items
            const layerItems = document.querySelectorAll('.layer-item');
            layerItems.forEach(li => {
                li.classList.remove('active-layer');
                if (li.getAttribute('data-layer') === layerName) {
                    li.classList.add('active-layer');
                }
            });
        }
    });
});



let selectedRegion = null;
let allRegionsData = []; // Store all regions data for default view

function onEachFeature(feature, layer) {
    if (feature.properties && feature.properties.Region_1) {
        let center;

        // Check if it's a MultiPolygon
        if (feature.geometry.type === 'MultiPolygon') {
            let maxArea = 0;
            let largestPolygon = null;

            feature.geometry.coordinates.forEach((coords) => {
                const latLngs = coords[0].map(coord => [coord[1], coord[0]]);
                const tempPoly = L.polygon(latLngs);

                const bounds = tempPoly.getBounds();
                const area = (bounds.getNorth() - bounds.getSouth()) * (bounds.getEast() - bounds.getWest());

                if (area > maxArea) {
                    maxArea = area;
                    largestPolygon = tempPoly;
                }
            });

            center = largestPolygon.getBounds().getCenter();
        } else {
            center = layer.getBounds().getCenter();
        }

        // Hover tooltip
        layer.bindTooltip(
            `<div style="font-family: sans-serif; padding: 5px;">
                <strong style="font-size: 14px; color: #800026;">${feature.properties.Region_1}</strong><br/>
                <hr style="margin: 5px 0; border: 0; border-top: 1px solid #ccc;">
                <b>2020:</b> ${feature.properties['2020']} mil. tones<br/>
                <b>2021:</b> ${feature.properties['2021']} mil. tones<br/>
                <b>2022:</b> ${feature.properties['2022']} mil. tones<br/>
            </div>`, {
            sticky: true,
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
            resetSelectedRegion();
            return;
        }
        selectedRegion = feature;

        document.getElementById('chart-container').classList.remove('active-layer');

        document.getElementById('region-title').innerText = `${feature.properties.Region_1} CO₂ Statistics`;

        // Update chart for individual region
        const stats = [
            feature.properties['2020'],
            feature.properties['2021'],
            feature.properties['2022']
        ] || [0, 0, 0];

        // Switch to single dataset (bar chart)
        emissionChart.data.datasets = [{
            label: `Emissions for ${feature.properties.Region_1}`,
            data: stats,
            backgroundColor: ['#FD8D3C', '#E31A1C', '#800026'],
        }];

        emissionChart.options.plugins.legend.display = false;
        emissionChart.update();

        document.getElementById('chart-container').classList.add('active-layer');

        generateProportionSymbol(feature);

        L.DomEvent.stopPropagation(e);
    });

    layer.on('mouseover', function () {
        this.setStyle({
            weight: 4,
            color: '#FFFFFF',
            fillOpacity: 0.9,
            dashArray: ''
        });
    });

    layer.on('mouseout', function () {
        this.setStyle({
            weight: 1,
            color: 'black',
            fillOpacity: 0.8
        });
    });
}

function resetSelectedRegion() {
    selectedRegion = null;
    document.getElementById('selected-layer-container').classList.remove('active-layer');

    // Reset to stacked chart showing all regions
    document.getElementById('region-title').innerText = 'Total CO₂ Emissions by Region (2020-2022)';

    // Recreate stacked datasets
    const datasets = allRegionsData.map((region, index) => {
        const colors = ['#B3E2CD', '#FDCDAC', '#D7B09E', '#F4F1EA', '#E6F5C9'];
        return {
            label: region.name,
            data: region.data,
            backgroundColor: colors[index % colors.length],
        };
    });

    emissionChart.data.datasets = datasets;
    emissionChart.options.plugins.legend.display = true;
    emissionChart.update();
}

const ColorRamp = {
    "1": "#B3E2CD",
    "2": "#FDCDAC",
    "3": "#D7B09E",
    "4": "#F4F1EA",
    "5": "#E6F5C9"
}

function generateProportionSymbol(feature) {
    const container = document.getElementById('selected-layer-container');
    const title = document.getElementById('selected-title');
    const description = document.getElementById('selected-description');
    const propInfo = document.querySelector('.proportional-info');
    const selectedColor = document.getElementById('selected-color');

    const fillColor = ColorRamp[feature.properties.fid] || '#C0C0C0';
    selectedColor.style.backgroundColor = fillColor;

    const props = feature.properties;
    const content = feature.properties.Desc || "No description available.";
    const years = ['2020', '2021', '2022'];

    title.innerText = props.Region_1;

    description.innerHTML = `<p style="margin: 15px 0px; font-size: 13px;">${content}</p>`;

    const scaleFactor = 3.5;

    let html = '<div class="proportional-container">';

    years.forEach(year => {
        const val = parseFloat(props[`F${year}_per`]) || 0;
        const size = Math.max(val * scaleFactor, 130);

        html += `
            <div class="prop-circle circle-${year}" style="width: ${size}px; height: ${size}px;">
                <div>
                    <img src="./public/co2_icon.svg" alt="CO2 Icon" style="width: 30px; height: 30px;">
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

    container.classList.add('active-layer');
}

fetch('data/co2_stat_2020_to_2022_with_desc.geojson')
    .then(res => res.json())
    .then(data => {
        geoJsonLayer = data;

        // Store all regions data for default stacked chart
        data.features.forEach(feature => {
            if (feature.properties && feature.properties.Region_1) {
                allRegionsData.push({
                    name: feature.properties.Region_1,
                    data: [
                        feature.properties['2020'] || 0,
                        feature.properties['2021'] || 0,
                        feature.properties['2022'] || 0
                    ]
                });
            }
        });

        // Initialize chart with stacked data
        initializeStackedChart();

        L.geoJSON(data, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);
    });

function initializeStackedChart() {
    const colors = ['#B3E2CD', '#FDCDAC', '#D7B09E', '#F4F1EA', '#E6F5C9'];

    const datasets = allRegionsData.map((region, index) => ({
        label: region.name,
        data: region.data,
        backgroundColor: colors[index % colors.length],
    }));

    emissionChart.data.datasets = datasets;
    emissionChart.options.plugins.legend.display = true;
    emissionChart.update();

    document.getElementById('region-title').innerText = 'Total CO₂ Emissions by Region';
}

function getColor(d) {
    return d === 5 ? '#E6F5C9' :
        d === 4 ? '#F4F1EA' :
            d === 3 ? '#D7B09E' :
                d === 2 ? '#FDCDAC' :
                    d === 1 ? '#B3E2CD' :
                        '#C0C0C0';
}

function style(feature) {
    return {
        fillColor: getColor(feature.properties.fid),
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
        labels: ['2020', '2021', '2022'],
        datasets: []
    },
    options: {
        responsive: true,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    boxWidth: 15,
                    padding: 15,
                    font: {
                        size: 11,
                    },
                    color: '#ffffff'

                }
            }
        },
        maintainAspectRatio: false,
        scales: {
            y: {
                stacked: true, // Enable stacking
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Million Tonnes (mt) of CO₂ Emissions',
                    color: '#ffffff',
                    font: {
                        size: 13,
                        weight: 'bold'
                    },
                    padding: { bottom: 10 }
                },
                grid: {
                    color: '#D6DBED66',
                    borderColor: '#D6DBED66',
                    tickColor: '#D6DBED66',
                    lineWidth: 0.2,
                    tickWidth: 0.2
                },
            },
            x: {
                stacked: true, // Enable stacking
                title: {
                    display: true,
                    text: 'Reporting Year',
                    color: '#ffffff',
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