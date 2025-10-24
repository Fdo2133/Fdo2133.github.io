// --- Variables Globales y Selectores ---
const qrCodeRegionId = "reader";
let html5QrcodeScanner = null; 
let isScannerRunning = false;
let current = { service: null, id: null, iframe: null }; 

const $ = (sel) => document.querySelector(sel);
const scannerView = $('#scanner-view');
const gameView = $('#game-view');
const errorBox = $('#error-box'); 
const readerElement = $('#reader');
const urlInput = $('#urlInput'); 
const playerContainer = $('#player-container');
const iframeWrapper = $('#iframe-wrapper');
// const statusText = $('#status-text'); // Eliminado
const playButton = $('#play-button');
const revealButton = $('#reveal-button');
const scanButton = $('#scan-button'); // <<< NUEVO SELECTOR

// --- Funciones de Utilidad ---
function displayError(message) { /* Sin cambios */ 
    errorBox.textContent = message; if (!message) { errorBox.classList.add('hidden'); return; }
    errorBox.classList.remove('hidden'); setTimeout(() => errorBox.classList.add('hidden'), 3500); 
}

/**
 * switchView v24:
 * - NO inicia scanner automáticamente.
 * - Muestra el botón de escanear.
 */
function switchView(viewName) {
    console.log(`Switching view to: ${viewName}`); 
    if (viewName === 'scanner') {
        gameView.classList.add('hidden');
        scannerView.classList.remove('hidden');
        displayError(''); 
        current = { service: null, id: null, iframe: null };
        iframeWrapper.innerHTML = ''; 
        iframeWrapper.classList.remove('revealed'); 
        playButton.classList.remove('hidden');
        revealButton.classList.add('hidden');
        revealButton.disabled = false; 
        revealButton.textContent = "🔎 Revelar Video"; 
        playButton.classList.remove('bg-green-500', 'border-green-700'); 
        playButton.classList.add('bg-red-600', 'border-red-800', 'text-white'); 
        playButton.innerHTML = '▶️ DALE PLAY 🎶'; 
        urlInput.value = ''; 
        
        // --- YA NO INICIA SCANNER AUTOMÁTICAMENTE ---
        // setTimeout(startScanner, 300); // Eliminado

        // --- Asegurar estado inicial de la vista scanner ---
        readerElement.classList.add('hidden');    // Ocultar lector
        scanButton.classList.remove('hidden'); // Mostrar botón de escanear

    } else if (viewName === 'game') {
        scannerView.classList.add('hidden');
        gameView.classList.remove('hidden');
        // Asegurarse de detener el scanner si estaba activo
        stopScanner(); 
        
        // Estilo botón Play siempre rojo
        playButton.classList.remove('bg-green-500', 'border-green-700'); 
        playButton.classList.add('bg-red-600', 'border-red-800', 'text-white');
        playButton.innerHTML = '▶️ DALE PLAY 🎶'; 
        playButton.classList.remove('hidden'); 
        revealButton.classList.add('hidden'); 
        iframeWrapper.classList.remove('revealed'); 
    }
}

// --- Lógica del Escáner ---
function onScanSuccess(decodedText, decodedResult) { /* Sin cambios */ 
    console.log("Scan successful:", decodedText); 
    stopScanner(); // Esto ahora también reseteará la UI del scanner (oculta reader, muestra botón)
    setTimeout(() => {
        const parsed = parseService(decodedText); 
        if (parsed.service === 'youtube' || parsed.service === 'youtubemusic') { 
            current = { ...parsed, iframe: null }; 
            switchView('game'); 
        } else {
            displayError(`QR no válido. Solo YouTube.`); 
            // NO reiniciar scanner automáticamente tras error
            // setTimeout(startScanner, 2500); // Eliminado
        }
    }, 100); 
}

function onScanFailure(error) { /* Silencio */ }

/**
 * startScanner v24:
 * - Se llama al pulsar el botón.
 * - Oculta el botón, muestra el lector e inicia.
 */
