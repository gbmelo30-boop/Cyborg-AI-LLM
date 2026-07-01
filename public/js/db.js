// ==============================================================================
// CAMADA DE DADOS (via backend próprio + SQLite local) — sem Supabase.
// Mantém a mesma interface DB.* que o resto do app já usa; por baixo, agora
// fala com os endpoints do app.py (/api/sessions, /api/messages, ...).
// ==============================================================================
const DB = {
    user: null,
    isGuest: false,

    init: async () => {
        window.systemLog("Camada de dados local (backend) pronta.");
        return false;
    },

    entrarComoConvidado: async () => {
        DB.user = { id: window.gerarUUID(), email: 'anonimo@pesquisa.guest' };
        DB.isGuest = true;
        return { success: true };
    },

    logout: async () => { DB.user = null; },

    criarSessao: async (primeiraMensagem) => {
        if (!DB.user) return null;
        const ctx = JSON.parse(localStorage.getItem('cyborg_current_session')) || {};
        try {
            const r = await fetch(`${API_BASE_URL}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: DB.user.id,
                    title: primeiraMensagem,
                    grupo: ctx.group || 'Uso Individual',
                    tema: ctx.topic || 'Geral',
                    user_name: ctx.userName || null
                })
            });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return await r.json();
        } catch (e) {
            window.systemLog("Erro criarSessao: " + e.message, "ERRO");
            return null;
        }
    },

    salvarMensagem: async (sessionId, role, content, usedRag = false) => {
        try {
            await fetch(`${API_BASE_URL}/api/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, role: role, content: content, used_rag: usedRag })
            });
        } catch (e) {
            window.systemLog(`Erro salvarMensagem: ${e.message}`, "ERRO");
        }
    },

    carregarHistorico: async (sessionId) => {
        try {
            const r = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/messages`);
            if (!r.ok) return [];
            return await r.json();
        } catch (e) {
            return [];
        }
    },

    listarSessoes: async () => {
        if (!DB.user) return [];
        try {
            const r = await fetch(`${API_BASE_URL}/api/sessions?user_id=${encodeURIComponent(DB.user.id)}`);
            if (!r.ok) return [];
            return await r.json();
        } catch (e) {
            window.systemLog("Erro listarSessoes: " + e.message, "ERRO");
            return [];
        }
    },

    _patchSessao: async (sessionId, campos) => {
        try {
            await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(campos)
            });
        } catch (e) {
            window.systemLog("Erro ao atualizar sessão: " + e.message, "ERRO");
        }
    },

    // Soft delete (mantém no banco para pesquisa, some da lista do usuário)
    deletarSessao: async (sessionId) => DB._patchSessao(sessionId, { oculta_para_usuario: true }),
    renomearSessao: async (sessionId, novoTitulo) => DB._patchSessao(sessionId, { title: novoTitulo }),
    fixarSessao: async (sessionId, statusAtual) => DB._patchSessao(sessionId, { is_pinned: !statusAtual }),

    // Baixar o histórico em CSV (abre o download direto do backend)
    exportarCSV: () => {
        const uid = DB.user ? DB.user.id : '';
        window.open(`${API_BASE_URL}/api/export?user_id=${encodeURIComponent(uid)}`, '_blank');
    }
};

window.DB = DB;
