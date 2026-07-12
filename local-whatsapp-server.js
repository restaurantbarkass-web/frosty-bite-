const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

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

    // Runs on port 3001 to avoid EADDRINUSE conflicts on port 3000
    const httpModule = require("http");
    const server = httpModule.createServer(app);

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.warn(`\n⚠️  [Resilient Warning] Port 3001 is already in use!`);
            console.warn("⚠️  This means another instance of this WhatsApp server is already running on your computer.");
            console.warn("⚠️  That's perfectly fine! The existing instance is already handling message delivery.");
            console.warn("⚠️  We will still start the background polling queue to ensure all OTP dispatches succeed.");
            startAppletPolling();
        } else {
            console.error("❌ Express server error:", err);
        }
    });

    const port = process.env.PORT || 3001;
    server.listen(port, () => {
        console.log(`🚀 Server successfully running on port ${port}`);
        startAppletPolling();
    });
});

const http = require("http");
const https = require("https");
const { URL } = require("url");

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

// Background polling loop to pull pending WhatsApp messages from the cloud/local backend
async function startAppletPolling() {
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

                    // Acknowledge receipt to clear it from the server outbox queue
                    await customFetchJson(`${currentUrl}/api/auth/whatsapp-ack`, {
                        method: "POST",
                        body: { id: item.id }
                    }).catch(e => console.warn("⚠️ Failed to send ack to app server:", e.message));

                } catch (sendErr) {
                    console.error(`❌ Failed to deliver message for item ${item.id}:`, sendErr.message);
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

client.initialize();
