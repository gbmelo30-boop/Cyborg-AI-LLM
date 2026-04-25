

const CYBORG = {
    init: () => { 
        window.systemLog("Cyborg AI (LLaMA): Conectado via Fetch."); 
    },

    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    enviarMensagem: async (textoUsuario, sessionId = null) => {
        if (!DB.user) { 
            window.systemLog("Usuário não identificado", "ERRO"); 
            return { response: "Erro: Você precisa estar identificado para conversar.", error: true }; 
        }

        await CYBORG.delay(300);

        try {
            const historyForAI = [{ role: 'user', content: textoUsuario }];

            const contextData = window.currentResearchContext || 
                                JSON.parse(localStorage.getItem('cyborg_current_session')) || 
                                { group: 'Sem Grupo', topic: 'Geral' };

            window.systemLog(`Solicitando resposta (Tema: ${contextData.topic} | RAG: ${window.useRag})`);

            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    messages: historyForAI, 
                    tema: contextData.topic,
                    grupo: contextData.group,
                    use_rag: window.useRag,
                    session_id: sessionId,
                    user_id: DB.user.id
                })
            });

            if (!response.ok) {
                throw new Error(`Erro na conexão com o servidor: ${response.status}`);
            }

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            // O backend retorna a resposta processada e o session_id oficial do banco
            return { 
                response: result.response, 
                sessionId: result.session_id 
            };

        } catch (e) {
            window.systemLog("Erro ao comunicar com o servidor LLaMA: " + e.message, "ERRO");
            return { 
                response: "**Erro de Conexão:** Não foi possível alcançar o servidor do Cyborg AI. Verifique se o backend está rodando.", 
                error: e.message 
            };
        }
    }
};

// Inicialização e exposição global
CYBORG.init();
window.CYBORG = CYBORG;
