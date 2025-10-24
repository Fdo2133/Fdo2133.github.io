// --- Variables Globales y Selectores ---
const qrCodeRegionId = "reader";
let html5QrcodeScanner = null; // Se inicializará en window.onload
let isScannerRunning = false;
let current = { service: null, id: null, iframe: null }; // Simplificado, sin 'kind'

const $ = (sel) => document.querySelector(sel);
const scannerView = $('#scanner-view');
const gameView = $('#game-view');
const messageBox = $('#message-box');
const readerElement = $('#reader');
const urlInput = $('#urlInput');
const playerContainer = $('#player-container');
const iframeWrapper = $('#iframe-wrapper');
const statusText = $('#status-text');
const playButton = $('#play-button');
const revealButton = $('#reveal-button');

// --- Funciones de Utilidad ---
function displayMessage(message, type = 'info') {
    messageBox.textContent = message;
    messageBox.classList.remove('hidden', 'bg-red-700', 'bg-green-700', 'bg-blue-500'); // Quitamos verde (Spotify)
    if (!message) { messageBox.classList.add('hidden'); return; }
    messageBox.classList.remove('hidden'); 
    if (type === 'error') { messageBox.classList.add('bg-red-700'); setTimeout(() => messageBox.classList.add('hidden'), 3000); } 
    else if (type === 'youtube') { messageBox.classList.add('bg-red-700'); } // Rojo para YouTube / Éxito YT
    else { messageBox.classList.add('bg-blue-500'); } // Azul para Info
}

function switchView(viewName) {
    console.log(`Switching view to: ${viewName}`); 
    if (viewName === 'scanner') {
        gameView.classList.add('hidden');
        scannerView.classList.remove('hidden');
        displayMessage(''); 
        current = { service: null, id: null, iframe: null };
        iframeWrapper.innerHTML = ''; 
        iframeWrapper.classList.remove('revealed'); 
        statusText.textContent = "Escanea o pega una URL de YouTube"; // Texto actualizado
        playButton.classList.remove('hidden');
        revealButton.classList.add('hidden');
        revealButton.disabled = false; 
        revealButton.textContent = "🔎 Revelar Video"; 
        
        // Botón Play siempre rojo (YouTube)
        playButton.classList.remove('bg-green-500', 'border-green-700'); // Quitar verde
        playButton.classList.add('bg-red-600', 'border-red-800', 'text-white'); // Poner rojo
        playButton.innerHTML = '▶️ Tocar Video'; 
        
        urlInput.value = ''; 
        startScanner(); 

    } else if (viewName === 'game') {
        scannerView.classList.add('hidden');
        gameView.classList.remove('hidden');
        stopScanner(); 

        // Botón Play siempre rojo
        playButton.classList.remove('bg-green-500', 'border-green-700'); 
        playButton.classList.add('bg-red-600', 'border-red-800', 'text-white');
        statusText.textContent = "Video cargado. Presiona Play.";
        playButton.innerHTML = '▶️ Tocar Video'; 
        playButton.classList.remove('hidden'); 
        revealButton.classList.add('hidden'); 
        iframeWrapper.classList.remove('revealed'); 
    }
}

// --- Lógica del Escáner (con html5-qrcode) ---
function onScanSuccess(decodedText, decodedResult) {
    console.log("Scan successful:", decodedText); 
    stopScanner(); 
    const parsed = parseService(decodedText); // Usar parser solo para YT
    
    if (parsed.service === 'youtube' || parsed.service === 'youtubemusic') { // Solo aceptar YT
        current = { ...parsed, iframe: null }; 
        displayMessage(`¡QR de YouTube cargado!`, 'youtube'); 
        switchView('game'); 
    } else {
        displayMessage(`QR no válido. Solo se acepta YouTube.`, "error"); 
        setTimeout(startScanner, 2500); 
    }
}

function onScanFailure(error) { /* Silencio */ }

/**
 * startScanner CORREGIDO:
 * - Se asegura que html5QrcodeScanner esté inicializado.
 * - Elimina la verificación offsetParent que podría fallar.
 * - Llama a start() de forma más directa.
 */