function startScanner() {
    if (!html5QrcodeScanner) { 
         console.error("Scanner requested but not initialized.");
         if (!initializeScanner()) { displayError("Error: Escáner no inicializado."); return; }
         setTimeout(startScanner, 50); 
         return;
    }
    if (!readerElement) {
        console.error("Reader element not found!");
        displayError("Error: Contenedor scanner no encontrado.");
        return;
    }
    if (isScannerRunning) {
         console.log("Scanner start requested but already running."); 
         return; 
    }

    console.log("Attempting to start scanner via button..."); 
    
    // --- NUEVO: Ocultar botón, mostrar lector ---
    scanButton.classList.add('hidden');
    readerElement.classList.remove('hidden');
    readerElement.innerHTML = ""; // Limpiar por si acaso

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    try {
        html5QrcodeScanner.start( { facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .then(() => { 
            isScannerRunning = true; 
            console.log("Scanner started successfully."); 
            displayError(''); 
        })
        .catch(err => {
            console.error("Error starting scanner (Promise catch):", err); 
            let errorMsg = "No se pudo iniciar la cámara.";
            if (typeof err === 'string' && err.toLowerCase().includes('permission denied')) { errorMsg = "Permiso cámara denegado."; }
            else if (err.name === 'NotAllowedError') errorMsg = "Permiso cámara denegado.";
            else if (err.name === 'NotFoundError') errorMsg = "No se encontró cámara.";
            else if (err.name === 'NotReadableError') errorMsg = "La cámara está en uso.";
            else if (err.message && err.message.includes("not found")) errorMsg = "Error: Contenedor (#reader) no encontrado."; 
            else if (err.message && err.message.includes("already running")) { errorMsg = ''; isScannerRunning = true; console.warn("Scanner already running fix.");} 
            else if (err.message && err.message.includes("Can not start scanning")) { errorMsg = "Error al iniciar escaneo. Refresca."; }
            if(errorMsg) displayError(errorMsg); 
            if(!errorMsg.includes("already running")) isScannerRunning = false; 
            
            // --- NUEVO: Si falla, revertir UI ---
            readerElement.classList.add('hidden');
            scanButton.classList.remove('hidden');
        });
    } catch (syncError) {
         console.error("Error starting scanner (Sync catch):", syncError); 
         displayError("Error inesperado al iniciar cámara.");
         isScannerRunning = false;
         // --- NUEVO: Revertir UI ---
         readerElement.classList.add('hidden');
         scanButton.classList.remove('hidden');
    }
}

/**
 * stopScanner v24:
 * - Llama a clear().
 * - Resetea la UI (oculta reader, muestra botón scan).
 */
function stopScanner() {
    let wasRunning = isScannerRunning; // Guardar estado
    isScannerRunning = false; // Marcar como detenido inmediatamente

    if (html5QrcodeScanner) { 
        console.log("Attempting to stop scanner..."); 
        try {
            html5QrcodeScanner.stop()
            .then(() => { 
                console.log("Scanner stopped successfully via Promise."); 
                // Llamar a clear() DESPUÉS de detener
                if (html5QrcodeScanner && typeof html5QrcodeScanner.clear === 'function') {
                    try {
                        html5QrcodeScanner.clear(); 
                        console.log("Scanner cleared.");
                    } catch (clearError) {
                         console.error("Error calling scanner.clear():", clearError);
                    }
                }
            })
            .catch((err) => { 
                if (!err || !err.message || !err.message.toLowerCase().includes("not scanning")) {
                    console.warn("Error during scanner.stop() (Promise catch):", err); 
                } else { 
                    console.log("Stop called but scanner wasn't running."); 
                }
                // Intentar limpiar incluso si stop falla
                if (html5QrcodeScanner && typeof html5QrcodeScanner.clear === 'function') {
                     try { html5QrcodeScanner.clear(); console.log("Scanner cleared after stop error."); } 
                     catch (clearError) { console.error("Error calling scanner.clear() after stop error:", clearError); }
                 }
            })
            .finally(() => { // Asegurar reset de UI siempre
                 if(readerElement) readerElement.classList.add('hidden');
                 if(scanButton) scanButton.classList.remove('hidden');
            });
        } catch (e) { 
            console.error("Exception calling scanner.stop():", e); 
            // Limpieza manual como fallback y reset UI
             if(readerElement) readerElement.classList.add('hidden');
             if(scanButton) scanButton.classList.remove('hidden');
        }
    } else {
        // Si no existe el objeto, solo resetear UI
        if(readerElement) readerElement.classList.add('hidden');
        if(scanButton) scanButton.classList.remove('hidden');
        console.log("Stop scanner requested but scanner object defunct."); 
    }
}


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
function initializeScanner() { /* Sin cambios */ 
     if (!html5QrcodeScanner) { try { if (!readerElement) throw new Error("Element '#reader' not found."); html5QrcodeScanner = new Html5Qrcode(qrCodeRegionId); console.log("Scanner initialized."); return true; } catch (e) { console.error("Fatal: Init scanner failed:", e); displayError("Error fatal lector QR."); if(scannerView) scannerView.innerHTML = "<p class='text-red-500 text-center'>Escáner no disponible.</p>"; return false; }} return true; 
 }

window.onload = () => { 
     console.log("Window loaded."); 
     if (initializeScanner()) { 
         // Añadir listener al botón de escanear
         if (scanButton) {
             scanButton.addEventListener('click', startScanner);
             console.log("Scan button listener added.");
         } else {
              console.error("Scan button not found!");
              displayError("Error: Botón de escaneo no encontrado.");
         }
         switchView('scanner'); // Mostrar vista inicial (que ahora solo muestra el botón)
     } else {
          console.error("Scanner initialization failed.");
     }
};