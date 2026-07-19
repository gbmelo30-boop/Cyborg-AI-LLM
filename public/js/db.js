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
                    // Nome real so vai ao banco quando o usuario esta logado (conta).
                    // Visitante fica anonimo (user_name = null -> rotulo "Participante XXXX").
                    user_name: ctx.registered ? (ctx.userName || null) : null
                })
            });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return await r.json();
        } catch (e) {
            window.systemLog("Erro criarSessao: " + e.message, "ERRO");
            return null;
        }
    },

    salvarMensagem: async (sessionId, role, content, usedRag = false, estilo = null) => {
        try {
            await fetch(`${API_BASE_URL}/api/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, role: role, content: content, used_rag: usedRag, estilo: estilo })
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
    moverSessaoParaPasta: async (sessionId, folderId) => DB._patchSessao(sessionId, { folder_id: folderId || null }),

    // ----- Pastas do histórico -----
    listarPastas: async () => {
        if (!DB.user) return [];
        try {
            const r = await fetch(`${API_BASE_URL}/api/folders?user_id=${encodeURIComponent(DB.user.id)}`);
            if (!r.ok) return [];
            return await r.json();
        } catch (e) { return []; }
    },
    criarPasta: async (nome) => {
        if (!DB.user) return null;
        try {
            const r = await fetch(`${API_BASE_URL}/api/folders`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: DB.user.id, name: nome })
            });
            if (!r.ok) return null;
            return await r.json();
        } catch (e) { return null; }
    },
    renomearPasta: async (folderId, nome) => {
        try {
            await fetch(`${API_BASE_URL}/api/folders/${folderId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: nome })
            });
        } catch (e) {}
    },
    deletarPasta: async (folderId) => {
        try { await fetch(`${API_BASE_URL}/api/folders/${folderId}`, { method: 'DELETE' }); } catch (e) {}
    },

    // ----- Preferências / memória de personalização -----
    obterPrefs: async () => {
        if (!DB.user) return { memory_enabled: false, memory_ready: false, memory_text: '' };
        try {
            const r = await fetch(`${API_BASE_URL}/api/prefs?user_id=${encodeURIComponent(DB.user.id)}`);
            if (!r.ok) return { memory_enabled: false, memory_ready: false, memory_text: '' };
            return await r.json();
        } catch (e) { return { memory_enabled: false, memory_ready: false, memory_text: '' }; }
    },
    salvarPrefs: async (campos) => {
        if (!DB.user) return null;
        try {
            const r = await fetch(`${API_BASE_URL}/api/prefs`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({ user_id: DB.user.id }, campos))
            });
            if (!r.ok) return null;
            return await r.json();
        } catch (e) { return null; }
    },
    atualizarMemoria: async () => {
        if (!DB.user) return null;
        try {
            const r = await fetch(`${API_BASE_URL}/api/memory/refresh`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: DB.user.id })
            });
            if (!r.ok) return null;
            return await r.json();
        } catch (e) { return null; }
    },
    atualizarConta: async (campos) => {
        if (!DB.user) return { error: 'sem_usuario' };
        try {
            const r = await fetch(`${API_BASE_URL}/api/account/update`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({ user_id: DB.user.id }, campos))
            });
            return await r.json();
        } catch (e) { return { error: 'conexao' }; }
    },

    // Registra um ajuste do usuario (RAG/memoria/estilo) para o historico do admin
    registrarAtividade: async (tipo, detalhe) => {
        if (!DB.user) return;
        try {
            await fetch(`${API_BASE_URL}/api/activity`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: DB.user.id, tipo: tipo, detalhe: detalhe })
            });
        } catch (e) {}
    }
};

window.DB = DB;
