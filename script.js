// --- Variables Globales y Selectores ---
const qrCodeRegionId = "reader";
let html5QrcodeScanner = null; // Se inicializará en window.onload
let isScannerRunning = false;
let current = { service: null, id: null, iframe: null }; 

const $ = (sel) => document.querySelector(sel);
const scannerView = $('#scanner-view');
const gameView = $('#game-view');
const errorBox = $('#error-box'); 
const readerElement = $('#reader');
const urlInput = $('#urlInput'); // Aunque no lo uses, lo dejamos por si acaso
const playerContainer = $('#player-container');
const iframeWrapper = $('#iframe-wrapper');
// const statusText = $('#status-text'); // Eliminado
const playButton = $('#play-button');
const revealButton = $('#reveal-button');

// --- Funciones de Utilidad ---
function displayError(message) { // Solo para errores
    errorBox.textContent = message;
    if (!message) { errorBox.classList.add('hidden'); return; }
    errorBox.classList.remove('hidden'); 
    setTimeout(() => errorBox.classList.add('hidden'), 3500); // Dar un poco más de tiempo
}

function switchView(viewName) {
    console.log(`Switching view to: ${viewName}`); 
    if (viewName === 'scanner') {
        gameView.classList.add('hidden');
        scannerView.classList.remove('hidden');
        displayError(''); 
        current = { service: null, id: null, iframe: null };
        iframeWrapper.innerHTML = ''; 
        iframeWrapper.classList.remove('revealed'); 
        // statusText ya no existe
        playButton.classList.remove('hidden');
        revealButton.classList.add('hidden');
        revealButton.disabled = false; 
        revealButton.textContent = "🔎 Revelar Video"; 
        // Estilo botón Play siempre rojo (YouTube)
        playButton.classList.remove('bg-green-500', 'border-green-700'); 
        playButton.classList.add('bg-red-600', 'border-red-800', 'text-white'); 
        playButton.innerHTML = '▶️ DALE PLAY 🎶'; 
        urlInput.value = ''; 
        // Intentar iniciar scanner DESPUÉS de que la vista sea visible
        // Usamos setTimeout para dar tiempo al navegador a renderizar
        setTimeout(startScanner, 100); 

    } else if (viewName === 'game') {
        scannerView.classList.add('hidden');
        gameView.classList.remove('hidden');
        stopScanner(); // Detener cámara al cambiar a juego
        // Estilo botón Play siempre rojo
        playButton.classList.remove('bg-green-500', 'border-green-700'); 
        playButton.classList.add('bg-red-600', 'border-red-800', 'text-white');
        // statusText ya no existe
        playButton.innerHTML = '▶️ DALE PLAY 🎶'; 
        playButton.classList.remove('hidden'); 
        revealButton.classList.add('hidden'); 
        iframeWrapper.classList.remove('revealed'); 
    }
}

// --- Lógica del Escáner ---
function onScanSuccess(decodedText, decodedResult) {
    console.log("Scan successful:", decodedText); 
    // Detener ANTES de procesar
    stopScanner(); 
    
    // Pequeña pausa antes de procesar y cambiar vista (puede ayudar a la transición)
    setTimeout(() => {
        const parsed = parseService(decodedText); 
        if (parsed.service === 'youtube' || parsed.service === 'youtubemusic') { 
            current = { ...parsed, iframe: null }; 
            // Ya no mostramos mensaje de éxito aquí
            switchView('game'); 
        } else {
            displayError(`QR no válido. Solo YouTube.`); 
            // Reintentar scan MÁS TARDE si falla
            setTimeout(startScanner, 2500); 
        }
    }, 100); // 100ms de pausa
}

function onScanFailure(error) { /* Silencio, es normal que no encuentre QR */ }

/**
 * startScanner CORREGIDO v22:
 * - Verifica inicialización.
 * - Verifica visibilidad del elemento reader.
 * - Manejo de errores más específico.
 */
