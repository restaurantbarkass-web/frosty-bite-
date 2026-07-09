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
    app.listen(process.env.PORT || 3001, () => {
        console.log("🚀 Server running on port 3001");
    });
});

app.post("/send", async (req, res) => {
    try {
        let { number, message } = req.body;

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
