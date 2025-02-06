// sb021_comandoCategorias.js
// ahora quiero que se puedan pedir categorias 

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
// Mapa para almacenar usuarios que han solicitado la lista de categorías
const solicitudesCategorias = new Map();
// Mapa para almacenar usuarios que han solicitado stickers dentro de una categoría
const solicitudesStickersPorCategoria = new Map();


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


// Responder a un mensaje simple de cualquier usuario
client.on('message', async (message) => {
    const comando = message.body.toLowerCase().trim();
    if (comando === '!ping') return manejarPing(message);
    if (comando.startsWith('/stickers')) {
        const palabrasClave = comando.replace('/stickers', '').trim();
        if (!palabrasClave) return message.reply('Debes proporcionar al menos una palabra clave después de /stickers.');
        return manejarQuieroStickers(message, palabrasClave);
    }
    if (comando === '/categorias') return manejarCategorias(message);     
    if (/^\d+$/.test(comando)) {
        return manejarSeleccionNumericaGeneral(message, parseInt(comando, 10));
    }
});

// Responde a los mensajes del host
client.on('message_create', async (message) => {
    if (message.fromMe) {
        const comando = message.body.toLowerCase().trim();
        if (comando === '!ping') return manejarPing(message);
        if (comando === '!refresh') return manejarRefresh(message);
        if (comando.startsWith('/stickers')) {
            const palabrasClave = comando.replace('/stickers', '').trim();
            if (!palabrasClave) return message.reply('Debes proporcionar al menos una palabra clave después de /stickers.');
            return manejarQuieroStickers(message, palabrasClave);
        }
        if (comando === '/categorias') return manejarCategorias(message);     
        if (/^\d+$/.test(comando)) {
            return manejarSeleccionNumericaGeneral(message, parseInt(comando, 10));
        }
    }
});































// ================================================
// Funciones auxiliares
// ================================================

/**
 * Carga el archivo JSON de stickers y lo almacena en la variable `stickersData`.
 * 
 * 🔹 **Entrada:** No recibe parámetros.
 * 🔹 **Salida:** No retorna valores, pero actualiza la variable global `stickersData`.
 * 
 * 📌 **Descripción:**
 * - Lee el archivo `stickers.json` desde el directorio `media/stickers/`.
 * - Convierte su contenido en un objeto JSON y lo almacena en `stickersData`.
 * - Muestra en consola información sobre el tiempo de carga y los stickers cargados.
 * - Si el archivo no existe, imprime un mensaje de error en la consola.
 */
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


/**
 * Normaliza un texto eliminando acentos y diacríticos.
 * 
 * 🔹 **Entrada:** 
 *   - `texto` *(string)*: Texto que se desea normalizar.
 * 
 * 🔹 **Salida:** 
 *   - *(string)*: Texto en minúsculas sin acentos ni caracteres especiales.
 * 
 * 📌 **Descripción:**
 * - Convierte el texto a su forma descompuesta (`NFD`).
 * - Usa `replace(/[\u0300-\u036f]/g, "")` para eliminar los caracteres diacríticos.
 * - Retorna el texto normalizado sin alterar su estructura.
 * 
 * ⚠ **Nota:**
 * - No cambia el significado de las palabras, solo facilita la comparación sin acentos.
 */
function normalizarTexto(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}


/**
 * Busca stickers que coincidan con las palabras clave proporcionadas, ignorando acentos.
 * 
 * 🔹 **Entrada:** 
 *   - `palabrasClave` *(string)*: Texto ingresado por el usuario con palabras clave separadas por espacios.
 * 
 * 🔹 **Salida:** 
 *   - *(Array de strings)*: Lista de nombres de archivos de stickers que coinciden con las palabras clave.
 * 
 * 📌 **Descripción:**
 * - Convierte las palabras clave a minúsculas y las normaliza eliminando acentos.
 * - Filtra palabras excluidas (prefijadas con `!`) y palabras incluidas.
 * - Normaliza las etiquetas de los stickers antes de compararlas.
 * - Busca en `stickersData` los stickers que contienen todas las palabras incluidas y ninguna de las excluidas.
 * - Retorna una lista de nombres de archivos de stickers que coinciden con los criterios.
 * 
 * ⚠ **Nota:**
 * - Si no hay coincidencias, retorna un array vacío.
 * - La comparación es insensible a los acentos pero sigue respetando las etiquetas definidas en `stickers.json`.
 */
