// sb008_mandarStickerV1.js
// Este responde la lista de stickers con keywords con coincidencias exactas
// Luego manda los stickers. 

const qrcode = require('qrcode-terminal');
const {Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
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
        const comando = message.body.toLowerCase().trim();
        // Comando '!ping' para pruebas
        if (comando === '!ping') {
            message.reply('pong!');
            return;
        }

        // Comando 'quiero stickers de'
        if (comando.startsWith('quiero stickers de')) {
            const palabrasClave = comando.replace('quiero stickers de', '').trim();
            if (palabrasClave) {
                const resultados = buscarStickersPorPalabrasClave(palabrasClave);

                if (resultados.length > 0) {
                    message.reply(`Encontré los siguientes stickers:\n${resultados.join('\n')}`);

                    // Enviar stickers uno por uno
                    for (const stickerFile of resultados) {
                        enviarSticker(stickerFile, message);
                    }
                } else {
                    message.reply('No encontré stickers para esas palabras clave.');
                }
            } else {
                message.reply('Por favor incluye palabras clave después de "quiero stickers de".');
            }
        }
    }
});

// Funciones auxiliares
// ================================================
// Buscar stickers por palabras clave
function buscarStickersPorPalabrasClave(palabrasClave) {
    const palabras = palabrasClave.toLowerCase().split(' ');
    const resultados = [];

    // Buscar en el stickersData
    for (const [stickerFile, tags] of Object.entries(stickersData)) {
        if (tags.some(tag => palabras.some(palabra => palabra === tag.toLowerCase()))) {
            resultados.push(stickerFile);
        }
    }
    return resultados;
}

// Enviar un sticker específico
function enviarSticker(stickerFile, message) {
    const stickerPath = path.join(__dirname, '..', 'media', 'stickers', stickerFile);

    if (!fs.existsSync(stickerPath)) {
        console.error(`Sticker file not found: ${stickerPath}`);
        message.reply(`No se encontró el archivo del sticker: ${stickerFile}`);
        return;
    }

    try {
        const stickerData = fs.readFileSync(stickerPath).toString('base64');
        const sticker = new MessageMedia('image/webp', stickerData);
        message.reply(sticker, undefined, { sendMediaAsSticker: true });
    } catch (error) {
        console.error(`Error al enviar el sticker: ${stickerFile}`, error);
        message.reply(`Hubo un error al enviar el sticker: ${stickerFile}`);
    }
}

// Iniciar cliente
client.initialize();
