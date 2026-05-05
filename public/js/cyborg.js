// ==============================================================================
// COMUNICAÇÃO COM O BACKEND E SALVAMENTO (LLaMA)
// ==============================================================================

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
            // ==================================================================
            // 1. SALVA A MENSAGEM DO USUÁRIO NO BANCO DE DADOS
            // ==================================================================
            let currentSessionId = sessionId;
            
            // Se for o início de uma nova conversa, cria a sessão no banco
            if (!currentSessionId) {
                const sessao = await DB.criarSessao(textoUsuario);
                if (sessao) {
                    currentSessionId = sessao.id;
                } else {
                    return null; // Para se der erro ao criar
                }
            }
            
            // Salva a pergunta do usuário no Supabase
            await DB.salvarMensagem(currentSessionId, "user", textoUsuario);
            // ==================================================================

            const historyForAI = [{ role: 'user', content: textoUsuario }];

            const contextData = window.currentResearchContext || 
                                JSON.parse(localStorage.getItem('cyborg_current_session')) || 
                                { group: 'Sem Grupo', topic: 'Geral' };

            window.systemLog(`Solicitando resposta (Tema: ${contextData.topic} | RAG: ${window.useRag})`);

            // Faz o pedido para o Python (LLaMA)
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
                    session_id: currentSessionId, // Envia o ID para o Python saber qual é
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

            // ==================================================================
            // 2. SALVA A RESPOSTA DA IA NO BANCO DE DADOS
            // ==================================================================
            await DB.salvarMensagem(currentSessionId, "assistant", result.response);
            // ==================================================================

            return { 
                response: result.response, 
                sessionId: currentSessionId 
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
