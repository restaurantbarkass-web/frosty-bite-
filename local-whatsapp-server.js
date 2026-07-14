const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Process-level handlers to intercept locked session database (EBUSY) or connection issues gracefully
process.on("uncaughtException", (err) => {
    const isEBusy = err.message.includes("EBUSY") || err.stack?.includes("EBUSY");
    const isLocked = err.message.includes("resource busy or locked") || err.stack?.includes("resource busy or locked");
    
    if (isEBusy || isLocked) {
        console.error("\n==========================================================================");
        console.error("⚠️  [LOCK ERROR] WhatsApp Web Session Database is Locked!");
        console.error("==========================================================================");
        console.error("This happens because another Chrome/Chromium browser or WhatsApp session");
        console.error("process is already running on your computer and holding a file lock.");
        console.error("\n👉 HOW TO FIX THIS IN 3 SIMPLE STEPS:");
        console.error("1. Close any Chrome window that was opened by this automation server.");
        console.error("2. Open Task Manager (Ctrl + Shift + Esc) and terminate any hanging");
        console.error("   'Node.js' or 'Google Chrome' processes.");
        console.error("3. If the issue persists, delete the '.wwebjs_auth' folder in your directory");
        console.error("   to clear the session lock, then restart this server.");
        console.error("==========================================================================\n");
        process.exit(0);
    } else {
        console.error("❌ Uncaught Exception:", err);
        process.exit(1);
    }
});

process.on("unhandledRejection", (reason) => {
    console.error("❌ Unhandled Promise Rejection:", reason);
});

const app = express();

app.use(cors());
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "frosty"
    }),
    webVersionBranch: "remote",
    webVersion: "2.2412.54", // Pinned stable WhatsApp Web version to fix getChat/sendMessage issues
    puppeteer: {
        headless: false,
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    }
});

client.on("qr", (qr) => {
    console.log("📱 Scan this QR Code:");
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log("✅ WhatsApp Connected!");
    startAppletPolling();
});

const httpModule = require("http");
const http = httpModule;
const https = require("https");
const { URL } = require("url");

const server = httpModule.createServer(app);
const port = process.env.PORT || 3001;

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.warn("\n==========================================================================");
        console.warn(`⚠️  [INFO] Port ${port} is already in use!`);
        console.warn("⚠️  This means another instance of this WhatsApp server is already running");
        console.warn("⚠️  on your computer and is fully active, listening, and delivering messages.");
        console.warn("⚠️  To prevent Chromium session lock conflicts (EBUSY), this process will");
        console.warn("⚠️  exit cleanly. No action is required from your side!");
        console.warn("==========================================================================\n");
        process.exit(0);
    } else {
        console.error("❌ Express server error:", err);
        process.exit(1);
    }
});

server.listen(port, () => {
    console.log(`🚀 Server successfully running on port ${port}`);
    console.log("⏳ Initializing WhatsApp Web Client, please wait for connection...");
    client.initialize().catch((initErr) => {
        console.error("❌ WhatsApp initialization error:", initErr.message);
    });
});

// Zero-dependency HTTP/HTTPS json helper supporting all Node.js versions (including old Node.js < 18)
function customFetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === "https:" ? https : http;
            const reqOptions = {
                method: options.method || "GET",
                headers: {
                    "Accept": "application/json",
                    ...(options.headers || {})
                }
            };

            if (options.body) {
                reqOptions.headers["Content-Type"] = "application/json";
            }

            const req = protocol.request(url, reqOptions, (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk;
                });
                res.on("end", () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            resolve({});
                        }
                    } else {
                        reject(new Error(`Server returned status ${res.statusCode}`));
                    }
                });
            });

            req.on("error", (err) => {
                reject(err);
            });

            if (options.body) {
                req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
            }
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

// Dynamic applet polling URL that can be updated in real-time by the client
let activeAppUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

// Check if an error message represents a Puppeteer fatal/connection state that can be resolved by client reboot
function isPuppeteerFatalError(errMessage) {
    if (!errMessage) return false;
    const msg = errMessage.toLowerCase();
    return msg.includes("detached frame") || 
           msg.includes("protocol error") || 
           msg.includes("target closed") || 
           msg.includes("execution context was destroyed") || 
           msg.includes("browser has disconnected") || 
           msg.includes("page crashed") || 
           msg.includes("session closed") ||
           msg.includes("evaluation failed");
}

let isRecovering = false;

