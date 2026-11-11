const express = require('express');
const { makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const https = require('https');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Crash-Guard: Bad MAC કે session errors થી સર્વર બંધ નહીં થવા દે
process.on('uncaughtException', (err) => {
    console.log('Handled System Warning (Ignored):', err.message);
});
process.on('unhandledRejection', (err) => {
    console.log('Handled Promise Warning (Ignored):', err);
});

let sock = null;
let isConnected = false;
let isRunning = false;
let hasRequestedCode = false;
let statusMessage = "⏳ Connecting to WhatsApp...";
let pairingCodeValue = "";

let sentToday = 0;
let limitPerDay = 15;
let minDelay = 5;
let maxDelay = 8;

let activeCategory = 'jewelry'; 

let msgTemplates = {
    boys: `Hi {storeName}! 👋\n\nमैंने आपका Instagram page देखा, मेन्स collection बहुत ही शानदार है! मैं एक student web developer हूँ और मैंने आपके स्टोर के लिए एक special 3D Mobile website बनाई है। देखना चाहेंगे? "YES" रिप्लाई करें! ✨`,
    girls: `Hi {storeName}! 👋\n\nमैंने आपका Instagram page देखा, गर्ल्स एंड लेडीज collection बहुत ही शानदार है! मैं एक student web developer हूँ और मैंने आपके बुटीक/स्टोर के लिए एक special 3D Mobile website बनाई है। देखना चाहेंगे? "YES" रिप्लाई करें! ✨`,
    jewelry: `Hi {storeName}! 👋\n\nमैंने आपका Jewellery collection देखा, डिज़ाइन्स बहुत ही शानदार हैं! मैं एक student web developer हूँ और मैंने आपकी ज्वेलरी शॉप के लिए एक special 3D Mobile website बनाई है। देखना चाहेंगे? "YES" रिप्लाई करें! ✨`
};

let storesQueues = {
    boys: [],
    girls: [],
    jewelry: []
};

let timerId = null;
const MY_NUMBER = "918401690936";

const categoryNames = {
    boys: "👔 Boys / Men's Stores",
    girls: "👗 Girls / Women's Stores",
    jewelry: "💍 Girls Jewelry Stores"
};

// ================= ANTI-SLEEP ENGINE ================= //
// Render ને ક્યારેય ઊંઘવા (Sleep થવા) નહીં દે!
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || "https://whatsapp-bot-6ig6.onrender.com";
setInterval(() => {
    https.get(`${RENDER_EXTERNAL_URL}/ping`, (res) => {}).on('error', () => {});
}, 4 * 60 * 1000); // દર 4 મિનિટે સેલ્ફ-પિંગ

app.get('/ping', (req, res) => res.send('OK - Bot Alive'));
// ===================================================== //

async function connectToWhatsApp(shouldPair = false) {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS('Chrome'),
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            emitOwnEvents: false,
            markOnlineOnConnect: true
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && !sock.authState.creds.registered && shouldPair && !hasRequestedCode) {
                hasRequestedCode = true;
                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(MY_NUMBER);
                        pairingCodeValue = code;
                        statusMessage = `📲 TARO PAIRING CODE: ${code}`;
                        console.log(`\n========================================`);
                        console.log(`🔥 TARO PAIRING CODE: ${code}`);
                        console.log(`========================================\n`);
                    } catch (e) {
                        hasRequestedCode = false;
                        statusMessage = "⚠️ Click 'Get New QR / Reconnect' to fetch code.";
                    }
                }, 2000);
            }
            
            if (connection === 'open') {
                isConnected = true;
                hasRequestedCode = false;
                pairingCodeValue = "";
                statusMessage = isRunning ? `🚀 Dispatcher Running (${categoryNames[activeCategory]})` : "✔️ WhatsApp Connected! Ready to send.";
                console.log('✅ WhatsApp Connected Successfully!');
            } else if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                
                // Reconnect automatically without clearing files
                if (statusCode !== DisconnectReason.loggedOut) {
                    statusMessage = "🔄 Reconnecting WhatsApp...";
                    setTimeout(() => connectToWhatsApp(false), 5000);
                } else {
                    statusMessage = "📲 Disconnected. Click 'Get New QR / Reconnect' to login.";
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
    } catch (err) {
        statusMessage = "⚠️ Connection resetting...";
        setTimeout(() => connectToWhatsApp(false), 5000);
    }
}

