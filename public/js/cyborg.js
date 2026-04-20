// ==============================================================================
// COMUNICAÇÃO COM O BACKEND
// ==============================================================================
const CYBORG = {
    init: () => { window.systemLog("Cyborg AI: Conectado via Fetch."); },

    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    enviarMensagem: async (textoUsuario, sessionId = null) => {
        if (!DB.user) { window.systemLog("Usuario nao logado", "ERRO"); return null; }

        await CYBORG.delay(500);
        let currentSessionId = sessionId;
        
        if (!currentSessionId) {
            const sessao = await DB.criarSessao(textoUsuario);
            if (sessao) currentSessionId = sessao.id;
            else return null;
        }

        try {
            await DB.salvarMensagem(currentSessionId, "user", textoUsuario);
            const historicoRaw = await DB.carregarHistorico(currentSessionId);
            const historyForAI = historicoRaw.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }));

            const contextData = window.currentResearchContext || JSON.parse(localStorage.getItem('cyborg_current_session')) || {};
            const temaAtual = contextData.topic || 'Geral';

            window.systemLog(`Enviando dados para a API (Tema: ${temaAtual})...`);

            if (!API_BASE_URL || API_BASE_URL.includes("COLE_O_LINK")) {
                throw new Error("Link da API não configurado.");
            }

            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: historyForAI, tema: temaAtual })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Erro HTTP: ${response.status}`);
            }

            const result = await response.json();
            let text = result.response.replace("<<FIM>>", "").trim();

            await DB.salvarMensagem(currentSessionId, "assistant", text);
            window.systemLog("Resposta salva.");

            return { response: text, sessionId: currentSessionId };

        } catch (e) {
            console.error("ERRO GERAL:", e);
            return { response: "**Erro Técnico:** " + e.message, error: e.message };
        }
    }
};

CYBORG.init();
window.CYBORG = CYBORG;
