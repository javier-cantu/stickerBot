// sb004_cargarStickersJson.js
// Ahora voy a cargar el archivo stickers.json que tiene los nombres de los archivos y sus tags. 

const qrcode = require('qrcode-terminal');
const {Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

// Inicializar cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
});

// Variable para guardar data de los stickers
let stickersData = {};

// Generar QR para escanear
client.on('qr', (qr) => {
    console.log('\nScan this QR code to log in:\n');
    qrcode.generate(qr, {small: true});
});

// Cuando el cliente está listo
client.on('ready', () => {
    console.log('The bot is ready!');

    // Cargar data de stickers.json
    const stickersPath = path.join(__dirname, '..', 'media', 'stickers', 'stickers.json');
    
    // Imprimir la ruta generada para validarla
    console.log('Stickers file path:', stickersPath);

    if (fs.existsSync(stickersPath)) {
        const rawData = fs.readFileSync(stickersPath);
        stickersData = JSON.parse(rawData);
        console.log('Stickers data loaded:', stickersData);
    } else {
        console.log('No stickers.json file found.');
    }
});

// Responder a un mensaje simple de cualquier usuario
client.on('message', async (message) => {
    if (message.body.toLocaleLowerCase() === '!ping') {
        message.reply('pong!');
    }

    // Marcar el chat como no leido luego de responder
    const chat = await message.getChat();
    chat.markUnread();
});

// Responder y detectar mensajes enviados por el host
client.on('message_create', async (message) => {
    if (message.fromMe) {
        if (message.body.toLocaleLowerCase() === '!ping') {
            message.reply('pong!');
        }
    }
});

// Iniciar cliente
client.initialize();