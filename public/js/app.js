// ==============================================================================
// LÓGICA DE INTERFACE, ANIMAÇÕES E EVENTOS (UI)
// ==============================================================================
const BOT_NAME = 'Cyborg AI';
let currentSessionId = null;
let isProcessing = false;

// --- CARROSSEL E MODAIS ---
let slideIndex = 1;
window.changeSlide = function(n) { showSlides(slideIndex += n); };
window.currentSlide = function(n) { showSlides(slideIndex = n); };

function showSlides(n) {
    let i;
    let slides = document.getElementsByClassName("slide");
    let indicator = document.getElementById("slide-indicator");
    let btnPrev = document.getElementById("btn-prev");
    let btnNext = document.getElementById("btn-next");
    if(!slides.length) return;
    if (n > slides.length) {slideIndex = 1}
    if (n < 1) {slideIndex = slides.length}
    for (i = 0; i < slides.length; i++) { slides[i].classList.remove("active"); }
    slides[slideIndex-1].classList.add("active");
    if(indicator) indicator.innerText = slideIndex + " / " + slides.length;
    if(btnPrev) btnPrev.disabled = (slideIndex === 1);
    if(btnNext) {
        btnNext.innerText = (slideIndex === slides.length) ? "Fechar" : "Próximo >";
        btnNext.onclick = (slideIndex === slides.length) ? function(){ window.closeModal('modal-instrucoes') } : function(){ window.changeSlide(1) };
    }
}

window.openModal = (id) => {
    const modal = document.getElementById(id);
    if(modal) { 
        modal.classList.add('active'); 
        if(id === 'modal-historico') carregarListaSessoes(); 
        if(id === 'modal-instrucoes') showSlides(1); 
    }
};
window.closeModal = (id) => { document.getElementById(id).classList.remove('active'); };

// --- NAVEGAÇÃO DE TELAS ---
window.switchView = function(viewIdToShow) {
    const views = ['view-intro', 'view-auth', 'view-chat'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        if (id === viewIdToShow) {
            el.classList.remove('hidden-view');
            requestAnimationFrame(() => { el.classList.add('active-view'); });
        } else {
            el.classList.remove('active-view');
            el.classList.add('hidden-view');
        }
    });
};
window.voltarParaIntro = function() { window.switchView('view-intro'); };
window.irParaLogin = function(event) { if(event) event.preventDefault(); window.switchView('view-auth'); };
window.irParaChat = function() {
    window.switchView('view-chat');
    const historyDiv = document.getElementById('chat-history');
    if(historyDiv && historyDiv.innerHTML.trim() === '') {
        addMessage(BOT_NAME, "Olá! Sou o Cyborg AI. Como posso ajudar?");
    }
};

// --- LÓGICA DE IDENTIFICAÇÃO PARA PESQUISA ---
window.handleStartResearch = async () => {
    const group = document.getElementById('research-group').value;
    const topic = document.getElementById('research-topic').value;
    const errorDiv = document.getElementById('error-message');

    if (!group || !topic) {
        errorDiv.innerText = "Selecione o grupo/uso e o tema antes de continuar.";
        errorDiv.style.display = 'block';
        return;
    }

    errorDiv.style.display = 'none';
    const btn = document.querySelector('.btn-start-research');
    btn.innerText = "CONFIGURANDO...";

    try {
        let sessionData = JSON.parse(localStorage.getItem('cyborg_current_session'));
        
        if (!sessionData || sessionData.group !== group || sessionData.topic !== topic) {
            const anonymousId = crypto.randomUUID();
            const anonEmail = `anonimo_${group.replace(/\s+/g, '')}@pesquisa.ic`;

            sessionData = {
                userId: anonymousId,
                group: group,
                topic: topic,
                email: anonEmail
            };
            localStorage.setItem('cyborg_current_session', JSON.stringify(sessionData));
        }

        if (typeof DB !== 'undefined') {
            DB.user = { id: sessionData.userId, email: sessionData.email };
            DB.isGuest = true;
            window.currentResearchContext = { group: sessionData.group, topic: sessionData.topic };
        }

        window.systemLog(`Sessão Iniciada: ${sessionData.group} | ${sessionData.topic}`);
        if (window.irParaChat) window.irParaChat();

    } catch (e) {
        errorDiv.innerText = "Erro ao inicializar: " + e.message;
        errorDiv.style.display = 'block';
    } finally {
        btn.innerText = "INICIAR";
    }
};