// Gracefully destroy and rebuild the WhatsApp client browser on fatal Puppeteer errors
async function triggerWhatsAppClientRecovery() {
    if (isRecovering) return;
    isRecovering = true;
    
    console.error("\n==========================================================================");
    console.error("⚠️  [RECOVERY] Critical Puppeteer/WhatsApp Web error detected!");
    console.error("🔄  Destroying and re-initializing the WhatsApp Web client...");
    console.error("==========================================================================\n");

    try {
        console.log("🔄 Destroying WhatsApp client...");
        await client.destroy().catch((destroyErr) => {
            console.warn("⚠️ Warning during client destroy:", destroyErr.message);
        });
        
        console.log("⏳ Waiting 3 seconds before rebooting browser...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log("🔄 Re-initializing WhatsApp Web client...");
        await client.initialize();
        console.log("✅ WhatsApp Web Client successfully re-initialized!");
    } catch (err) {
        console.error("❌ [RECOVERY ERROR] WhatsApp Web Client recovery failed:", err.message);
    } finally {
        isRecovering = false;
    }
}

let isPollingStarted = false;

// Background polling loop to pull pending WhatsApp messages from the cloud/local backend
async function startAppletPolling() {
    if (isPollingStarted) {
        console.log("📡 Background WhatsApp Dispatch queue polling is already active.");
        return;
    }
    isPollingStarted = true;
    console.log(`📡 Background WhatsApp Dispatch queue polling started for: ${activeAppUrl}`);

    setInterval(async () => {
        try {
            const currentUrl = activeAppUrl;
            // Poll for pending messages
            const data = await customFetchJson(`${currentUrl}/api/auth/whatsapp-poll`, {
                method: "GET"
            }).catch(() => null);

            if (!data) {
                return; // Silence connection errors when offline/stale
            }

            const messages = data.messages || [];

            for (const item of messages) {
                let shouldAck = true;
                try {
                    const cleanNum = item.phone.replace(/\D/g, "");
                    const chatId = `${cleanNum}@c.us`;

                    console.log(`📨 Received pending WhatsApp message for +${cleanNum} from queue. Sending...`);
                    
                    const isRegistered = await client.isRegisteredUser(chatId).catch(() => true);
                    if (!isRegistered) {
                        console.warn(`⚠️ Phone +${cleanNum} is not registered on WhatsApp.`);
                    }

                    await client.sendMessage(chatId, item.message);
                    console.log(`✅ Message successfully delivered to +${cleanNum}!`);

                } catch (sendErr) {
                    console.error(`❌ Failed to deliver message for item ${item.id}:`, sendErr.message);
                    if (isPuppeteerFatalError(sendErr.message)) {
                        shouldAck = false;
                        triggerWhatsAppClientRecovery().catch(() => {});
                    }
                } finally {
                    if (shouldAck) {
                        // Always acknowledge receipt to clear it from the server outbox queue,
                        // preventing infinite retry loops and terminal spam.
                        await customFetchJson(`${currentUrl}/api/auth/whatsapp-ack`, {
                            method: "POST",
                            body: { id: item.id }
                        }).catch(e => console.warn("⚠️ Failed to send ack to app server:", e.message));
                    } else {
                        console.warn(`⏳ [DELAYED] Message ${item.id} delivery postponed until client recovery finishes.`);
                    }
                }
            }
        } catch (pollErr) {
            // Silence standard poll errors to avoid terminal spam
        }
    }, 1500); // Poll every 1.5 seconds
}

// Endpoint to dynamically register the active frontend/backend URL
app.post("/register", (req, res) => {
    const { appUrl } = req.body;
    if (appUrl && appUrl.startsWith("http")) {
        const cleanUrl = appUrl.replace(/\/+$/, "");
        if (cleanUrl !== activeAppUrl) {
            console.log(`📡 Dynamically updated applet polling URL via /register: ${cleanUrl}`);
            activeAppUrl = cleanUrl;
        }
    }
    res.json({ success: true, activeAppUrl });
});

app.post("/send", async (req, res) => {
    try {
        let { number, message, appUrl, app_url } = req.body;

        const incomingAppUrl = appUrl || app_url;
        if (incomingAppUrl && incomingAppUrl.startsWith("http")) {
            const cleanUrl = incomingAppUrl.replace(/\/+$/, "");
            if (cleanUrl !== activeAppUrl) {
                console.log(`📡 Dynamically updated applet polling URL via /send body: ${cleanUrl}`);
                activeAppUrl = cleanUrl;
            }
        }

        if (!number || !message) {
            return res.status(400).json({
                success: false,
                error: "Number and message are required"
            });
        }

        // Remove spaces, +, -, etc.
        number = number.replace(/\D/g, "");

        const chatId = `${number}@c.us`;

        // Check if the number exists on WhatsApp
        const isRegistered = await client.isRegisteredUser(chatId);

        if (!isRegistered) {
            return res.status(400).json({
                success: false,
                error: "This number is not registered on WhatsApp."
            });
        }

        const response = await client.sendMessage(chatId, message);

        res.json({
            success: true,
            id: response.id._serialized,
            message: "Message sent successfully"
        });

    } catch (err) {
        console.error("SEND ERROR:", err);

        res.status(500).json({
            success: false,
            error: err.message,
            stack: err.stack
        });
    }
});

// Initialized inside server.listen block above
// client.initialize();
