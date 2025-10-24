// --- Variables Globales y Selectores ---
const qrCodeRegionId = "reader"; // ID del div para html5-qrcode
let html5QrcodeScanner = null;
let isScannerRunning = false;
let current = { service: null, id: null, kind: null, iframe: null };

const $ = (sel) => document.querySelector(sel);
const scannerView = $('#scanner-view');
const gameView = $('#game-view');
const messageBox = $('#message-box');
const readerElement = $('#reader');
const urlInput = $('#urlInput');
const playerContainer = $('#player-container'); // Contenedor del iframe
const iframeWrapper = $('#iframe-wrapper'); // Wrapper que se recorta/revela
const statusText = $('#status-text'); // Nuevo: Texto encima de botones
const playButton = $('#play-button');
const revealButton = $('#reveal-button');

// --- Funciones de Utilidad ---
function displayMessage(message, type = 'info') {
    messageBox.textContent = message;
    // Clases base y de limpieza
    messageBox.classList.remove('hidden', 'bg-red-700', 'bg-green-700', 'bg-blue-500');
    
    if (!message) { // Si no hay mensaje, ocultar y salir
        messageBox.classList.add('hidden');
        return;
    }
    
    messageBox.classList.remove('hidden'); // Mostrar si hay mensaje
    
    // Aplicar color según tipo
    if (type === 'error') {
        messageBox.classList.add('bg-red-700');
        // Ocultar error después de 3 segundos
        setTimeout(() => messageBox.classList.add('hidden'), 3000); 
    } else if (type === 'success') { // Spotify
        messageBox.classList.add('bg-green-700'); 
    } else if (type === 'youtube') { // YouTube / Music
        messageBox.classList.add('bg-red-700'); 
    } else { // Info (Azul)
        messageBox.classList.add('bg-blue-500');
    }
}

function switchView(viewName) {
    console.log(`Switching view to: ${viewName}`); // DEBUG
    if (viewName === 'scanner') {
        gameView.classList.add('hidden');
        scannerView.classList.remove('hidden');
        displayMessage(''); // Limpiar mensaje
        
        // Resetear estado
        current = { service: null, id: null, kind: null, iframe: null };
        iframeWrapper.innerHTML = ''; 
        iframeWrapper.classList.remove('revealed'); // Ocultar iframe de nuevo
        
        // Resetear UI de controles
        statusText.textContent = "Presiona para iniciar la música";
        playButton.classList.remove('hidden');
        revealButton.classList.add('hidden');
        revealButton.disabled = false; // Habilitar botón revelar
        revealButton.textContent = "🔎 Revelar Pista"; // Resetear texto
        
        // Resetear estilo botón Play a Spotify por defecto
        playButton.classList.remove('bg-red-600', 'border-red-800'); // Quitar estilo YT
        playButton.classList.add('bg-green-500', 'border-green-700', 'text-white'); // Poner estilo Spotify
        playButton.innerHTML = '▶️ Tocar Música'; // Resetear texto Play
        
        urlInput.value = ''; 
        startScanner(); 

    } else if (viewName === 'game') {
        scannerView.classList.add('hidden');
        gameView.classList.remove('hidden');
        stopScanner(); 

        // Ajustar estilo del botón Play y texto según el servicio
        if (current.service === 'youtube' || current.service === 'youtubemusic') {
            playButton.classList.remove('bg-green-500', 'border-green-700');
            playButton.classList.add('bg-red-600', 'border-red-800', 'text-white');
            statusText.textContent = "Video cargado. Presiona Play.";
        } else { // Spotify
            playButton.classList.remove('bg-red-600', 'border-red-800');
            playButton.classList.add('bg-green-500', 'border-green-700', 'text-white');
            statusText.textContent = "Canción cargada. Presiona Play.";
        }
        playButton.innerHTML = '▶️ Tocar Música'; // Asegurar texto inicial
        playButton.classList.remove('hidden'); // Asegurar que Play esté visible
        revealButton.classList.add('hidden'); // Asegurar que Revelar esté oculto
        iframeWrapper.classList.remove('revealed'); // Asegurar que iframe esté oculto
    }
}

// --- Lógica del Escáner (con html5-qrcode) ---
function onScanSuccess(decodedText, decodedResult) {
    console.log("Scan successful:", decodedText); // DEBUG
    stopScanner(); // Detener cámara
    const parsed = parseService(decodedText); 
    
    if (parsed.service && parsed.id) {
        current = { ...parsed, iframe: null }; 
        let serviceName = (parsed.service === 'youtube' || parsed.service === 'youtubemusic') ? 'YouTube' : 'Spotify';
        displayMessage(`¡QR de ${serviceName} cargado!`, (parsed.service.startsWith('spotify') ? 'success' : 'youtube')); 
        switchView('game'); 
    } else {
        displayMessage(`QR no válido: ${decodedText.substring(0, 50)}...`, "error"); // Mostrar parte del QR inválido
        // Reintentar escanear después de un error
        setTimeout(startScanner, 2500); 
    }
}

