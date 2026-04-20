// ==============================================================================
// CONFIGURAÇÃO DA API
// ==============================================================================
const API_BASE_URL = "https://cyborg-ai.vercel.app";

window.systemLog = function(mensagem, tipo = "INFO") {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}] [${tipo}] ${mensagem}`;
    console.log(logLine);
}

async function iniciarSistema() {
    window.systemLog("--- Iniciando Cyborg AI ---");
    if (typeof supabase === 'undefined') window.systemLog("⚠️ ERRO: Supabase não carregou.", "ERRO");
    else window.systemLog("Biblioteca Supabase carregada.");
}
iniciarSistema();
