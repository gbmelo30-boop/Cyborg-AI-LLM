// ==============================================================================
// BANCO DE DADOS
// ==============================================================================
const DB = {
    user: null,
    isGuest: false,

    init: async () => {
        const _supabase = supabase.createClient(
            "https://mrjjbrrypieviykakmby.supabase.co",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yampicnJ5cGlldml5a2FrbWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MTU4OTIsImV4cCI6MjA4NTI5MTg5Mn0.mldEk-7-vU0BdwlNf5COG_Dj9sRnFWrpQMkqTAZNw_8"
        );
        window.supabaseClient = _supabase;

        const { data } = await _supabase.auth.getSession();
        if (data.session) {
            DB.user = data.session.user;
            DB.isGuest = false;
            window.systemLog(`Usuário reconectado: ${DB.user.email}`);
            return true;
        }
        return false;
    },

    login: async (email, password) => {
        try {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            DB.user = data.user;
            DB.isGuest = false;
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    signup: async (email, password) => {
        try {
            const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
            if (error) throw error;
            return { success: true, msg: "Conta criada!" };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    entrarComoConvidado: async () => {
        DB.user = { id: crypto.randomUUID(), email: 'anonimo@pesquisa.guest' };
        DB.isGuest = true;
        window.systemLog("Entrou como Convidado.");
        return { success: true };
    },

    logout: async () => { /* Implementado na UI */ },

    criarSessao: async (primeiraMensagem) => {
        if (!DB.user) return null;
        const titulo = primeiraMensagem.length > 30 ? primeiraMensagem.substring(0, 30) + "..." : primeiraMensagem;
        const context = JSON.parse(localStorage.getItem('cyborg_current_session')) || {};

        const { data, error } = await window.supabaseClient
            .from('chat_sessions')
            .insert([{ 
                user_id: DB.user.id, 
                title: titulo,
                grupo: context.group || 'Individual/Visitante',
                tema: context.topic || 'Geral'
            }])
            .select()
            .single();

        if (error) { window.systemLog("Erro criarSessao: " + error.message, "ERRO"); return null; }
        return data;
    },

    salvarMensagem: async (sessionId, role, content) => {
        const { error } = await window.supabaseClient
            .from('chat_messages')
            .insert([{ session_id: sessionId, role: role, content: content }]);
        if (error) window.systemLog(`Erro salvarMensagem: ${error.message}`, "ERRO");
    },

    carregarHistorico: async (sessionId) => {
        const { data, error } = await window.supabaseClient
            .from('chat_messages')
            .select('role, content')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });
        if (error) return [];
        return data;
    },

    listarSessoes: async () => {
        if (!DB.user) return [];
        const { data, error } = await window.supabaseClient
            .from('chat_sessions')
            .select('*')
            .eq('user_id', DB.user.id)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) { window.systemLog("Erro listarSessoes: " + error.message, "ERRO"); return []; }
        return data;
    },

    deletarSessao: async (sessionId) => {
        const { error } = await window.supabaseClient.from('chat_sessions').delete().eq('id', sessionId);
        if (error) window.systemLog("Erro deletarSessao: " + error.message, "ERRO");
    },

    renomearSessao: async (sessionId, novoTitulo) => {
        const { error } = await window.supabaseClient.from('chat_sessions').update({ title: novoTitulo }).eq('id', sessionId);
        if (error) window.systemLog("Erro renomear: " + error.message, "ERRO");
    },

    fixarSessao: async (sessionId, statusAtual) => {
        const { error } = await window.supabaseClient.from('chat_sessions').update({ is_pinned: !statusAtual }).eq('id', sessionId);
        if (error) window.systemLog("Erro fixar: " + error.message, "ERRO");
    }
};

DB.init();
window.DB = DB;