function onScanFailure(error) { /* No hacer nada si no encuentra QR */ }

function startScanner() {
    // Inicializar si no existe
    if (!html5QrcodeScanner) {
        try { 
            html5QrcodeScanner = new Html5Qrcode(qrCodeRegionId); 
            console.log("html5QrcodeScanner initialized"); // DEBUG
        } catch (e) { 
            console.error("Init scanner failed:", e); 
            displayMessage("Error lector QR.", "error"); 
            if(scannerView) scannerView.innerHTML = "<p class='text-red-500 text-center'>Escáner no disponible.</p>";
            return; 
        }
    }
    
    // Verificar si el elemento reader está listo
    if (!readerElement || readerElement.offsetParent === null) { 
        console.warn("Reader element not ready for scanner."); 
        // Reintentar brevemente
        setTimeout(startScanner, 100); 
        return; 
    }

    if (!isScannerRunning) {
        console.log("Attempting to start scanner..."); // DEBUG
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        html5QrcodeScanner.start( { facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .then(() => { 
            isScannerRunning = true; 
            console.log("Scanner started successfully."); // DEBUG
            displayMessage(''); // Limpiar mensajes previos al iniciar
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
         console.log("Scanner start requested but already running."); // DEBUG
    }
}

function stopScanner() {
    if (html5QrcodeScanner && isScannerRunning) { 
        console.log("Attempting to stop scanner..."); // DEBUG
        try {
            html5QrcodeScanner.stop()
            .then(() => { 
                isScannerRunning = false; 
                console.log("Scanner stopped successfully."); // DEBUG
                if(readerElement) readerElement.innerHTML = ""; // Limpiar visualmente
            })
            .catch((err) => { 
                console.warn("Error stopping scanner (maybe minor):", err); 
                isScannerRunning = false; // Asumir detenido
                if(readerElement) readerElement.innerHTML = ""; 
            });
        } catch (e) { 
            console.error("Exception stopping scanner:", e); 
            isScannerRunning = false; 
            if(readerElement) readerElement.innerHTML = ""; 
        }
    } else {
        // Si no está corriendo, solo asegurar estado y limpiar
        isScannerRunning = false; 
        if(readerElement) readerElement.innerHTML = ""; 
        // console.log("Stop scanner requested but not running or scanner defunct."); // DEBUG
    }
}

// --- Cargar URL desde Input ---
function loadFromInput() {
    const url = urlInput.value.trim(); 
    if (!url) { displayMessage("Pega una URL válida.", "error"); return; } 
    const parsed = parseService(url); 
    if (parsed.service && parsed.id) { 
        current = { ...parsed, iframe: null }; 
        let sN = (parsed.service === 'youtube' || parsed.service === 'youtubemusic') ? 'YouTube' : 'Spotify'; 
        displayMessage(`URL ${sN} cargada!`, (parsed.service.startsWith('spotify') ? 'success' : 'youtube')); 
        switchView('game'); 
    } else { displayMessage("La URL no parece ser de Spotify o YouTube.", "error"); }
}

// --- Lógica del Juego ---

// Función parseService (robusta v16)
function parseService(url) {
    try {
        url = url.trim(); let u = null; try { u = new URL(url); } catch (e) {} const host = u ? u.hostname.replace(/^www\./,'').toLowerCase() : '';
        // YouTube
        if (host.includes('youtube.com') || host === 'youtu.be' || host.includes('music.youtube.com')) {
            let v = null; if (host === 'youtu.be') { v = u.pathname.slice(1).split('/')[0]; } else { v = u.searchParams.get('v'); } if (!v && u.pathname.startsWith('/shorts/')) { v = u.pathname.split('/')[2] || null; } if (!v && u.pathname.startsWith('/embed/')) { v = u.pathname.split('/')[2] || null; } if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return { service: host.includes('music.youtube.com') ? 'youtubemusic' : 'youtube', id: v };
        }
        // Spotify Estándar
        const spotifyStdMatch = url.match(/https:\/\/open\.spotify\.com\/(?:embed\/)?track\/([a-zA-Z0-9]+)/); if (spotifyStdMatch && spotifyStdMatch[1]) return { service: 'spotify', id: spotifyStdMatch[1], kind: 'track' };
        // Spotify Custom (tu formato http://googleusercontent.com/spotify.com/...)
        const spotifyCustomMatch = url.match(/http(s)?:\/\/open\.spotify\.com\/(.+)/); // Captura path genérico
        if (spotifyCustomMatch && spotifyCustomMatch[1]) {
            // AHORA guardamos la URL COMPLETA para este caso
            console.log("Matched custom Spotify URL:", url);
            return { service: 'spotify-custom-embed', id: url, kind: null }; 
        }
        return { service: null, id: null };
    } catch(e) { 
        console.error("Parse URL Error:", url, e); 
        // Reintentar custom match si falló new URL()
        const spotifyCustomMatch = url.match(/http(s)?:\/\/open\.spotify\.com\/(.+)/); 
        if (spotifyCustomMatch && spotifyCustomMatch[1]) { console.log("Matched custom Spotify URL (catch):", url); return { service: 'spotify-custom-embed', id: url, kind: null }; }
        return { service: null, id: null }; 
    }
}

// Construye iframe embebido (v16)
function buildEmbed({ service, id, kind }) {
    let src = '', title = 'Reproductor', allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture; web-share';
    if (service === 'youtube' || service === 'youtubemusic') {
        const params = new URLSearchParams({ autoplay: '1', controls: '0', modestbranding: '1', rel: '0', playsinline: '1', enablejsapi: '1' });
        try { if (location.origin && location.origin.startsWith('http')) params.set('origin', location.origin); } catch {}
        src = `https://www.youtube.com/embed/${id}?${params.toString()}`; title = 'YT Player';
    } else if (service === 'spotify') { // ID estándar
        src = `https://open.spotify.com/embed/$track/${id}?utm_source=generator&theme=0`; title = 'Spotify Player'; allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'; 
    } else if (service === 'spotify-custom-embed') { // URL completa
         src = id + '?utm_source=generator&theme=0'; title = 'Spotify Player'; allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    } else { return null; } 
    
    const iframe = document.createElement('iframe'); 
    iframe.src=src; iframe.title=title; iframe.loading='lazy'; iframe.allow=allow; 
    iframe.allowFullscreen=true; iframe.style.borderRadius='12px'; 
    return iframe;
}

// Inicia la reproducción (v18 - con play explícito)
function playSong() {
    console.log("playSong called"); // DEBUG
    if (!current.service || !current.id) { displayMessage("No hay pista cargada.", "error"); return; }
    
    const iframe = buildEmbed(current);
    if (!iframe) { displayMessage("Error al crear reproductor.", "error"); return; }
    
    iframeWrapper.innerHTML = ''; 
    iframeWrapper.appendChild(iframe); 
    current.iframe = iframe; // Guardar referencia
    
    // Actualizar UI
    playButton.classList.add('hidden'); // Ocultar botón Play      
    revealButton.classList.remove('hidden'); // Mostrar botón Revelar
    statusText.textContent = "Pista Sonando..."; // Cambiar texto status
    displayMessage(''); // Limpiar mensaje superior

    // La tapa (#cover-layer) sigue visible por defecto.

    // --- INTENTO DE PLAY EXPLÍCITO ---
    setTimeout(() => {
        if (!current.iframe) return; 
        if (current.service === 'youtube' || current.service === 'youtubemusic') {
            console.log("Sending 'playVideo' command to YouTube"); // DEBUG
            const playMsg = JSON.stringify({ event:'command', func:'playVideo', args:[] });
            current.iframe.contentWindow?.postMessage(playMsg, '*'); 
        } else if (current.service.startsWith('spotify')) {
             console.log("Focusing Spotify iframe"); // DEBUG
             current.iframe.focus(); 
        }
    }, 500); // Esperar medio segundo
}

// Revela el reproductor oculto
function revealPlayer() { 
    console.log("revealPlayer called"); // DEBUG
    iframeWrapper.classList.add('revealed'); // Quita el clip-path
    // coverLayer.classList.add('cover-hidden'); // Opcional: Ocultar la capa de botones también? Por ahora no.
    revealButton.textContent = "¡Revelado!";
    revealButton.disabled = true;
    if(current.iframe) current.iframe.focus(); // Enfocar por si acaso
}

// --- Inicialización ---
window.onload = () => { 
     console.log("Window loaded. Initializing..."); // DEBUG
     try {
         // Asegurarse de que el div 'reader' exista antes de inicializar
         if (!readerElement) throw new Error("Element with ID 'reader' not found.");
         html5QrcodeScanner = new Html5Qrcode(qrCodeRegionId); 
         switchView('scanner'); 
     } catch (e) {
          console.error("Initialization failed:", e);
          displayMessage("Error fatal al iniciar.", "error");
          if(scannerView) scannerView.innerHTML = "<p class='text-red-500 text-center'>No se pudo iniciar la aplicación.</p>";
     }
};