function buscarStickersPorPalabrasClave(palabrasClave) {
    // Normalizar las palabras clave del usuario
    const palabras = normalizarTexto(palabrasClave.toLowerCase()).split(' ');
    const palabrasIncluidas = palabras.filter(palabra => !palabra.startsWith('!'));
    const palabrasExcluidas = palabras.filter(palabra => palabra.startsWith('!')).map(palabra => palabra.slice(1));

    console.log('Palabras clave incluidas:', palabrasIncluidas);
    console.log('Palabras clave excluidas:', palabrasExcluidas);

    const resultados = [];

    // Buscar en el stickersData
    for (const [stickerFile, tags] of Object.entries(stickersData)) {
        // Normalizar las etiquetas de los stickers
        const tagsNormalizados = tags.map(tag => normalizarTexto(tag.toLowerCase()));

        // Verificar que cumpla con las palabras incluidas y no tenga ninguna palabra excluida
        if (
            palabrasIncluidas.every(palabra => tagsNormalizados.includes(palabra)) &&
            palabrasExcluidas.every(palabra => !tagsNormalizados.includes(palabra))
        ) {
            resultados.push(stickerFile);
        }
    }
    return resultados;
}


/**
 * Envía un sticker específico al usuario en WhatsApp.
 * 
 * 🔹 **Entrada:** 
 *   - `stickerFile` *(string)*: Nombre del archivo del sticker (incluyendo su extensión).
 *   - `message` *(object)*: Objeto del mensaje de WhatsApp al cual se responderá con el sticker.
 * 
 * 🔹 **Salida:** 
 *   - No retorna valores, pero envía un sticker como respuesta al mensaje del usuario.
 * 
 * 📌 **Descripción:**
 * - Construye la ruta absoluta del sticker en el directorio `media/stickers/`.
 * - Verifica si el archivo del sticker existe antes de intentar enviarlo.
 * - Si el archivo no existe, responde al usuario con un mensaje de error.
 * - Si el archivo existe, lo lee en base64 y lo convierte en un objeto `MessageMedia` para enviarlo como sticker.
 * - Maneja posibles errores en la lectura o envío del archivo y notifica al usuario en caso de fallo.
 * 
 * ⚠ **Nota:**
 * - El archivo debe estar en formato `webp` y ubicado en `media/stickers/`.
 * - Si el sticker no se encuentra o hay un error, el bot responde con un mensaje en texto en lugar de quedarse en silencio.
 */
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



// ================================================
// Funciones para los comandos:
// ================================================
/**
 * Responde con "pong!" cuando se recibe el comando "!ping".
 * 
 * 🔹 **Entrada:** 
 *   - `message` *(object)*: Objeto del mensaje de WhatsApp que contiene la información del usuario y el chat.
 * 
 * 🔹 **Salida:** 
 *   - No retorna valores, pero envía una respuesta de texto con "pong!" al usuario.
 * 
 * 📌 **Descripción:**
 * - Elimina cualquier selección avctia en `solicitudesStickers` para reiniciar la sesión del usuario.
 * - Responde al mensaje con el texto `"pong!"`, útil para verificar si el bot está en línea.
 * 
 * ⚠ **Nota:**
 * - Este comando es accesible tanto para el host como para otros usuarios.
 * - Se usa generalmente como prueba de conectividad o respuesta rápida del bot.
 */
function manejarPing(message) {
    solicitudesStickers.delete(message.from);
    message.reply('pong!');
}


