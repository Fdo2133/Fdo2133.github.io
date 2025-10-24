// --- Variables Globales y Selectores ---
const qrCodeRegionId = "reader";
let html5QrcodeScanner = null; 
let isScannerRunning = false;
let current = { service: null, id: null, iframe: null }; 

const $ = (sel) => document.querySelector(sel);
const scannerView = $('#scanner-view');
const gameView = $('#game-view');
const errorBox = $('#error-box'); // Usar para errores
const readerElement = $('#reader');
// const urlInput = $('#urlInput'); // Eliminado
const playerContainer = $('#player-container');
const iframeWrapper = $('#iframe-wrapper');
// const statusText = $('#status-text'); // Eliminado
const playButton = $('#play-button');
const revealButton = $('#reveal-button');

// --- Funciones de Utilidad ---
function displayError(message) { // Solo para errores
    errorBox.textContent = message;
    if (!message) { 
        errorBox.classList.add('hidden'); 
        return; 
    }
    errorBox.classList.remove('hidden'); 
    // Ocultar error después de 3 segundos
    setTimeout(() => errorBox.classList.add('hidden'), 3000); 
}

function switchView(viewName) {
    console.log(`Switching view to: ${viewName}`); 
    if (viewName === 'scanner') {
        gameView.classList.add('hidden');
        scannerView.classList.remove('hidden');
        displayError(''); // Limpiar errores
        current = { service: null, id: null, iframe: null };
        iframeWrapper.innerHTML = ''; 
        iframeWrapper.classList.remove('revealed'); 
        playButton.classList.remove('hidden');
        revealButton.classList.add('hidden');
        revealButton.disabled = false; 
        revealButton.textContent = "🔎 Revelar Video"; 
        startScanner(); 
    } else if (viewName === 'game') {
        scannerView.classList.add('hidden');
        gameView.classList.remove('hidden');
        stopScanner(); 
        // Botón Play ya está rojo por defecto en HTML/Tailwind
        playButton.classList.remove('hidden'); 
        revealButton.classList.add('hidden'); 
        iframeWrapper.classList.remove('revealed'); 
    }
}

// --- Lógica del Escáner ---
function onScanSuccess(decodedText, decodedResult) {
    console.log("Scan successful:", decodedText); 
    stopScanner(); 
    const parsed = parseService(decodedText); 
    
    if (parsed.service === 'youtube' || parsed.service === 'youtubemusic') { 
        current = { ...parsed, iframe: null }; 
        // No mostramos mensaje de éxito, solo cambiamos de vista
        switchView('game'); 
    } else {
        displayError(`QR no válido. Solo YouTube.`); // Mensaje de error
        setTimeout(startScanner, 2500); // Reintentar scan
    }
}

function onScanFailure(error) { /* Silencio */ }

function startScanner() {
    if (!html5QrcodeScanner) { 
         console.error("Scanner requested but not initialized.");
         // Intentar inicializar aquí por si window.onload falló
         if (!initializeScanner()) {
             displayError("Error: Escáner no inicializado.");
             return; 
         }
    }
    if (!readerElement) {
        console.error("Reader element not found!");
        displayError("Error: Contenedor scanner no encontrado.", "error");
        return;
    }
    
    if (!isScannerRunning) {
        console.log("Attempting to start scanner..."); 
        // Asegurar que el div esté vacío antes de iniciar
        readerElement.innerHTML = ""; 

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        // Agregar try-catch alrededor de start para manejar errores síncronos si los hubiera
        try {
            html5QrcodeScanner.start( { facingMode: "environment" }, config, onScanSuccess, onScanFailure)
            .then(() => { 
                isScannerRunning = true; 
                console.log("Scanner started successfully."); 
                displayError(''); // Limpiar errores al iniciar bien
            })
            .catch(err => {
                console.error("Error starting scanner (Promise catch):", err); 
                let errorMsg = "No se pudo iniciar la cámara.";
                if (err.name === 'NotAllowedError') errorMsg = "Permiso de cámara denegado.";
                else if (err.name === 'NotFoundError') errorMsg = "No se encontró cámara.";
                else if (err.name === 'NotReadableError') errorMsg = "La cámara está en uso.";
                displayError(errorMsg); // Mostrar error
                isScannerRunning = false; 
            });
        } catch (syncError) {
             console.error("Error starting scanner (Sync catch):", syncError); 
             displayError("Error inesperado al iniciar cámara.");
             isScannerRunning = false;
        }
    } else {
         console.log("Scanner start requested but already running."); 
    }
}


