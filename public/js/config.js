// ==============================================================================
// CONFIGURAÇÃO DA API
// ==============================================================================
const API_BASE_URL = "http://200.156.26.159";

window.systemLog = function(mensagem, tipo = "INFO") {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [${tipo}] ${mensagem}`);
}

async function iniciarSistema() {
    window.systemLog("--- Iniciando Cyborg AI (LLM local) ---");
}
iniciarSistema();
