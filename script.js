// --- Variables Globales y Selectores ---
const qrCodeRegionId = "reader";
let html5QrcodeScanner = null; // Se inicializará en window.onload
let isScannerRunning = false;
let current = { service: null, id: null, iframe: null }; 

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
    messageBox.classList.remove('hidden', 'bg-red-700', 'bg-green-700', 'bg-blue-500');
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
        iframeWrapper.classList.remove('revealed'); // Resetear posición iframe
        statusText.textContent = "Escanea o pega una URL de YouTube"; 
        playButton.classList.remove('hidden');
        revealButton.classList.add('hidden');
        revealButton.disabled = false; 
        revealButton.textContent = "🔎 Revelar Video"; 
        // Botón Play siempre rojo (YouTube)
        playButton.classList.remove('bg-green-500', 'border-green-700'); 
        playButton.classList.add('bg-red-600', 'border-red-800', 'text-white'); 
        playButton.innerHTML = '▶️ DALE PLAY 🎶'; 
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
        playButton.innerHTML = '▶️ DALE PLAY 🎶'; 
        playButton.classList.remove('hidden'); 
        revealButton.classList.add('hidden'); 
        iframeWrapper.classList.remove('revealed'); // Asegurar que iframe esté oculto
    }
}

// --- Lógica del Escáner ---
function onScanSuccess(decodedText, decodedResult) {
    console.log("Scan successful:", decodedText); 
    stopScanner(); 
    const parsed = parseService(decodedText); 
    
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

function startScanner() {
    if (!html5QrcodeScanner) { 
         console.error("Scanner object not initialized.");
         displayMessage("Error: Escáner no inicializado.", "error");
         // Intentar inicializar de nuevo por si acaso
         if (!initializeScanner()) return; // Si falla de nuevo, salir
    }
    if (!readerElement) {
        console.error("Reader element not found!");
        displayMessage("Error: Contenedor del scanner no encontrado.", "error");
        return;
    }
    
    if (!isScannerRunning) {
        console.log("Attempting to start scanner..."); 
        readerElement.innerHTML = ""; // Limpiar antes de iniciar

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
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
        });
    } else {
         console.log("Scanner start requested but already running."); 
    }
}

function stopScanner() {
    if (html5QrcodeScanner && isScannerRunning) { 
        console.log("Attempting to stop scanner..."); 
        try {
            html5QrcodeScanner.stop()
            .then(() => { 
                isScannerRunning = false; 
                console.log("Scanner stopped successfully."); 
                if(readerElement) readerElement.innerHTML = ""; 
            })
            .catch((err) => { 
                if (!err || !err.message || !err.message.toLowerCase().includes("not scanning")) {
                    console.warn("Error stopping scanner:", err); 
                } else { console.log("Stop called but scanner wasn't running."); }
                isScannerRunning = false; 
                if(readerElement) readerElement.innerHTML = ""; 
            });
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

// parseService SIMPLIFICADO: Solo YouTube
function parseService(url) {
    try {
        url = url.trim(); let u = null; try { u = new URL(url); } catch (e) {} const host = u ? u.hostname.replace(/^www\./,'').toLowerCase() : '';
        if (host.includes('youtube.com') || host === 'youtu.be' || host.includes('music.youtube.com')) {
            let v = null; if (host === 'youtu.be') { v = u.pathname.slice(1).split('/')[0]; } else if (u) { v = u.searchParams.get('v'); } if (!v && u && u.pathname.startsWith('/shorts/')) { v = u.pathname.split('/')[2] || null; } if (!v && u && u.pathname.startsWith('/embed/')) { v = u.pathname.split('/')[2] || null; } if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return { service: host.includes('music.youtube.com') ? 'youtubemusic' : 'youtube', id: v };
        }
        return { service: null, id: null }; // No es YouTube
    } catch(e) { console.error("Parse URL Error:", url, e); return { service: null, id: null }; }
}

// buildEmbed SIMPLIFICADO: Solo YouTube
function buildEmbed({ service, id }) {
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

// Inicia la reproducción (v18 - con play explícito)
function playSong() {
    console.log("playSong called"); 
    if (!current.service || !current.id) { displayMessage("No hay video cargado.", "error"); return; }
    if (current.service !== 'youtube' && current.service !== 'youtubemusic') { displayMessage("Servicio no soportado.", "error"); return; }
    
    const iframe = buildEmbed(current);
    if (!iframe) { displayMessage("Error al crear reproductor.", "error"); return; }
    
    iframeWrapper.innerHTML = ''; iframeWrapper.appendChild(iframe); current.iframe = iframe; 
    
    playButton.classList.add('hidden');       
    revealButton.classList.remove('hidden');   
    statusText.textContent = "Video Sonando..."; 
    displayMessage(''); 

    // --- INTENTO DE PLAY EXPLÍCITO ---
    setTimeout(() => {
        if (!current.iframe) return; 
        console.log("Sending 'playVideo' command to YouTube"); 
        const playMsg = JSON.stringify({ event:'command', func:'playVideo', args:[] });
        current.iframe.contentWindow?.postMessage(playMsg, '*'); 
    }, 500); 
}

// Revela el reproductor (Mueve el iframe a la vista)
function revealPlayer() { 
    console.log("revealPlayer called"); 
    iframeWrapper.classList.add('revealed'); // Baja el iframe
    revealButton.textContent = "¡Revelado!";
    revealButton.disabled = true;
    if(current.iframe) current.iframe.focus(); 
}

// --- Inicialización ---
function initializeScanner() {
     if (!html5QrcodeScanner) { 
         try {
             if (!readerElement) throw new Error("Element '#reader' not found during init.");
             html5QrcodeScanner = new Html5Qrcode(qrCodeRegionId); 
             console.log("html5QrcodeScanner initialized successfully.");
             return true; 
         } catch (e) {
              console.error("Fatal: Failed to initialize html5QrcodeScanner:", e);
              displayMessage("Error fatal: No se pudo inicializar el lector QR.", "error");
              if(scannerView) scannerView.innerHTML = "<p class='text-red-500 text-center'>Escáner no disponible.</p>";
              return false; 
         }
     }
      return true; // Ya estaba inicializado
 }

window.onload = () => { 
     console.log("Window loaded. Initializing..."); 
     if (initializeScanner()) { 
         switchView('scanner'); 
     } else {
          console.error("Scanner initialization failed.");
     }
};