function stopScanner() { /* Sin cambios */ 
    if (html5QrcodeScanner && isScannerRunning) { console.log("Attempting to stop scanner..."); try { html5QrcodeScanner.stop().then(() => { isScannerRunning = false; console.log("Scanner stopped."); if(readerElement) readerElement.innerHTML = ""; }).catch((err) => { if (!err || !err.message || !err.message.toLowerCase().includes("not scanning")) { console.warn("Stop scanner error:", err); } else { console.log("Stop called but not scanning."); } isScannerRunning = false; if(readerElement) readerElement.innerHTML = ""; }); } catch (e) { console.error("Exception stopping scanner:", e); isScannerRunning = false; if(readerElement) readerElement.innerHTML = ""; }} else { isScannerRunning = false; if(readerElement) readerElement.innerHTML = ""; }
}

// --- Cargar URL desde Input ELIMINADO ---
// function loadFromInput() { ... } 

// --- Lógica del Juego ---

// parseService SIMPLIFICADO: Solo YouTube
function parseService(url) { /* Sin cambios */ 
    try {
        url = url.trim(); let u = null; try { u = new URL(url); } catch (e) {} const host = u ? u.hostname.replace(/^www\./,'').toLowerCase() : '';
        if (host.includes('youtube.com') || host === 'youtu.be' || host.includes('music.youtube.com')) {
            let v = null; if (host === 'youtu.be') { v = u.pathname.slice(1).split('/')[0]; } else if (u) { v = u.searchParams.get('v'); } if (!v && u && u.pathname.startsWith('/shorts/')) { v = u.pathname.split('/')[2] || null; } if (!v && u && u.pathname.startsWith('/embed/')) { v = u.pathname.split('/')[2] || null; } if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return { service: host.includes('music.youtube.com') ? 'youtubemusic' : 'youtube', id: v };
        }
        return { service: null, id: null };
    } catch(e) { console.error("Parse URL Error:", url, e); return { service: null, id: null }; }
}

// buildEmbed SIMPLIFICADO: Solo YouTube
function buildEmbed({ service, id }) { /* Sin cambios */ 
    if (service !== 'youtube' && service !== 'youtubemusic') return null; 
    let src = ''; let title = 'YouTube Player'; let allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture; web-share';
    const params = new URLSearchParams({ autoplay: '1', controls: '0', modestbranding: '1', rel: '0', playsinline: '1', enablejsapi: '1' });
    try { if (location.origin && location.origin.startsWith('http')) params.set('origin', location.origin); } catch {}
    src = `https://www.youtube.com/embed/${id}?${params.toString()}`; 
    const iframe = document.createElement('iframe'); 
    iframe.src=src; iframe.title=title; iframe.loading='lazy'; iframe.allow=allow; 
    iframe.allowFullscreen=true; iframe.style.borderRadius='12px'; 
    return iframe;
}

// Inicia la reproducción
function playSong() {
    console.log("playSong called"); 
    if (!current.service || !current.id) { displayError("No hay video cargado."); return; }
    if (current.service !== 'youtube' && current.service !== 'youtubemusic') { displayError("Servicio no soportado."); return; }
    
    const iframe = buildEmbed(current);
    if (!iframe) { displayError("Error al crear reproductor."); return; }
    
    iframeWrapper.innerHTML = ''; iframeWrapper.appendChild(iframe); current.iframe = iframe; 
    
    playButton.classList.add('hidden');       
    revealButton.classList.remove('hidden');   
    // statusText ya no existe
    displayError(''); // Limpiar errores

    // --- INTENTO DE PLAY EXPLÍCITO ---
    setTimeout(() => {
        if (!current.iframe) return; 
        console.log("Sending 'playVideo' command to YouTube"); 
        const playMsg = JSON.stringify({ event:'command', func:'playVideo', args:[] });
        current.iframe.contentWindow?.postMessage(playMsg, '*'); 
    }, 500); 
}

// Revela el reproductor
function revealPlayer() { 
    console.log("revealPlayer called"); 
    iframeWrapper.classList.add('revealed'); 
    revealButton.textContent = "¡Revelado!";
    revealButton.disabled = true;
    if(current.iframe) current.iframe.focus(); 
}

// --- Inicialización ---
function initializeScanner() {
     if (!html5QrcodeScanner) { 
         try {
             if (!readerElement) throw new Error("Element '#reader' not found.");
             html5QrcodeScanner = new Html5Qrcode(qrCodeRegionId); 
             console.log("Scanner initialized.");
             return true; 
         } catch (e) {
              console.error("Fatal: Init scanner failed:", e);
              displayError("Error fatal lector QR.");
              if(scannerView) scannerView.innerHTML = "<p class='text-red-500 text-center'>Escáner no disponible.</p>";
              return false; 
         }
     }
      return true; // Ya estaba inicializado
 }

window.onload = () => { 
     console.log("Window loaded."); 
     if (initializeScanner()) { 
         switchView('scanner'); 
     } else {
          console.error("Scanner initialization failed.");
     }
};