/**
 * Recarga el archivo JSON de stickers y elimina cualquier selección activa del usuario.
 * 
 * 🔹 **Entrada:** 
 *   - `message` *(object)*: Objeto del mensaje de WhatsApp que contiene la información del usuario y el chat.
 * 
 * 🔹 **Salida:** 
 *   - No retorna valores, pero envía un mensaje de confirmación o error al usuario.
 * 
 * 📌 **Descripción:**
 * - Elimina cualquier selección activa en `solicitudesStickers`, asegurando que los usuarios no mantengan una selección obsoleta.
 * - Llama a la función `cargarStickersData()` para volver a leer y actualizar la data de stickers desde `stickers.json`.
 * - Si la recarga es exitosa, responde al usuario con `"Stickers recargados exitosamente."`.
 * - Si ocurre un error al leer el archivo, captura la excepción y notifica al usuario con `"Error al recargar stickers.json."`.
 * 
 * ⚠ **Nota:**
 * - Solo el host puede ejecutar este comando (`!refresh`).
 * - Se recomienda usarlo después de agregar o modificar stickers en `stickers.json`.
 */
function manejarRefresh(message) {
    solicitudesStickers.delete(message.from);
    try {
        cargarStickersData();
        message.reply('Stickers recargados exitosamente.');
    } catch (error) {
        console.error('Error al recargar stickers.json:', error);
        message.reply('Error al recargar stickers.json.');
    }
}





/**
 * Busca stickers según palabras clave y permite al usuario seleccionar uno enviando un número.
 * 
 * 🔹 **Entrada:** 
 *   - `message` *(object)*: Objeto del mensaje de WhatsApp que contiene la información del usuario y el chat.
 *   - `comando` *(string)*: Texto del mensaje enviado por el usuario, incluyendo el comando y las palabras clave.
 * 
 * 🔹 **Salida:** 
 *   - No retorna valores, pero responde con una lista numerada de stickers encontrados y guarda la selección para permitir la elección posterior.
 * 
 * 📌 **Descripción:**
 * - Elimina cualquier selección activa en `solicitudesStickers` antes de procesar el nuevo comando.
 * - Extrae las palabras clave eliminando el prefijo `"quiero stickers de"`.
 * - Si el usuario no proporciona palabras clave, responde con un mensaje de error.
 * - Llama a `buscarStickersPorPalabrasClave(palabrasClave)` para encontrar stickers que coincidan con la búsqueda.
 * - Si hay resultados:
 *   - Genera y envía una lista numerada de los stickers encontrados.
 *   - Guarda la selección en `solicitudesStickers` para que el usuario pueda elegir un sticker enviando un número.
 *   - Establece un temporizador de 60 segundos, tras el cual la selección se elimina automáticamente si el usuario no elige un número.
 * - Si no hay resultados, responde con `"No encontré stickers para esas palabras clave."`.
 * 
 * ⚠ **Nota:**
 * - Este comando está disponible tanto para el host como para otros usuarios.
 * - A diferencia de `"mandame stickers de"`, este comando permite al usuario elegir un sticker en lugar de recibir varios automáticamente.
 * - La selección expira después de 60 segundos si el usuario no responde con un número válido.
 */
function manejarQuieroStickers(message, comando) {
    solicitudesStickers.delete(message.from);
    const palabrasClave = comando.replace('quiero stickers de', '').trim();
    if (!palabrasClave) {
        return message.reply('Por favor incluye palabras clave después de "quiero stickers de".');
    }
    const resultados = buscarStickersPorPalabrasClave(palabrasClave);
    if (resultados.length > 0) {
        const listaEnumerada = resultados.map((sticker, index) => `${index + 1}. ${sticker}`).join('\n');
        message.reply(`Estos son todos los stickers que encontré con esas palabras clave:\n\n${listaEnumerada}`);
        solicitudesStickers.set(message.from, { resultados, mensajeOriginal: message });
        setTimeout(() => {
            solicitudesStickers.delete(message.from);
            console.log(`Selección de stickers eliminada para ${message.from} por inactividad.`);
        }, 60000);
    } else {
        message.reply('No encontré stickers para esas palabras clave.');
    }
}


