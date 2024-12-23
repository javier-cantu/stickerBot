const qrcode = require('qrcode-terminal');
const {Client, LocalAuth } = require('whatsapp-web.js');

// Inicializar cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
});

// Generar QR para escanear
client.on('qr', (qr) => {
    console.log('\nScan this QR code to log in:\n');
    qrcode.generate(qr, {small: true});
});

// Cuando el cliente está listo
client.on('ready', () => {
    console.log('The bot is ready!');
});

// Responder a un mensaje simple
client.on('message', (message) => {
    if (message.body.toLocaleLowerCase() === '!ping') {
        message.reply('pong');
    }
});

// Iniciar cliente
client.initialize();