// --- LOGOUT E HISTÓRICO ---
window.handleLogout = async () => {
    if(typeof DB !== 'undefined' && DB.logout) {
        if(window.supabaseClient) await window.supabaseClient.auth.signOut();
        DB.user = null;
    }
    document.getElementById('chat-history').innerHTML = '';
    currentSessionId = null;
    document.getElementById('side-panel').classList.remove('is-open');
    window.switchView('view-auth');
};

window.abrirHistorico = function() { window.openModal('modal-historico'); };

window.carregarListaSessoes = async () => {
    if(typeof DB === 'undefined') return;
    const listDiv = document.getElementById('history-list');
    listDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Carregando...</div>';
    const sessoes = await DB.listarSessoes();
    listDiv.innerHTML = '';
    if (!sessoes || sessoes.length === 0) {
        listDiv.innerHTML = '<div style="padding:20px; text-align:center; opacity:0.5; font-size:0.8em;">Nenhuma conversa salva.</div>';
        return;
    }
    const termoBusca = document.getElementById('history-search').value.toLowerCase();
    sessoes.forEach(sess => {
        if(termoBusca && !sess.title.toLowerCase().includes(termoBusca)) return;
        const item = document.createElement('div');
        item.className = `history-item ${sess.id === currentSessionId ? 'active-chat' : ''}`;
        const pinIcon = sess.is_pinned
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z"/></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z"/></svg>';
        item.innerHTML = `
            <span class="history-title" onclick="carregarSessao('${sess.id}')" title="${sess.title}">${sess.title}</span>
            <div class="history-actions">
                <button class="btn-icon-hist btn-pin ${sess.is_pinned ? 'pinned' : ''}" onclick="togglePin('${sess.id}', ${sess.is_pinned})" title="Fixar">
                    ${pinIcon}
                </button>
                <button class="btn-icon-hist" onclick="renomearConversa('${sess.id}', '${sess.title}')" title="Renomear">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-icon-hist btn-delete" onclick="deletarSessao('${sess.id}')" title="Excluir">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        listDiv.appendChild(item);
    });
};

window.carregarSessao = async (id) => {
    currentSessionId = id;
    document.getElementById('chat-history').innerHTML = '';
    window.toggleSidebar();
    window.closeModal('modal-historico');
    const msgs = await DB.carregarHistorico(id);
    if (msgs && msgs.length > 0) {
        msgs.forEach(msg => {
            const isBot = msg.role === 'assistant';
            const content = isBot && typeof marked !== 'undefined' ? marked.parse(msg.content) : msg.content;
            addMessage(isBot ? BOT_NAME : "Você", content, isBot);
        });
    }
};

window.novaConversa = () => {
    currentSessionId = null;
    document.getElementById('chat-history').innerHTML = '';
    addMessage(BOT_NAME, "Olá! Sou o Cyborg AI. Como posso ajudar?");
    window.toggleSidebar();
};

window.filtrarHistorico = () => { carregarListaSessoes(); }
window.togglePin = async (id, status) => { await DB.fixarSessao(id, status); carregarListaSessoes(); };
window.renomearConversa = async (id, atual) => {
    const novo = prompt("Novo nome:", atual);
    if(novo && novo.trim() !== "") { await DB.renomearSessao(id, novo.trim()); carregarListaSessoes(); }
};
window.deletarSessao = async (id) => {
    if(confirm("Excluir conversa?")) { await DB.deletarSessao(id); if(currentSessionId === id) novaConversa(); carregarListaSessoes(); }
};

// --- INTERFACE DO CHAT ---
window.toggleSidebar = () => { document.getElementById('side-panel').classList.toggle('is-open'); };
window.toggleInputSize = () => {
    const form = document.getElementById('chat-form');
    const btn = document.getElementById('expand-button');
    const isExpanded = form.classList.toggle('expanded');
    const input = document.getElementById('user-input');
    if (isExpanded) {
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5h2z"/></svg>';
        input.style.height = '100%';
    } else {
        btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3zM9 21l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6zM21 15l-2.3 2.3-2.87-2.89-1.42 1.42L17.3 18.7 15 21h6z"/></svg>';
        input.style.height = '54px';
    }
};

window.alternarTemaGlobal = () => {
    document.body.classList.toggle('light-theme');
    localStorage.setItem('cyborgTheme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
};

window.addMessage = function(author, content, isHtml = false, timestamp = null) {
    const historyDiv = document.getElementById('chat-history');
    if(!historyDiv) return;

    const threshold = 100;
    const isNearBottom = historyDiv.scrollHeight - historyDiv.scrollTop - historyDiv.clientHeight <= threshold;
    const isUser = author === "Você";
    const isBot = author === BOT_NAME;
    const timeDisplay = timestamp ? new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    const container = document.createElement('div');
    container.className = `message-container ${isBot ? 'bot-container' : 'user-container'}`;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'message-meta';
    const iconHtml = isBot ? '<div class="header-halo" style="width:12px;height:12px;margin:0;"></div>' : '<div style="width:12px;height:12px;background:#ccc;border-radius:50%;"></div>';
    metaDiv.innerHTML = `${iconHtml} <span>${author}</span>`;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble fade-in';

    if (isHtml) bubbleDiv.innerHTML = content;
    else bubbleDiv.textContent = content;

    const timeDiv = document.createElement('span');
    timeDiv.className = 'message-time';
    timeDiv.innerText = timeDisplay;
    bubbleDiv.appendChild(timeDiv);

    container.appendChild(metaDiv);
    container.appendChild(bubbleDiv);
    historyDiv.appendChild(container);

    if (isUser || isNearBottom) {
        historyDiv.scrollTop = historyDiv.scrollHeight;
    }
};

window.handleChatSubmit = async (e) => {
    if(e) e.preventDefault();
    if (isProcessing) return;

    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-button');
    const chatForm = document.getElementById('chat-form');
    const historyDiv = document.getElementById('chat-history');

    const text = userInput.value.trim();
    if (!text) return;

    userInput.value = '';
    if(chatForm.classList.contains('expanded')) window.toggleInputSize();

    addMessage("Você", text, false);

    isProcessing = true;
    sendBtn.innerHTML = '<span style="font-size:20px; animation:spin 1s infinite">↻</span>';

    const loaderId = 'loader-' + Date.now();
    const loaderDiv = document.createElement('div');
    loaderDiv.id = loaderId;
    loaderDiv.className = 'message-container bot-container';

    loaderDiv.innerHTML = `
        <div class="message-meta"><span>${BOT_NAME}</span></div>
        <div class="message-bubble fade-in">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    historyDiv.appendChild(loaderDiv);
    historyDiv.scrollTop = historyDiv.scrollHeight;

    if(typeof CYBORG !== 'undefined') {
        const resultado = await CYBORG.enviarMensagem(text, currentSessionId);

        const loaderEl = document.getElementById(loaderId);
        if(loaderEl) loaderEl.remove();

        isProcessing = false;
        sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

        if (resultado && resultado.response) {
            if (resultado.sessionId) currentSessionId = resultado.sessionId;
            const htmlContent = typeof marked !== 'undefined' ? marked.parse(resultado.response) : resultado.response;
            addMessage(BOT_NAME, htmlContent, true);
        } else {
            addMessage(BOT_NAME, "Erro ao processar mensagem (API Limit).", false);
        }
    }
};

// ==============================================================================
// EVENT LISTENERS GERAIS (Animação de Loading e Tema)
// ==============================================================================
$(document).ready(function() {
    const themeSwitcher = document.getElementById('theme-switcher');
    const body = document.body;

    const applySavedTheme = () => {
        const savedTheme = localStorage.getItem('cyborgTheme');
        if (savedTheme === 'light' || (!savedTheme && window.matchMedia('(prefers-color-scheme: light)').matches)) {
            body.classList.add('light-theme');
        }
    };

    const toggleTheme = () => {
        body.classList.toggle('light-theme');
        const currentTheme = body.classList.contains('light-theme') ? 'light' : 'dark';
        localStorage.setItem('cyborgTheme', currentTheme);
    };

    if (themeSwitcher) themeSwitcher.addEventListener('click', toggleTheme);
    applySavedTheme();

    const loadingSequence = document.getElementById('loading-sequence');
    const startButton = document.getElementById('start-button');

    setTimeout(() => {
        if (loadingSequence) loadingSequence.classList.add('fade-out');
        setTimeout(() => {
            if (startButton) startButton.classList.add('fade-in');
        }, 300);
    }, 4000);
});

document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('user-input');
    if(userInput) {
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.handleChatSubmit(e); }
        });
        userInput.addEventListener('focus', () => {
            setTimeout(() => {
                window.scrollTo(0, 0);
                document.body.scrollTop = 0;
            }, 300);
        });
    }
});

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        const chatView = document.getElementById('view-chat');
        if (chatView && chatView.classList.contains('active-view')) {
            chatView.style.height = `${window.visualViewport.height}px`;
            
            const historyDiv = document.getElementById('chat-history');
            if (historyDiv) {
                historyDiv.scrollTop = historyDiv.scrollHeight;
            }
        }
    });
}