function startScanner() {
    // 1. Verificar si el objeto scanner existe
    if (!html5QrcodeScanner) { 
         console.error("Scanner object does not exist. Attempting re-init...");
         // Intentar inicializarlo de nuevo aquí puede ser una opción de recuperación
         if (!initializeScanner()) {
             displayError("Error: Escáner no pudo inicializarse.");
             return; 
         }
         // Si la inicialización tuvo éxito ahora, reintentar startScanner
         setTimeout(startScanner, 50); 
         return;
    }
    // 2. Verificar si el elemento reader está en el DOM y visible
    if (!readerElement || !document.body.contains(readerElement) || readerElement.offsetParent === null) {
        console.warn("Reader element not found or not visible yet."); 
        // Reintentar después de un breve retraso si la vista aún no está lista
        setTimeout(startScanner, 150); 
        return; 
    }
    
    // 3. Verificar si ya está corriendo
    if (isScannerRunning) {
         console.log("Scanner start requested but already running."); 
         return; 
    }

    console.log("Attempting to start scanner..."); 
    // No limpiar innerHTML aquí, dejar que la librería maneje el DOM interno
    // readerElement.innerHTML = ""; 

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    try {
        html5QrcodeScanner.start( 
            { facingMode: "environment" }, 
            config, 
            onScanSuccess, 
            onScanFailure 
        )
        .then(() => { 
            isScannerRunning = true; 
            console.log("Scanner started successfully."); 
            displayError(''); // Limpiar errores si inicia bien
        })
        .catch(err => {
            console.error("Error starting scanner (Promise catch):", err); 
            let errorMsg = "No se pudo iniciar la cámara.";
            // Mensajes más específicos
            if (typeof err === 'string' && err.toLowerCase().includes('permission denied')) {
                 errorMsg = "Permiso de cámara denegado.";
            } else if (err.name === 'NotAllowedError') errorMsg = "Permiso de cámara denegado.";
            else if (err.name === 'NotFoundError') errorMsg = "No se encontró cámara.";
            else if (err.name === 'NotReadableError') errorMsg = "La cámara está en uso.";
            else if (err.message && err.message.includes("Can not start scanning")) {
                 errorMsg = "Error al iniciar escaneo (posible conflicto). Intenta refrescar.";
            }
            displayError(errorMsg); 
            isScannerRunning = false; // Asegurar estado correcto
        });
    } catch (syncError) {
         console.error("Error starting scanner (Sync catch):", syncError); 
         displayError("Error inesperado al iniciar cámara.");
         isScannerRunning = false;
    }
}

/**
 * stopScanner CORREGIDO v22:
 * - Manejo más cuidadoso de errores.
 * - NO limpia innerHTML.
 */
function stopScanner() {
    if (html5QrcodeScanner && isScannerRunning) { 
        console.log("Attempting to stop scanner..."); 
        try {
            // Llamar a stop() devuelve una promesa
            html5QrcodeScanner.stop()
            .then(() => { 
                isScannerRunning = false; 
                console.log("Scanner stopped successfully via Promise."); 
                // NO limpiar readerElement.innerHTML aquí
            })
            .catch((err) => { 
                // Ignorar errores comunes si ya estaba detenido
                if (!err || !err.message || !err.message.toLowerCase().includes("not scanning")) {
                    console.warn("Error stopping scanner (Promise catch):", err); 
                } else { 
                    console.log("Stop called but scanner wasn't running."); 
                }
                isScannerRunning = false; // Forzar estado a detenido
                // NO limpiar readerElement.innerHTML aquí
            });
        } catch (e) { 
            // Capturar errores síncronos (menos común con stop())
            console.error("Exception stopping scanner:", e); 
            isScannerRunning = false; // Forzar estado a detenido
            // NO limpiar readerElement.innerHTML aquí
        }
    } else {
        // Si no estaba corriendo o el objeto no existe, solo asegurar el estado
        isScannerRunning = false; 
        console.log("Stop scanner requested but not running or scanner defunct."); 
    }
}

// --- Cargar URL desde Input (Eliminado, no necesario) ---
// function loadFromInput() { ... } 

