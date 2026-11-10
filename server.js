const express = require('express');
const { makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let sock;
let isConnected = false;
let isRunning = false;
let statusMessage = "⏳ Connecting to WhatsApp...";
let pairingCodeValue = "";

let sentToday = 0;
let limitPerDay = 10;
let minDelay = 5;
let maxDelay = 8;
let msgTemplate = `Hi {storeName}! 👋\n\nमैंने आपका Instagram page देखा, collection बहुत ही शानदार है! मैं एक student web developer हूँ और मैंने आपके स्टोर के लिए एक special 3D Mobile website बनाई है। देखना चाहेंगे? "YES" रिप्लाई करें! ✨`;

let storesQueue = [];
let timerId = null;

// Taro Number Pairing Code mate
const MY_NUMBER = "918401690936";

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Chrome')
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(MY_NUMBER);
                pairingCodeValue = code;
                statusMessage = `📲 Pairing Code: ${code} (Enter in WhatsApp)`;
                console.log(`\n========================================`);
                console.log(`🔥 TARO PAIRING CODE: ${code}`);
                console.log(`========================================\n`);
            } catch (err) {
                console.error("Pairing Error:", err);
            }
        }, 5000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            isConnected = true;
            pairingCodeValue = "";
            statusMessage = isRunning ? "🚀 Dispatcher Running..." : "✔️ WhatsApp Connected! Ready to send.";
            console.log('WhatsApp Connected Successfully!');
        } else if (connection === 'close') {
            isConnected = false;
            statusMessage = "❌ Disconnected. Reconnecting...";
            setTimeout(connectToWhatsApp, 5000);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

connectToWhatsApp();

// Exact Same-to-Same Mann's Auto-Dispatcher UI
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Mann's Auto-Dispatcher</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {
                background-color: #0b1116;
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                margin: 0;
                padding: 15px;
            }
            .card {
                background-color: #131b23;
                border: 1px solid #222e3a;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
            }
            h2 {
                margin-top: 0;
                font-size: 22px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .status-line {
                font-size: 18px;
                font-weight: 500;
                margin: 15px 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .status-box {
                background-color: #1c2733;
                padding: 14px;
                border-radius: 8px;
                color: #cfd8dc;
                margin-bottom: 18px;
                font-size: 15px;
            }
            .sent-counter {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 18px;
            }
            .btn {
                width: 100%;
                padding: 14px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                margin-bottom: 12px;
                border: none;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 8px;
                color: white;
            }
            .btn-start { background-color: #00a870; }
            .btn-stop { background-color: #ef4444; }
            .btn-reset { background-color: #1c2733; border: 1px solid #37475a; color: #e2e8f0; font-weight: 500; }
            .btn-reconnect { background-color: #1c2733; border: 1px solid #d97706; color: #fbbf24; font-weight: 500; }
            .btn-add { background-color: #131b23; border: 1px solid #00a870; color: #ffffff; margin-top: 15px; }
            .btn-remove { background-color: #131b23; border: 1px solid #ef4444; color: #ef4444; font-weight: 500; padding: 10px; margin-bottom: 15px; }
            
            label {
                display: block;
                margin-bottom: 8px;
                font-size: 16px;
                color: #e2e8f0;
            }
            input[type="number"], textarea {
                width: 100%;
                background-color: #1c2733;
                border: 1px solid #2e3d4f;
                color: #ffffff;
                padding: 12px;
                border-radius: 8px;
                font-size: 15px;
                box-sizing: border-box;
                margin-bottom: 16px;
                font-family: inherit;
            }
            textarea {
                font-family: monospace;
                line-height: 1.4;
            }
            .queue-item {
                padding: 14px 0;
                border-bottom: 1px solid #1e293b;
                font-size: 17px;
                line-height: 1.4;
            }
            form { margin: 0; }
        </style>
    </head>
    <body>

        <!-- Card 1: Status & Controls -->
        <div class="card">
            <h2>🤖 Mann's Auto-Dispatcher</h2>
            <div class="status-line">
                <span>${isConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
            </div>
            <div class="status-box">
                ${statusMessage}
            </div>
            <div class="sent-counter">
                Sent Today: ${sentToday} / ${limitPerDay}
            </div>

            <form action="/start" method="POST">
                <button type="submit" class="btn btn-start">▶ START DISPATCHER</button>
            </form>
            <form action="/stop" method="POST">
                <button type="submit" class="btn btn-stop">⏹ STOP DISPATCHER</button>
            </form>
            <form action="/reset" method="POST">
                <button type="submit" class="btn btn-reset">🔄 Reset Today Counter (0/${limitPerDay})</button>
            </form>
            <form action="/reconnect" method="POST">
                <button type="submit" class="btn btn-reconnect">📲 Get New QR / Reconnect WhatsApp</button>
            </form>
        </div>

        <!-- Card 2: Settings -->
        <div class="card">
            <h2>⚙️ Settings</h2>
            <form action="/save" method="POST">
                <label>Limit/Day:</label>
                <input type="number" name="limitPerDay" value="${limitPerDay}" required>

                <label>Min Delay (m):</label>
                <input type="number" name="minDelay" value="${minDelay}" required>

                <label>Max Delay (m):</label>
                <input type="number" name="maxDelay" value="${maxDelay}" required>

                <label>Msg:</label>
                <textarea name="msgTemplate" rows="5" required>${msgTemplate}</textarea>

                <button type="submit" class="btn btn-start">💾 Save Settings</button>
            </form>
        </div>

        <!-- Card 3: Add Stores -->
        <div class="card">
            <h2>➕ Add Stores (Name, Number)</h2>
            <form action="/add" method="POST">
                <textarea name="stores" rows="4" placeholder="Max Zone, 917779090982&#10;Denim Hub, 9879123456" required></textarea>
                <button type="submit" class="btn btn-add">📥 Add Stores</button>
            </form>
        </div>

        <!-- Card 4: Stores Queue -->
        <div class="card">
            <h2>📋 Stores Queue</h2>
            <form action="/remove-sent" method="POST">
                <button type="submit" class="btn btn-remove">🗑️ Remove Already 'Sent' Stores</button>
            </form>
            <div>
                ${storesQueue.map(s => `<div class="queue-item">${s.name} (${s.phone}) - <b>${s.status}</b></div>`).join('')}
            </div>
        </div>

    </body>
    </html>
    `);
});

// START DISPATCHER Button Logic
app.post('/start', async (req, res) => {
    if (!isConnected) {
        statusMessage = "❌ Cannot start: WhatsApp not connected!";
        return res.redirect('/');
    }
    if (!isRunning) {
        isRunning = true;
        statusMessage = "🚀 Dispatcher Started! Sending messages...";
        processQueue(); // Start dabavta j pehlo message check karse
    }
    res.redirect('/');
});

// STOP DISPATCHER Button Logic
app.post('/stop', (req, res) => {
    isRunning = false;
    if (timerId) clearTimeout(timerId);
    statusMessage = "🛑 Dispatcher Stopped.";
    res.redirect('/');
});

// Reset Counter Button Logic
app.post('/reset', (req, res) => {
    sentToday = 0;
    statusMessage = "🔄 Today's counter reset to 0.";
    res.redirect('/');
});

// Reconnect / Get New Pairing Code Logic
app.post('/reconnect', async (req, res) => {
    try {
        if (timerId) clearTimeout(timerId);
        isRunning = false;
        isConnected = false;
        if (fs.existsSync('auth_info_baileys')) {
            fs.rmSync('auth_info_baileys', { recursive: true, force: true });
        }
        statusMessage = "⏳ Generating new Pairing Code in 5 seconds... Refresh page!";
        connectToWhatsApp();
    } catch (e) {
        console.error(e);
    }
    res.redirect('/');
});

// Save Settings Logic
app.post('/save', (req, res) => {
    limitPerDay = parseInt(req.body.limitPerDay) || 10;
    minDelay = parseInt(req.body.minDelay) || 5;
    maxDelay = parseInt(req.body.maxDelay) || 8;
    msgTemplate = req.body.msgTemplate || msgTemplate;
    statusMessage = "💾 Settings Saved Successfully!";
    res.redirect('/');
});

// Add Stores Logic
app.post('/add', (req, res) => {
    const lines = req.body.stores.split('\n');
    let count = 0;
    lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
            let cleanPhone = parts[1].replace(/[^0-9]/g, '');
            if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
            storesQueue.push({
                name: parts[0].trim(),
                phone: cleanPhone,
                status: 'Pending'
            });
            count++;
        }
    });
    statusMessage = `📥 Added ${count} stores to queue.`;
    res.redirect('/');
});

// Remove Already 'Sent' Stores Logic
app.post('/remove-sent', (req, res) => {
    storesQueue = storesQueue.filter(s => s.status !== 'Sent');
    statusMessage = "🗑️ Removed all 'Sent' stores from queue.";
    res.redirect('/');
});

// Background Dispatcher Function
async function processQueue() {
    if (!isRunning || !isConnected) return;

    if (sentToday >= limitPerDay) {
        isRunning = false;
        statusMessage = `🎯 Daily limit reached (${sentToday}/${limitPerDay}). Dispatcher stopped.`;
        return;
    }

    const pendingStore = storesQueue.find(s => s.status === 'Pending');
    if (!pendingStore) {
        isRunning = false;
        statusMessage = "✅ All pending stores completed!";
        return;
    }

    try {
        const jid = `${pendingStore.phone}@s.whatsapp.net`;
        const personalizedMsg = msgTemplate.replace(/{storeName}/g, pendingStore.name);
        
        await sock.sendMessage(jid, { text: personalizedMsg });
        pendingStore.status = 'Sent';
        sentToday++;
        
        const delayMinutes = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        statusMessage = `✅ Sent to ${pendingStore.name}. Next message in ${delayMinutes} min...`;
        console.log(`Message sent to ${pendingStore.name}. Next in ${delayMinutes}m`);

        if (isRunning && sentToday < limitPerDay) {
            timerId = setTimeout(processQueue, delayMinutes * 60 * 1000);
        } else if (sentToday >= limitPerDay) {
            isRunning = false;
            statusMessage = `🎯 Daily limit reached (${sentToday}/${limitPerDay}).`;
        }
    } catch (err) {
        pendingStore.status = 'Failed';
        console.error(`Failed to send to ${pendingStore.name}:`, err);
        statusMessage = `❌ Failed to send to ${pendingStore.name}. Trying next in 1 min...`;
        if (isRunning) {
            timerId = setTimeout(processQueue, 60 * 1000);
        }
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dashboard running on port ${PORT}`);
});
