const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let storesQueue = [];
let minTime = 5;
let maxTime = 8;
let botStatus = "Disconnected";
let qrCodeValue = "";

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', (qr) => {
    qrCodeValue = qr;
    botStatus = "Scan QR Code";
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    botStatus = "Connected & Running";
    console.log('WhatsApp Connected!');
    startScheduler();
});

client.initialize();

app.get('/', (req, res) => {
    res.send(`
        <html>
        <head><title>WhatsApp Bot Dashboard</title></head>
        <body style="font-family: Arial; padding: 20px; background: #121212; color: #fff;">
            <h2>🚀 WhatsApp Outreach Dashboard</h2>
            <p><b>Status:</b> <span style="color: #00ff00;">${botStatus}</span></p>
            
            <hr style="border-color: #444;">
            <h3>⚙️ Settings</h3>
            <form action="/save" method="POST">
                <label>Min Delay (Minutes):</label><br>
                <input type="number" name="minTime" value="${minTime}" style="padding: 8px; width: 200px;"><br><br>
                <label>Max Delay (Minutes):</label><br>
                <input type="number" name="maxTime" value="${maxTime}" style="padding: 8px; width: 200px;"><br><br>
                <button type="submit" style="background: #28a745; color: white; padding: 10px 20px; border: none; cursor: pointer;">Save Settings</button>
            </form>

            <hr style="border-color: #444;">
            <h3>➕ Add Stores (Name, Number)</h3>
            <form action="/add" method="POST">
                <textarea name="stores" rows="5" style="width: 100%; padding: 10px;" placeholder="Store Name, 919876543210"></textarea><br><br>
                <button type="submit" style="background: #007bff; color: white; padding: 10px 20px; border: none; cursor: pointer;">Add Stores</button>
            </form>

            <hr style="border-color: #444;">
            <h3>📋 Stores Queue (${storesQueue.length})</h3>
            <ul>
                ${storesQueue.map(s => `<li>${s.name} (${s.phone}) - <b>${s.status}</b></li>`).join('')}
            </ul>
        </body>
        </html>
    `);
});

app.post('/save', (req, res) => {
    minTime = parseInt(req.body.minTime) || 5;
    maxTime = parseInt(req.body.maxTime) || 8;
    res.redirect('/');
});

app.post('/add', (req, res) => {
    const lines = req.body.stores.split('\n');
    lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
            storesQueue.push({
                name: parts[0].trim(),
                phone: parts[1].trim(),
                status: 'Pending'
            });
        }
    });
    res.redirect('/');
});

function startScheduler() {
    setInterval(async () => {
        if (botStatus !== "Connected & Running") return;
        const pendingStore = storesQueue.find(s => s.status === 'Pending');
        if (!pendingStore) return;

        try {
            const chatId = `${pendingStore.phone}@c.us`;
            const message = `Hi ${pendingStore.name}! 👋\n\nHu ek student web developer chu, tamara area na clothing collection mate ek special 3D Mobile website banavi che. Joiye to "YES" lakhi reply karo! ✨`;
            
            await client.sendMessage(chatId, message);
            pendingStore.status = 'Sent';
            console.log(`Message sent to ${pendingStore.name} (${pendingStore.phone})`);
        } catch (err) {
            console.error(`Failed to send to ${pendingStore.name}:`, err);
        }
    }, (Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime) * 60 * 1000);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dashboard running on port ${PORT}`);
});