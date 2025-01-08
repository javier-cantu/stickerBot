// sb016_seleccion_multiple_enumerados.js
// quiero que salga la lista y durante un tiempo pueda mandar varios numeros para pedir varios mensajes de esa lista. 

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

// Inicializar cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
});

// Variable para guardar data de los stickers
let stickersData = {};
// Variable para guardar las solicitudes
const solicitudesStickers = new Map();

// Generar QR para escanear
client.on('qr', (qr) => {
    console.log('\nScan this QR code to log in:\n');
    qrcode.generate(qr, { small: true });
});

// Cuando el cliente está listo
client.on('ready', () => {
    console.log('The bot is ready!');

    // Cargar data de stickers.json
    cargarStickersData();
});

// Función para cargar el archivo JSON de stickers
function cargarStickersData() {
    const stickersPath = path.join(__dirname, '..', 'media', 'stickers', 'stickers.json');
    const startTime = Date.now(); // Tiempo de inicio
    console.log('Inicio de carga del archivo stickers.json:', new Date(startTime).toLocaleString());

    if (fs.existsSync(stickersPath)) {
        const rawData = fs.readFileSync(stickersPath);
        stickersData = JSON.parse(rawData);

        const endTime = Date.now(); // Tiempo final
        console.log('Stickers data loaded:', stickersData);
        console.log('Fin de carga del archivo stickers.json:', new Date(endTime).toLocaleString());
        console.log(`Tiempo total de carga: ${(endTime - startTime) / 1000} segundos.`);
    } else {
        console.log('No stickers.json file found.');
    }
}

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
            solicitudesStickers.delete(message.from); // Limpiar selección anterior si el usuario usa otro comando
            message.reply('pong!');
            return;
        }

        // Comando '!refresh' para recargar stickers.json
        if (comando === '!refresh') {
            solicitudesStickers.delete(message.from); // Limpiar selección anterior si el usuario usa otro comando
            try {
                cargarStickersData();
                message.reply('Stickers recargados exitosamente.');
            } catch (error) {
                console.error('Error al recargar stickers.json:', error);
                message.reply('Error al recargar stickers.json.');
            }
            return;
        }

        // Comando 'mandame stickers de'
        if (comando.startsWith('mandame stickers de')) {
            solicitudesStickers.delete(message.from); // Limpiar selección anterior si el usuario usa otro comando
            const palabrasClave = comando.replace('mandame stickers de', '').trim();
            if (palabrasClave) {
                const startTime = Date.now(); // Tiempo de inicio de búsqueda
                console.log('Ejecutando comando: mandame stickers de');
                console.log('Palabras clave ingresadas:', palabrasClave);

                const resultados = buscarStickersPorPalabrasClave(palabrasClave);

                const endTime = Date.now(); // Tiempo final de búsqueda
                console.log('Tiempo de inicio de búsqueda:', new Date(startTime).toLocaleString());
                console.log('Tiempo de finalización de búsqueda:', new Date(endTime).toLocaleString());
                console.log(`Duración de la búsqueda: ${(endTime - startTime) / 1000} segundos.`);

                if (resultados.length > 0) {
                    // Si hay más de 5 resultados, seleccionar 5 aleatorios
                    const resultadosAMostrar = resultados.length > 5
                        ? resultados.sort(() => Math.random() - 0.5).slice(0, 5)
                        : resultados;

                    // Enumerar la lista de resultados
                    const listaEnumerada = resultados
                        .map((sticker, index) => `${index + 1}. ${sticker}`)
                        .join('\n');

                    // Responder con la lista enumerada y el mensaje
                    if (resultados.length > 5) {
                        message.reply(
                            `Encontré ${resultados.length} stickers con esas palabras clave y te mando 5 aleatorios:\n${listaEnumerada}`
                        );
                    } else {
                        message.reply(
                            `Encontré ${resultados.length} stickers con esas palabras clave y te mando todos:\n${listaEnumerada}`
                        );
                    }

                    // Enviar stickers aleatorios uno por uno con un retraso de 1 segundo entre cada envío
                    for (const stickerFile of resultadosAMostrar) {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa de 1 segundo
                        enviarSticker(stickerFile, message);
                    }
                } else {
                    message.reply('No encontré stickers para esas palabras clave.');
                }
            } else {
                message.reply('Por favor incluye palabras clave después de "mandame stickers de".');
            }
        }

        // Comando 'quiero stickers de'
        if (comando.startsWith('quiero stickers de')) {
            solicitudesStickers.delete(message.from); // Limpiar selección anterior si el usuario usa otro comando
            const palabrasClave = comando.replace('quiero stickers de', '').trim();
            if (palabrasClave) {
                const resultados = buscarStickersPorPalabrasClave(palabrasClave);
                if (resultados.length > 0) {
                    const listaEnumerada = resultados.map((sticker, index) => `${index + 1}. ${sticker}`).join('\n');
                    message.reply(`Estos son todos los stickers que encontré con esas palabras clave:\n\n${listaEnumerada}`);
                    solicitudesStickers.set(message.from, { resultados, mensajeOriginal: message });
                    setTimeout(() => {
                        solicitudesStickers.delete(message.from);
                        console.log(`Selección de stickers eliminada para ${message.from} por inactividad.`);
                    }, 60000); // 1 minuto
                } else {
                    message.reply('No encontré stickers para esas palabras clave.');
                }
            } else {
                message.reply('Por favor incluye palabras clave después de "quiero stickers de".');
            }
        }

        if (/^\d+$/.test(comando)) {
            const solicitud = solicitudesStickers.get(message.from);
            if (solicitud) {
                const numero = parseInt(comando, 10);
                if (numero >= 1 && numero <= solicitud.resultados.length) {
                    const stickerSeleccionado = solicitud.resultados[numero - 1];
                    message.reply(`Enviando sticker: ${stickerSeleccionado}`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    enviarSticker(stickerSeleccionado, message);
                    // No borrar la soliciud inmediatemente, mantenerla activa
                } else {
                    message.reply('Ese número no es válido. Por favor elige un número de la lista.');
                }
            }
        }
    }
});














// Funciones auxiliares
// ================================================
// Buscar stickers por palabras clave
function buscarStickersPorPalabrasClave(palabrasClave) {
    const palabras = palabrasClave.toLowerCase().split(' ');
    const palabrasIncluidas = palabras.filter(palabra => !palabra.startsWith('!'));
    const palabrasExcluidas = palabras.filter(palabra => palabra.startsWith('!')).map(palabra => palabra.slice(1));

    console.log('Palabras clave incluidas:', palabrasIncluidas);
    console.log('Palabras clave excluidas:', palabrasExcluidas);

    const resultados = [];

    // Buscar en el stickersData
    for (const [stickerFile, tags] of Object.entries(stickersData)) {
        const tagsLower = tags.map(tag => tag.toLowerCase());

        // Verificar que cumpla con las palabras incluidas y no tenga ninguna palabra excluida
        if (
            palabrasIncluidas.every(palabra => tagsLower.includes(palabra)) &&
            palabrasExcluidas.every(palabra => !tagsLower.includes(palabra))
        ) {
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
