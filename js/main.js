const map = L.map('map', {
    center: [1.0, 15.0],
    zoom: 3.5,
    zoomControl: false // We will move it to the top-right
});

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
L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);
L.control.zoom({ position: 'topright' }).addTo(map);

let geoJsonLayer;


// 1. Logic for the Close Button
document.getElementById('close-btn').addEventListener('click', function () {
    document.getElementById('chart-container').classList.remove('active');
});

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
            <b>2020:</b> ${feature.properties['2020']}%<br/>
            <b>2021:</b> ${feature.properties['2021']}%<br/>
            <b>2022:</b> ${feature.properties['2022']}%
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
        document.getElementById('info-text').innerText = `Displaying data for ${feature.properties.Region_1} region from 2020 to 2022.`;
        // Mock historical data from GeoJSON properties
        const stats = [feature.properties['2020'], feature.properties['2021'], feature.properties['2022']] || [0, 0, 0];

        emissionChart.data.datasets[0].data = stats;
        emissionChart.data.datasets[0].label = `Emissions for ${feature.properties.Region_1}`;
        emissionChart.update();

        // C. TRIGGER THE ANIMATION (Slide the modal in)
        document.getElementById('chart-container').classList.add('active');

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
    return d === 5 ? '#800026' : // Very High (Dark Red)
        d === 4 ? '#E31A1C' : // High (Red)
            d === 3 ? '#FD8D3C' : // Medium (Orange)
                d === 2 ? '#FEB24C' : // Low (Light Orange)
                    d === 1 ? '#FFEDA0' : // Very Low (Yellow)
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
            label: 'CO2 Emissions (Metric Tons)',
            data: [0, 0, 0],
            backgroundColor: '#e63946'
        }]
    }
});