/**
 * Envía un sticker basado en la selección numerada realizada por el usuario.
 * 
 * 🔹 **Entrada:** 
 *   - `message` *(object)*: Objeto del mensaje de WhatsApp que contiene la información del usuario y el chat.
 *   - `numero` *(number)*: Número enviado por el usuario para seleccionar un sticker de la lista previamente mostrada.
 * 
 * 🔹 **Salida:** 
 *   - No retorna valores, pero envía el sticker seleccionado como respuesta al usuario.
 * 
 * 📌 **Descripción:**
 * - Verifica si el usuario tiene una selección activa en `solicitudesStickers`.
 * - Si el usuario **no tiene una selección activa**, la función simplemente **ignora el mensaje** y no responde.
 * - Si el número enviado por el usuario está dentro del rango válido:
 *   - Obtiene el sticker correspondiente de la lista previamente mostrada.
 *   - Envía un mensaje confirmando el envío del sticker.
 *   - Espera brevemente y luego envía el sticker seleccionado.
 * - Si el número está fuera del rango, **no responde**, ya que la validación ocurre antes de la llamada a la función.
 * 
 * ⚠ **Nota:**
 * - Esta función solo se ejecuta si el usuario ha usado `"quiero stickers de"` y aún tiene una selección activa.
 * - No responde si el usuario manda un número sin haber solicitado stickers previamente.
 * - El sticker se envía con un retraso de 500 ms para mejorar la experiencia de usuario y evitar bloqueos en WhatsApp.
 */ 
function manejarSeleccionNumerica(message, numero) {
    const solicitud = solicitudesStickers.get(message.from);
    if (!solicitud) return; // Ignorar si no hay una selección activa

    if (numero >= 1 && numero <= solicitud.resultados.length) {
        const stickerSeleccionado = solicitud.resultados[numero - 1];
        message.reply(`Enviando sticker: ${stickerSeleccionado}`);
        setTimeout(() => enviarSticker(stickerSeleccionado, message), 500);
    } 
}


/**
 * Obtiene la lista de categorías disponibles en el directorio `stickers_categorias/`.
 * 
 * 🔹 **Entrada:** No recibe parámetros.
 * 🔹 **Salida:** *(Array de strings)* Lista de nombres de las categorías encontradas.
 * 
 * 📌 **Descripción:**
 * - Verifica la existencia del directorio `stickers_categorias/`.
 * - Obtiene los nombres de las carpetas dentro de este directorio.
 * - Retorna un array con los nombres de las categorías encontradas.
 * - Si el directorio no existe o está vacío, retorna un array vacío.
 */
function listarCategorias() {
    const categoriasPath = path.join(__dirname, '..', 'media', 'stickers_categorias');
    if (!fs.existsSync(categoriasPath)) {
        console.log("❌ Directorio no encontrado:", categoriasPath);
        return [];
    }

    const categorias = fs.readdirSync(categoriasPath).filter(nombre => 
        fs.statSync(path.join(categoriasPath, nombre)).isDirectory()
    );

    console.log("📂 Categorías encontradas:", categorias);
    return categorias;
}



/**
 * Maneja el comando `/categorias`, enviando la lista de categorías disponibles al usuario.
 * 
 * 🔹 **Entrada:** 
 *   - `message` *(object)*: Objeto del mensaje de WhatsApp recibido.
 * 
 * 🔹 **Salida:** No retorna valores, pero responde al usuario con una lista de categorías.
 * 
 * 📌 **Descripción:**
 * - Llama a `listarCategorias()` para obtener la lista de categorías disponibles.
 * - Si hay categorías, las envía numeradas al usuario.
 * - Guarda la solicitud en `solicitudesCategorias` para rastrear la selección del usuario.
 * - Configura un temporizador de 60 segundos para eliminar la solicitud si el usuario no responde.
 */
