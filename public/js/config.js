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

// UUID robusto: funciona também em contexto NÃO seguro (HTTP), onde
// crypto.randomUUID pode não existir. Usa getRandomValues como fallback.
window.gerarUUID = function() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    const rnd = (window.crypto && crypto.getRandomValues)
        ? () => crypto.getRandomValues(new Uint8Array(1))[0]
        : () => Math.floor(Math.random() * 256);
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ (rnd() & (15 >> (c / 4)))).toString(16)
    );
};