function startScanner() {
    // Si no está inicializado, no hacer nada (debería inicializarse en window.onload)
    if (!html5QrcodeScanner) { 
         console.error("Scanner object not initialized yet.");
         // Reintentar inicialización por si window.onload falló o aún no corre
         initializeScanner(); 
         // Reintentar startScanner después de un momento
          setTimeout(startScanner, 200); 
         return; 
    }

    if (!isScannerRunning) {
        console.log("Attempting to start scanner..."); 
        // Verificar si el elemento reader existe
        if (!readerElement) {
            console.error("Reader element not found!");
            displayMessage("Error: Contenedor del scanner no encontrado.", "error");
            return;
        }
        // Limpiar el contenido previo por si acaso
        readerElement.innerHTML = ""; 

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        // Intenta iniciar la cámara
        html5QrcodeScanner.start( { facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .then(() => { 
            isScannerRunning = true; 
            console.log("Scanner started successfully."); 
            displayMessage(''); // Limpiar mensajes
        })
        .catch(err => {
            console.error("Error starting scanner:", err); 
            let errorMsg = "No se pudo iniciar la cámara.";
            if (err.name === 'NotAllowedError') errorMsg = "Permiso de cámara denegado.";
            else if (err.name === 'NotFoundError') errorMsg = "No se encontró cámara.";
            else if (err.name === 'NotReadableError') errorMsg = "La cámara está en uso.";
            displayMessage(errorMsg, "error");
            isScannerRunning = false; 
            // Opcional: Mostrar un mensaje permanente si la cámara falla gravemente
            // readerElement.innerHTML = `<p class='text-red-500 p-4 text-center'>${errorMsg}</p>`;
        });
    } else {
         console.log("Scanner start requested but already running."); 
    }
}


function stopScanner() {
    if (html5QrcodeScanner && isScannerRunning) { 
        console.log("Attempting to stop scanner..."); 
        try {
            // Guardar el estado actual antes de llamar a stop
            const currentScannerState = typeof html5QrcodeScanner.getState === 'function' ? html5QrcodeScanner.getState() : null;
            // Solo llamar a stop si está realmente escaneando (estado 2)
            // if (currentScannerState === 2 /* SCANNING */ || currentScannerState === 1 /* IDLE, but might have camera active */) {
                html5QrcodeScanner.stop()
                .then(() => { 
                    isScannerRunning = false; 
                    console.log("Scanner stopped successfully."); 
                    if(readerElement) readerElement.innerHTML = ""; 
                })
                .catch((err) => { 
                    // Ignorar errores comunes de "stop called when not scanning"
                    if (!err.message || !err.message.toLowerCase().includes("not scanning")) {
                        console.warn("Error stopping scanner:", err); 
                    } else {
                         console.log("Scanner reported 'not scanning' during stop, likely already stopped.");
                    }
                    isScannerRunning = false; // Asumir detenido
                    if(readerElement) readerElement.innerHTML = ""; 
                });
            // } else {
            //      console.log(`Scanner not stopped because state is ${currentScannerState}`);
            //      isScannerRunning = false; // Sincronizar estado si no estaba escaneando
            //      if(readerElement) readerElement.innerHTML = ""; 
            // }
        } catch (e) { 
            console.error("Exception stopping scanner:", e); 
            isScannerRunning = false; 
            if(readerElement) readerElement.innerHTML = ""; 
        }
    } else {
        isScannerRunning = false; 
        if(readerElement) readerElement.innerHTML = ""; 
    }
}

// --- Cargar URL desde Input ---
function loadFromInput() {
    const url = urlInput.value.trim(); 
    if (!url) { displayMessage("Pega una URL válida de YouTube.", "error"); return; } 
    const parsed = parseService(url); 
    if (parsed.service === 'youtube' || parsed.service === 'youtubemusic') { // Solo aceptar YT
        current = { ...parsed, iframe: null }; 
        displayMessage(`URL de YouTube cargada!`, 'youtube'); 
        switchView('game'); 
    } else { displayMessage("La URL no parece ser de YouTube o YouTube Music.", "error"); }
}

// --- Lógica del Juego ---

/**
 * parseService SIMPLIFICADO: Solo YouTube
 */
function parseService(url) {
    try {
        url = url.trim(); 
        let u = null; 
        try { u = new URL(url); } catch (e) { /* Podría no ser URL estándar */ } 
        const host = u ? u.hostname.replace(/^www\./,'').toLowerCase() : '';

        // YouTube / YT Music
        if (host.includes('youtube.com') || host === 'youtu.be' || host.includes('music.youtube.com')) {
            let v = null; 
            if (host === 'youtu.be') { v = u.pathname.slice(1).split('/')[0]; } 
            else if (u) { v = u.searchParams.get('v'); } // Solo buscar 'v' si 'u' es válido
            
            // Intentar extraer de path si no se encontró 'v'
            if (!v && u && u.pathname.startsWith('/shorts/')) { v = u.pathname.split('/')[2] || null; } 
            if (!v && u && u.pathname.startsWith('/embed/')) { v = u.pathname.split('/')[2] || null; } 
            
            // Validar formato del ID extraído
            if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) { 
               return { service: host.includes('music.youtube.com') ? 'youtubemusic' : 'youtube', id: v };
            }
        }
        
        // Si no es YouTube, retornar null
        return { service: null, id: null };
    } catch(e) { 
        console.error("Parse URL Error:", url, e); 
        return { service: null, id: null }; 
    }
}

/**
 * buildEmbed SIMPLIFICADO: Solo YouTube
 */
function buildEmbed({ service, id }) { // Ya no necesita 'kind'
    if (service !== 'youtube' && service !== 'youtubemusic') return null; // Salir si no es YT

    let src = ''; 
    let title = 'YouTube Player'; 
    let allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture; web-share';
    
    // Parámetros: autoplay=1, controls=0 (ocultos por CSS), enablejsapi=1 (para control)
    const params = new URLSearchParams({ 
        autoplay: '1', 
        controls: '0', 
        modestbranding: '1', 
        rel: '0', 
        playsinline: '1', 
        enablejsapi: '1' 
    });
    // Añadir 'origin' si es posible (ayuda a la API JS)
    try { if (location.origin && location.origin.startsWith('http')) params.set('origin', location.origin); } catch {}
    
    src = `https://www.youtube.com/embed/${id}?${params.toString()}`; 
            
    const iframe = document.createElement('iframe'); 
    iframe.src = src; 
    iframe.title = title; 
    iframe.loading = 'lazy'; 
    iframe.allow = allow; 
    iframe.allowFullscreen = true; 
    iframe.style.borderRadius = '12px'; // Mantener redondeo
    return iframe;
}

/**
 * playSong SIMPLIFICADO: Solo YouTube
 */
function playSong() {
    console.log("playSong called"); 
    if (!current.service || !current.id) { displayMessage("No hay video cargado.", "error"); return; }
    if (current.service !== 'youtube' && current.service !== 'youtubemusic') {
         displayMessage("Servicio no soportado (Solo YouTube).", "error"); return;
    }
    
    const iframe = buildEmbed(current);
    if (!iframe) { displayMessage("Error al crear reproductor.", "error"); return; }
    
    iframeWrapper.innerHTML = ''; 
    iframeWrapper.appendChild(iframe); 
    current.iframe = iframe; 
    
    // Actualizar UI
    playButton.classList.add('hidden');       
    revealButton.classList.remove('hidden');   
    statusText.textContent = "Video Sonando..."; 
    displayMessage(''); // Limpiar mensaje superior

    // --- INTENTO DE PLAY EXPLÍCITO ---
    setTimeout(() => {
        if (!current.iframe) return; 
        console.log("Sending 'playVideo' command to YouTube"); 
        const playMsg = JSON.stringify({ event:'command', func:'playVideo', args:[] });
        current.iframe.contentWindow?.postMessage(playMsg, '*'); 
    }, 500); // Esperar medio segundo
}

/**
 * revealPlayer: Solo revela el iframe (quita clip-path)
 */
function revealPlayer() { 
    console.log("revealPlayer called"); 
    iframeWrapper.classList.add('revealed'); // Muestra el iframe
    revealButton.textContent = "¡Revelado!";
    revealButton.disabled = true;
    if(current.iframe) current.iframe.focus(); // Enfocar por si acaso
}

// --- Inicialización ---

/**
 * Función para inicializar el scanner (se llama en window.onload)
 */
 function initializeScanner() {
     if (!html5QrcodeScanner) { // Solo inicializar una vez
         try {
             if (!readerElement) throw new Error("Element with ID 'reader' not found during init.");
             html5QrcodeScanner = new Html5Qrcode(qrCodeRegionId); 
             console.log("html5QrcodeScanner initialized on load."); // DEBUG
         } catch (e) {
              console.error("Fatal: Failed to initialize html5QrcodeScanner on load:", e);
              displayMessage("Error fatal: No se pudo inicializar el lector QR.", "error");
              if(scannerView) scannerView.innerHTML = "<p class='text-red-500 text-center'>Escáner no disponible.</p>";
         }
     }
 }

window.onload = () => { 
     console.log("Window loaded. Initializing..."); 
     initializeScanner(); // Llamar a la función que inicializa
     switchView('scanner'); // Mostrar vista inicial
};