// --- Lógica del Juego ---
function parseService(url) { /* Sin cambios */ 
    try { url = url.trim(); let u = null; try { u = new URL(url); } catch (e) {} const host = u ? u.hostname.replace(/^www\./,'').toLowerCase() : ''; if (host.includes('youtube.com') || host === 'youtu.be' || host.includes('music.youtube.com')) { let v = null; if (host === 'youtu.be') { v = u.pathname.slice(1).split('/')[0]; } else if (u) { v = u.searchParams.get('v'); } if (!v && u && u.pathname.startsWith('/shorts/')) { v = u.pathname.split('/')[2] || null; } if (!v && u && u.pathname.startsWith('/embed/')) { v = u.pathname.split('/')[2] || null; } if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return { service: host.includes('music.youtube.com') ? 'youtubemusic' : 'youtube', id: v }; } return { service: null, id: null }; } catch(e) { console.error("Parse URL Error:", url, e); return { service: null, id: null }; }
}
function buildEmbed({ service, id }) { /* Sin cambios */ 
    if (service !== 'youtube' && service !== 'youtubemusic') return null; let src = ''; let title = 'YouTube Player'; let allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture; web-share'; const params = new URLSearchParams({ autoplay: '1', controls: '0', modestbranding: '1', rel: '0', playsinline: '1', enablejsapi: '1' }); try { if (location.origin && location.origin.startsWith('http')) params.set('origin', location.origin); } catch {} src = `https://www.youtube.com/embed/${id}?${params.toString()}`; const iframe = document.createElement('iframe'); iframe.src=src; iframe.title=title; iframe.loading='lazy'; iframe.allow=allow; iframe.allowFullscreen=true; iframe.style.borderRadius='12px'; return iframe;
}
function playSong() { /* Sin cambios */ 
    console.log("playSong called"); if (!current.service || !current.id) { displayError("No hay video cargado."); return; } if (current.service !== 'youtube' && current.service !== 'youtubemusic') { displayError("Servicio no soportado."); return; } const iframe = buildEmbed(current); if (!iframe) { displayError("Error al crear reproductor."); return; } iframeWrapper.innerHTML = ''; iframeWrapper.appendChild(iframe); current.iframe = iframe; playButton.classList.add('hidden'); revealButton.classList.remove('hidden'); statusText.textContent = "Video Sonando..."; displayError(''); setTimeout(() => { if (!current.iframe) return; console.log("Sending 'playVideo' command"); const playMsg = JSON.stringify({ event:'command', func:'playVideo', args:[] }); current.iframe.contentWindow?.postMessage(playMsg, '*'); }, 500); 
}
function revealPlayer() { /* Sin cambios */ 
    console.log("revealPlayer called"); iframeWrapper.classList.add('revealed'); revealButton.textContent = "¡Revelado!"; revealButton.disabled = true; if(current.iframe) current.iframe.focus(); 
}

// --- Inicialización ---
/**
 * initializeScanner CORREGIDO v22: 
 * - Se llama desde window.onload.
 * - Verifica readerElement ANTES de crear Html5Qrcode.
 */
function initializeScanner() {
     console.log("Initializing scanner..."); // DEBUG
     // Verificar si el elemento reader existe en el DOM
     if (!readerElement) {
         console.error("Fatal: Element '#reader' not found in DOM during init.");
         displayError("Error fatal: Contenedor del scanner no encontrado.");
         // Opcional: Ocultar la vista del scanner si no se puede inicializar
         if(scannerView) scannerView.innerHTML = "<p class='text-red-500 text-center'>Error: El componente del escáner no cargó correctamente.</p>";
         return false; // Falló la inicialización
     }
     
     // Solo inicializar si no existe el objeto Y el elemento está listo
     if (!html5QrcodeScanner) { 
         try {
             html5QrcodeScanner = new Html5Qrcode(qrCodeRegionId); 
             console.log("html5QrcodeScanner initialized successfully.");
             return true; // Éxito
         } catch (e) {
              console.error("Fatal: Failed to initialize html5QrcodeScanner instance:", e);
              displayError("Error fatal: No se pudo inicializar el lector QR.");
              if(scannerView) scannerView.innerHTML = "<p class='text-red-500 text-center'>Escáner no disponible.</p>";
              return false; // Falló
         }
     }
      console.log("Scanner already initialized."); // DEBUG
      return true; // Ya estaba inicializado
 }

window.onload = () => { 
     console.log("Window loaded."); 
     if (initializeScanner()) { // Intentar inicializar PRIMERO
         switchView('scanner'); // Mostrar vista scanner SOLO si la inicialización fue exitosa
     } else {
          console.error("Scanner initialization failed. Cannot proceed to scanner view.");
          // El mensaje de error ya se mostró en initializeScanner
     }
};