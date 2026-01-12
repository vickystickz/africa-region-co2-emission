const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// 1. Tell Express to serve all files inside the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// 2. Explicitly tell Express to serve index.html when someone visits "/"
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 3. Serve the node_modules folder so Leaflet and Chart.js work
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

app.listen(PORT, () => {
    console.log(`Server is running! View it at: http://localhost:${PORT}`);
});