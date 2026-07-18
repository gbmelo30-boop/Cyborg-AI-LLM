// ==============================================================================
// COMUNICAÇÃO COM O BACKEND E SALVAMENTO (LLaMA + RAG)
// ==============================================================================
const CYBORG = {
    init: () => { window.systemLog("Cyborg AI (LLaMA): Conectado via Fetch."); },

    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    enviarMensagem: async (textoUsuario, sessionId = null) => {
        if (!DB.user) {
            window.systemLog("Usuário não identificado", "ERRO");
            return { response: "Erro: Você precisa estar identificado para conversar.", error: true };
        }

        await CYBORG.delay(300);
        let currentSessionId = sessionId;

        // Cria a sessão no início de uma nova conversa
        if (!currentSessionId) {
            const sessao = await DB.criarSessao(textoUsuario);
            if (sessao) currentSessionId = sessao.id;
            else return null;
        }

        try {
            // 1. Salva a pergunta do usuário
            await DB.salvarMensagem(currentSessionId, "user", textoUsuario);

            // 2. Monta o histórico completo — dá memória conversacional ao modelo
            const historicoRaw = await DB.carregarHistorico(currentSessionId);
            const historyForAI = historicoRaw.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }));

            const contextData = window.currentResearchContext ||
                                JSON.parse(localStorage.getItem('cyborg_current_session')) ||
                                { group: 'Individual/Visitante', topic: 'Geral' };
            const temaAtual = contextData.topic || 'Geral';

            window.systemLog(`Solicitando resposta (Tema: ${temaAtual} | RAG: ${window.useRag})`);

            if (!API_BASE_URL || API_BASE_URL.includes("COLE_O_LINK")) {
                throw new Error("Link da API não configurado.");
            }

            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: historyForAI,
                    tema: temaAtual,
                    grupo: contextData.group,
                    use_rag: window.useRag,
                    idioma: window.currentLang || 'pt',
                    session_id: currentSessionId,
                    userName: (contextData.userName || ''),
                    user_id: DB.user.id,
                    estilo: (localStorage.getItem('cyborg_estilo') || 'equilibrado')
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Erro HTTP: ${response.status}`);
            }

            const result = await response.json();
            if (result.error) throw new Error(result.error);

            // Memoria automatica: quando o backend sinaliza, atualiza o perfil em segundo plano
            if (result.memory_should_refresh && DB.atualizarMemoria && DB.user) {
                DB.atualizarMemoria().catch(() => {});
            }

            const text = (result.response || "").replace("<<FIM>>", "").trim();

            // 3. Salva a resposta da IA
            await DB.salvarMensagem(currentSessionId, "assistant", text);
            window.systemLog("Resposta salva.");

            return { response: text, sessionId: currentSessionId };

        } catch (e) {
            console.error("ERRO GERAL:", e);
            return {
                response: "**Erro de Conexão:** Não foi possível alcançar o servidor do Cyborg AI. " + e.message,
                error: e.message
            };
        }
    }
};

CYBORG.init();
window.CYBORG = CYBORG;
