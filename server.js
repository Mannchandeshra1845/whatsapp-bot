const express = require('express');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let sock;
let botStatus = "Disconnected";
let storesQueue = [];
let minTime = 5;
let maxTime = 8;

// 👉 TARO WHATSAPP NUMBER AHIYA NAKHI DE (Country code sathe, jem ke 919876543210)
const PHONENUMBER = "91YOUR_PHONE_NUMBER_HERE"; 

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' })
    });

    // Jo phone link na hoy to pairing code generate thase
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(PHONENUMBER);
                console.log(`\n========================================`);
                console.log(`🔥 TARO PAIRING CODE: ${code}`);
                console.log(`========================================\n`);
            } catch (err) {
                console.error("Error getting pairing code:", err);
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            botStatus = "Connected & Running";
            console.log('WhatsApp Connected Successfully via Number!');
            startScheduler();
        } else if (connection === 'close') {
            botStatus = "Disconnected. Reconnecting...";
            setTimeout(connectToWhatsApp, 5000);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

connectToWhatsApp();

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
            const jid = `${pendingStore.phone}@s.whatsapp.net`;
            const message = `Hi ${pendingStore.name}! 👋\n\nHu ek student web developer chu, tamara area na clothing collection mate ek special 3D Mobile website banavi che. Joiye to "YES" lakhi reply karo! ✨`;
            
            await sock.sendMessage(jid, { text: message });
            pendingStore.status = 'Sent';
            console.log(`Message sent to ${pendingStore.name} (${pendingStore.phone})`);
        } else (err) => {
            console.error(`Failed to send:`, err);
        }
    }, (Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime) * 60 * 1000);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dashboard running on port ${PORT}`);
});