function manejarCategorias(message) {
    const categorias = listarCategorias();
    if (categorias.length === 0) {
        return message.reply('No hay categorías disponibles en este momento.');
    }

    const listaEnumerada = categorias.map((cat, index) => `${index + 1}. ${cat}`).join('\n');
    message.reply(`Categorías disponibles:\n\n${listaEnumerada}\n\n*Tienes 60 segundos para elegir una categoría, si no deberás empezar de nuevo.*`);

    solicitudesCategorias.set(message.from, { categorias });

    setTimeout(() => {
        solicitudesCategorias.delete(message.from);
    }, 60000);
}



/**
 * Maneja la selección de números según el estado del usuario.
 * 
 * 🔹 **Entrada:** 
 *   - `message` *(object)*: Objeto del mensaje de WhatsApp recibido.
 *   - `numero` *(number)*: Número enviado por el usuario.
 * 
 * 🔹 **Salida:** No retorna valores, pero ejecuta la función correspondiente según el contexto.
 * 
 * 📌 **Descripción:**
 * - Verifica si el usuario está en la selección de categorías y maneja la selección de categoría.
 * - Verifica si el usuario está en la selección de stickers dentro de una categoría y maneja la selección de stickers.
 * - Si el usuario no está en ninguna de estas selecciones, maneja la selección de stickers estándar (`/stickers`).
 */
function manejarSeleccionNumericaGeneral(message, numero) {
    if (solicitudesCategorias.has(message.from)) {
        return manejarSeleccionCategoria(message, numero);
    }

    if (solicitudesStickersPorCategoria.has(message.from)) {
        return manejarSeleccionStickerPorCategoria(message, numero);
    }

    return manejarSeleccionNumerica(message, numero);
}




/**
 * Obtiene la lista de stickers dentro de una categoría seleccionada.
 * 
 * 🔹 **Entrada:** 
 *   - `categoria` *(string)*: Nombre de la categoría seleccionada.
 * 
 * 🔹 **Salida:** *(Array de strings)* Lista de nombres de stickers sin la extensión `.webp`.
 * 
 * 📌 **Descripción:**
 * - Verifica la existencia del directorio de la categoría.
 * - Obtiene los nombres de los archivos dentro de la carpeta.
 * - Filtra solo los archivos con extensión `.webp` y elimina la extensión antes de retornarlos.
 * - Si la categoría no existe o no tiene stickers, retorna un array vacío.
 */
function listarStickersPorCategoria(categoria) {
    const categoriaPath = path.join(__dirname, '..', 'media', 'stickers_categorias', categoria);
    if (!fs.existsSync(categoriaPath)) {
        console.log("❌ Directorio no encontrado:", categoriaPath);
        return [];
    }

    return fs.readdirSync(categoriaPath)
        .filter(nombre => nombre.endsWith('.webp'))
        .map(nombre => nombre.replace('.webp', ''));
}




/**
 * Maneja la selección de una categoría por parte del usuario.
 * 
 * 🔹 **Entrada:** 
 *   - `message` *(object)*: Objeto del mensaje de WhatsApp recibido.
 *   - `numero` *(number)*: Número enviado por el usuario para seleccionar una categoría.
 * 
 * 🔹 **Salida:** No retorna valores, pero responde al usuario con la lista de stickers en la categoría seleccionada.
 * 
 * 📌 **Descripción:**
 * - Verifica si el usuario tiene una solicitud activa en `solicitudesCategorias`.
 * - Obtiene la categoría correspondiente según el número enviado.
 * - Llama a `listarStickersPorCategoria()` para obtener los stickers en la categoría seleccionada.
 * - Si hay stickers, envía la lista numerada al usuario y guarda la solicitud en `solicitudesStickersPorCategoria`.
 * - Si no hay stickers en la categoría, informa al usuario y elimina su solicitud.
 * - Configura un temporizador de 60 segundos para eliminar la solicitud si el usuario no responde.
 */