connectToWhatsApp(true);

app.get('/', (req, res) => {
    const currentQueue = storesQueues[activeCategory];
    const currentMsg = msgTemplates[activeCategory];

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Mann's Auto-Dispatcher</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { background-color: #0b1116; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 15px; }
            .card { background-color: #131b23; border: 1px solid #222e3a; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
            h2 { margin-top: 0; font-size: 22px; display: flex; align-items: center; gap: 10px; }
            .status-line { font-size: 18px; font-weight: 500; margin: 15px 0; display: flex; align-items: center; gap: 8px; }
            .status-box { background-color: #1c2733; padding: 14px; border-radius: 8px; color: #cfd8dc; margin-bottom: 18px; font-size: 15px; line-height: 1.5; }
            .sent-counter { font-size: 20px; font-weight: bold; margin-bottom: 18px; }
            .btn { width: 100%; padding: 14px; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; margin-bottom: 12px; border: none; display: flex; justify-content: center; align-items: center; gap: 8px; color: white; }
            .btn-start { background-color: #00a870; }
            .btn-stop { background-color: #ef4444; }
            .btn-reset { background-color: #1c2733; border: 1px solid #37475a; color: #e2e8f0; font-weight: 500; }
            .btn-reconnect { background-color: #1c2733; border: 1px solid #d97706; color: #fbbf24; font-weight: 500; }
            .btn-add { background-color: #131b23; border: 1px solid #00a870; color: #ffffff; margin-top: 15px; }
            .btn-remove { background-color: #131b23; border: 1px solid #ef4444; color: #ef4444; font-weight: 500; padding: 10px; margin-bottom: 15px; }
            
            .cat-row { display: flex; justify-content: space-between; align-items: center; background-color: #1c2733; padding: 12px 15px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #2e3d4f; }
            .cat-row.active { border: 2px solid #00a870; background-color: #142e26; }
            .cat-info { font-size: 16px; font-weight: 600; }
            .cat-sub { font-size: 13px; color: #94a3b8; margin-top: 3px; }
            .btn-switch { background-color: #3b82f6; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; }
            .badge-active { background-color: #00a870; color: white; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: bold; }

            label { display: block; margin-bottom: 8px; font-size: 16px; color: #e2e8f0; }
            input[type="number"], textarea { width: 100%; background-color: #1c2733; border: 1px solid #2e3d4f; color: #ffffff; padding: 12px; border-radius: 8px; font-size: 15px; box-sizing: border-box; margin-bottom: 16px; font-family: inherit; }
            textarea { font-family: monospace; line-height: 1.4; }
            .queue-item { padding: 14px 0; border-bottom: 1px solid #1e293b; font-size: 17px; line-height: 1.4; }
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
                <b style="color: #fbbf24; font-size: 16px;">${statusMessage}</b><br>
                <small style="color: #00a870;">Mode: <b>${categoryNames[activeCategory]}</b> | 🛡️ Anti-Sleep: <b>ACTIVE</b></small>
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

        <!-- Card 2: Category Switcher -->
        <div class="card">
            <h2>📂 Select Category (Switch)</h2>
            
            <div class="cat-row ${activeCategory === 'boys' ? 'active' : ''}">
                <div>
                    <div class="cat-info">👔 Boys / Men's Stores</div>
                    <div class="cat-sub">Total: ${storesQueues.boys.length} | Pending: ${storesQueues.boys.filter(s => s.status === 'Pending').length}</div>
                </div>
                ${activeCategory === 'boys' 
                    ? `<span class="badge-active">✅ ACTIVE</span>` 
                    : `<form action="/switch" method="POST"><input type="hidden" name="category" value="boys"><button type="submit" class="btn-switch">Switch to This</button></form>`}
            </div>

            <div class="cat-row ${activeCategory === 'girls' ? 'active' : ''}">
                <div>
                    <div class="cat-info">👗 Girls / Women's Stores</div>
                    <div class="cat-sub">Total: ${storesQueues.girls.length} | Pending: ${storesQueues.girls.filter(s => s.status === 'Pending').length}</div>
                </div>
                ${activeCategory === 'girls' 
                    ? `<span class="badge-active">✅ ACTIVE</span>` 
                    : `<form action="/switch" method="POST"><input type="hidden" name="category" value="girls"><button type="submit" class="btn-switch">Switch to This</button></form>`}
            </div>

            <div class="cat-row ${activeCategory === 'jewelry' ? 'active' : ''}">
                <div>
                    <div class="cat-info">💍 Girls Jewelry Stores</div>
                    <div class="cat-sub">Total: ${storesQueues.jewelry.length} | Pending: ${storesQueues.jewelry.filter(s => s.status === 'Pending').length}</div>
                </div>
                ${activeCategory === 'jewelry' 
                    ? `<span class="badge-active">✅ ACTIVE</span>` 
                    : `<form action="/switch" method="POST"><input type="hidden" name="category" value="jewelry"><button type="submit" class="btn-switch">Switch to This</button></form>`}
            </div>
        </div>

        <!-- Card 3: Settings -->
        <div class="card">
            <h2>⚙️ Settings (${categoryNames[activeCategory]})</h2>
            <form action="/save" method="POST">
                <label>Limit/Day:</label>
                <input type="number" name="limitPerDay" value="${limitPerDay}" required>

                <label>Min Delay (m):</label>
                <input type="number" name="minDelay" value="${minDelay}" required>

                <label>Max Delay (m):</label>
                <input type="number" name="maxDelay" value="${maxDelay}" required>

                <label>Msg (for ${categoryNames[activeCategory]}):</label>
                <textarea name="msgTemplate" rows="5" required>${currentMsg}</textarea>

                <button type="submit" class="btn btn-start">💾 Save Settings</button>
            </form>
        </div>

        <!-- Card 4: Add Stores -->
        <div class="card">
            <h2>➕ Add to ${categoryNames[activeCategory]}</h2>
            <form action="/add" method="POST">
                <textarea name="stores" rows="4" placeholder="Store Name, 919876543210&#10;Jewels Name, 9879123456" required></textarea>
                <button type="submit" class="btn btn-add">📥 Add Stores</button>
            </form>
        </div>

        <!-- Card 5: Stores Queue -->
        <div class="card">
            <h2>📋 Stores Queue (${currentQueue.length})</h2>
            <form action="/remove-sent" method="POST">
                <button type="submit" class="btn btn-remove">🗑️ Remove Already 'Sent' Stores</button>
            </form>
            <div>
                ${currentQueue.length === 0 ? '<p style="color:#64748b;">Queue is empty. Add stores above!</p>' : ''}
                ${currentQueue.map(s => `<div class="queue-item">${s.name} (${s.phone}) - <b>${s.status}</b></div>`).join('')}
            </div>
        </div>

    </body>
    </html>
    `);
});

app.post('/switch', (req, res) => {
    const newCat = req.body.category;
    if (storesQueues[newCat]) {
        activeCategory = newCat;
        statusMessage = `🔄 Switched to ${categoryNames[activeCategory]}!`;
    }
    res.redirect('/');
});

app.post('/start', async (req, res) => {
    if (!isConnected) {
        statusMessage = "❌ Cannot start: WhatsApp not connected! Reconnect first.";
        return res.redirect('/');
    }
    if (!isRunning) {
        isRunning = true;
        statusMessage = `🚀 Dispatcher Started for ${categoryNames[activeCategory]}!`;
        processQueue();
    }
    res.redirect('/');
});

app.post('/stop', (req, res) => {
    isRunning = false;
    if (timerId) clearTimeout(timerId);
    statusMessage = "🛑 Dispatcher Stopped.";
    res.redirect('/');
});

app.post('/reset', (req, res) => {
    sentToday = 0;
    statusMessage = "🔄 Today's counter reset to 0.";
    res.redirect('/');
});

app.post('/reconnect', async (req, res) => {
    try {
        if (timerId) clearTimeout(timerId);
        isRunning = false;
        isConnected = false;
        hasRequestedCode = false;
        try { if (sock) sock.end(); } catch (e) {}
        if (fs.existsSync('auth_info_baileys')) {
            fs.rmSync('auth_info_baileys', { recursive: true, force: true });
        }
        statusMessage = "⏳ Generating fresh Pairing Code... Wait 5 seconds & Refresh!";
        connectToWhatsApp(true);
    } catch (e) {}
    res.redirect('/');
});

app.post('/save', (req, res) => {
    limitPerDay = parseInt(req.body.limitPerDay) || 15;
    minDelay = parseInt(req.body.minDelay) || 5;
    maxDelay = parseInt(req.body.maxDelay) || 8;
    if (req.body.msgTemplate) {
        msgTemplates[activeCategory] = req.body.msgTemplate;
    }
    statusMessage = `💾 Settings Saved for ${categoryNames[activeCategory]}!`;
    res.redirect('/');
});

app.post('/add', (req, res) => {
    const lines = req.body.stores.split('\n');
    let count = 0;
    lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
            let cleanPhone = parts[1].replace(/[^0-9]/g, '');
            if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
            if (cleanPhone.length >= 10) {
                storesQueues[activeCategory].push({
                    name: parts[0].trim(),
                    phone: cleanPhone,
                    status: 'Pending'
                });
                count++;
            }
        }
    });
    statusMessage = `📥 Added ${count} stores to ${categoryNames[activeCategory]}.`;
    res.redirect('/');
});

app.post('/remove-sent', (req, res) => {
    storesQueues[activeCategory] = storesQueues[activeCategory].filter(s => s.status !== 'Sent');
    statusMessage = `🗑️ Removed 'Sent' stores from ${categoryNames[activeCategory]}.`;
    res.redirect('/');
});

async function processQueue() {
    if (!isRunning || !isConnected) return;

    if (sentToday >= limitPerDay) {
        isRunning = false;
        statusMessage = `🎯 Daily limit reached (${sentToday}/${limitPerDay}). Dispatcher stopped.`;
        return;
    }

    const currentQueue = storesQueues[activeCategory];
    const pendingStore = currentQueue.find(s => s.status === 'Pending');
    
    if (!pendingStore) {
        isRunning = false;
        statusMessage = `✅ All pending stores in ${categoryNames[activeCategory]} completed!`;
        return;
    }

    try {
        const jid = `${pendingStore.phone}@s.whatsapp.net`;
        const personalizedMsg = msgTemplates[activeCategory].replace(/{storeName}/g, pendingStore.name);
        
        await sock.sendMessage(jid, { text: personalizedMsg });
        pendingStore.status = 'Sent';
        sentToday++;
        
        const delayMinutes = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        statusMessage = `✅ Sent to ${pendingStore.name}. Next in ${delayMinutes} min...`;
        console.log(`[${activeCategory.toUpperCase()}] Sent to ${pendingStore.name}. Next in ${delayMinutes}m`);

        if (isRunning && sentToday < limitPerDay) {
            timerId = setTimeout(processQueue, delayMinutes * 60 * 1000);
        } else if (sentToday >= limitPerDay) {
            isRunning = false;
            statusMessage = `🎯 Daily limit reached (${sentToday}/${limitPerDay}).`;
        }
    } catch (err) {
        pendingStore.status = 'Failed';
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