function manejarSeleccionCategoria(message, numero) {
    const solicitud = solicitudesCategorias.get(message.from);
    if (!solicitud || numero < 1 || numero > solicitud.categorias.length) return;

    const categoriaSeleccionada = solicitud.categorias[numero - 1];
    const stickers = listarStickersPorCategoria(categoriaSeleccionada);

    solicitudesCategorias.delete(message.from);

    if (stickers.length === 0) {
        return message.reply(`La categoría *${categoriaSeleccionada}* no tiene stickers disponibles.`);
    }

    const listaEnumerada = stickers.map((sticker, index) => `${index + 1}. ${sticker}`).join('\n');
    message.reply(`Stickers en *${categoriaSeleccionada}*:\n\n${listaEnumerada}\n\n*Tienes 60 segundos para pedir los stickers de la lista, si no deberás empezar de nuevo.*`);

    solicitudesStickersPorCategoria.set(message.from, { categoria: categoriaSeleccionada, stickers });

    setTimeout(() => {
        solicitudesStickersPorCategoria.delete(message.from);
    }, 60000);
}




/**
 * Maneja la selección de un sticker dentro de una categoría por parte del usuario.
 * 
 * 🔹 **Entrada:** 
 *   - `message` *(object)*: Objeto del mensaje de WhatsApp recibido.
 *   - `numero` *(number)*: Número enviado por el usuario para seleccionar un sticker.
 * 
 * 🔹 **Salida:** No retorna valores, pero envía el sticker seleccionado al usuario.
 * 
 * 📌 **Descripción:**
 * - Verifica si el usuario tiene una solicitud activa en `solicitudesStickersPorCategoria`.
 * - Obtiene el sticker correspondiente según el número enviado.
 * - Si el número es válido, llama a `enviarSticker()` para enviarlo.
 * - La solicitud no se elimina inmediatamente, permitiendo que el usuario pida más stickers dentro del tiempo límite.
 */
function manejarSeleccionStickerPorCategoria(message, numero) {
    const solicitud = solicitudesStickersPorCategoria.get(message.from);
    if (!solicitud || numero < 1 || numero > solicitud.stickers.length) return;

    const stickerSeleccionado = solicitud.stickers[numero - 1] + '.webp';
    enviarStickerDesdeCategoria(stickerSeleccionado, solicitud.categoria, message);
}







/**
 * Envía un sticker desde una categoría específica al usuario en WhatsApp.
 * 
 * 🔹 **Entrada:** 
 *   - `stickerFile` *(string)*: Nombre del archivo del sticker (incluyendo su extensión).
 *   - `categoria` *(string)*: Nombre de la categoría en la que se encuentra el sticker.
 *   - `message` *(object)*: Objeto del mensaje de WhatsApp al cual se responderá con el sticker.
 * 
 * 🔹 **Salida:** 
 *   - No retorna valores, pero envía un sticker como respuesta al mensaje del usuario.
 * 
 * 📌 **Descripción:**
 * - Construye la ruta del sticker en `media/stickers_categorias/{categoria}/`.
 * - Verifica si el archivo del sticker existe antes de enviarlo.
 * - Convierte el sticker en base64 y lo envía como `MessageMedia`.
 * - Maneja posibles errores y notifica al usuario en caso de fallo.
 */
function enviarStickerDesdeCategoria(stickerFile, categoria, message) {
    const stickerPath = path.join(__dirname, '..', 'media', 'stickers_categorias', categoria, stickerFile);

    if (!fs.existsSync(stickerPath)) {
        console.error(`❌ Sticker no encontrado: ${stickerPath}`);
        message.reply(`No se encontró el sticker: ${stickerFile} en la categoría ${categoria}.`);
        return;
    }

    try {
        const stickerData = fs.readFileSync(stickerPath).toString('base64');
        const sticker = new MessageMedia('image/webp', stickerData);
        message.reply(sticker, undefined, { sendMediaAsSticker: true });
    } catch (error) {
        console.error(`⚠ Error al enviar el sticker desde la categoría ${categoria}: ${stickerFile}`, error);
        message.reply(`Hubo un error al enviar el sticker: ${stickerFile}.`);
    }
}



// Iniciar cliente
client.initialize();