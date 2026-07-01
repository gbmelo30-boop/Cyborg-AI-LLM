// ==============================================================================
// LÓGICA DE INTERFACE, ANIMAÇÕES E EVENTOS (UI)
// ==============================================================================
const BOT_NAME = 'Cyborg AI';
let currentSessionId = null;
let isProcessing = false;

// --- CONTROLE DO RAG (biblioteca de PDFs) — exclusivo da versão LLM ---
window.useRag = false;
window.toggleRag = (checkbox) => {
    window.useRag = checkbox.checked;
    const statusLabel = document.getElementById('rag-status');
    if (!statusLabel) return;
    if (window.useRag) {
        statusLabel.innerText = "ATIVADO";
        statusLabel.style.color = "#00ff00";
        window.systemLog("RAG Ativado pelo usuário.");
    } else {
        statusLabel.innerText = "DESATIVADO";
        statusLabel.style.color = "#ff4444";
        window.systemLog("RAG Desativado pelo usuário.");
    }
};

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
        const ctx       = JSON.parse(localStorage.getItem('cyborg_current_session') || '{}');
        const firstName = ctx.userName || '';
        const greeting  = getGreeting(firstName);
        addMessage(BOT_NAME, `${greeting} Sou o Cyborg AI, como posso ajudá-lo?`);
    }
};

function getGreeting(firstName) {
    const hour = new Date().getHours();
    let period;
    if (hour >= 5 && hour < 12)       period = 'Bom dia';
    else if (hour >= 12 && hour < 18) period = 'Boa tarde';
    else                               period = 'Boa noite';
    return firstName ? `${period}, ${firstName}!` : `${period}!`;
}

function capitalizeName(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function typewriterEffect(element, text) {
    const msPerChar = Math.max(3, Math.min(20, 2400 / text.length));
    return new Promise(resolve => {
        let i = 0;
        element.textContent = '';
        element.classList.add('typing-cursor');
        const tick = () => {
            if (i < text.length) {
                element.textContent += text[i++];
                const hist = document.getElementById('chat-history');
                if (hist) hist.scrollTop = hist.scrollHeight;
                setTimeout(tick, msPerChar);
            } else {
                element.classList.remove('typing-cursor');
                resolve();
            }
        };
        tick();
    });
}

window.handleStartResearch = async () => {
    const nameInput = document.getElementById('user-name-input');
    const errorDiv  = document.getElementById('error-message');
    const rawName   = nameInput ? nameInput.value.trim() : '';
    const firstName = rawName ? capitalizeName(rawName.split(/\s+/)[0]) : '';

    if (!firstName) {
        errorDiv.innerText = "Digite seu nome para continuar.";
        errorDiv.style.display = 'block';
        if (nameInput) nameInput.focus();
        return;
    }

    errorDiv.style.display = 'none';
    const btn = document.querySelector('.btn-start-research');
    btn.innerText = "ENTRANDO...";

    try {
        const anonymousId = crypto.randomUUID();
        const anonEmail   = `anonimo_${firstName.toLowerCase()}@pesquisa.ic`;

        const sessionData = {
            userId:   anonymousId,
            userName: firstName,
            group:    'Individual/Visitante',
            topic:    'Geral',
            email:    anonEmail
        };
        localStorage.setItem('cyborg_current_session', JSON.stringify(sessionData));

        if (typeof DB !== 'undefined') {
            DB.user    = { id: sessionData.userId, email: sessionData.email };
            DB.isGuest = true;
            window.currentResearchContext = {
                group:    sessionData.group,
                topic:    sessionData.topic,
                userName: sessionData.userName
            };
        }

        window.systemLog(`Sessão Iniciada: ${firstName}`);
        if (window.irParaChat) window.irParaChat();

    } catch (e) {
        errorDiv.innerText = "Erro ao inicializar: " + e.message;
        errorDiv.style.display = 'block';
    } finally {
        btn.innerText = "ENTRAR";
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
    window.closeSidebarMobile();
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
    const ctx       = JSON.parse(localStorage.getItem('cyborg_current_session') || '{}');
    const firstName = ctx.userName || '';
    const greeting  = getGreeting(firstName);
    addMessage(BOT_NAME, `${greeting} Sou o Cyborg AI, como posso ajudá-lo?`);
    window.closeSidebarMobile();
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
window.sidebarIsDesktop = () => window.matchMedia('(min-width: 768px)').matches;
window.toggleSidebar = () => {
    if (window.sidebarIsDesktop()) {
        const expanded = document.body.classList.toggle('sidebar-expanded');
        try { localStorage.setItem('cyborgSidebarExpanded', expanded ? '1' : '0'); } catch (e) {}
    } else {
        document.getElementById('side-panel').classList.toggle('is-open');
    }
};
window.closeSidebarMobile = () => { document.getElementById('side-panel').classList.remove('is-open'); };
window.toggleInputSize = () => {
    const form  = document.getElementById('chat-form');
    const btn   = document.getElementById('expand-button');
    const input = document.getElementById('user-input');
    const isExpanded = form.classList.toggle('expanded');
    if (isExpanded) {
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5h2z"/></svg>';
        input.style.minHeight = 'calc(100% - 20px)';
        input.style.maxHeight = 'none';
    } else {
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3zM9 21l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6zM21 15l-2.3 2.3-2.87-2.89-1.42 1.42L17.3 18.7 15 21h6z"/></svg>';
        input.style.minHeight = '36px';
        input.style.maxHeight = '160px';
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
    const iconHtml = isBot
        ? `<svg class="header-halo" style="width:16px;height:16px;" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" fill="none" stroke-width="2.2" stroke-dasharray="14.6 2.2" stroke-linecap="round" transform="rotate(-90 10 10)"/></svg>`
        : `<div style="width:12px;height:12px;background:var(--secondary-text-color);border-radius:50%;opacity:0.7;"></div>`;
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
    const sendBtn   = document.getElementById('send-button');
    const chatForm  = document.getElementById('chat-form');
    const historyDiv = document.getElementById('chat-history');

    const text = userInput.value.trim();
    if (!text) return;

    userInput.value = '';
    if(chatForm.classList.contains('expanded')) window.toggleInputSize();

    addMessage("Você", text, false);

    isProcessing = true;
    sendBtn.innerHTML = '<span style="font-size:18px; animation:spin 1s linear infinite; display:inline-block;">↻</span>';

    const loaderId = 'loader-' + Date.now();
    const loaderDiv = document.createElement('div');
    loaderDiv.id = loaderId;
    loaderDiv.className = 'message-container bot-container';
    loaderDiv.innerHTML = `
        <div class="message-meta">
            <svg class="header-halo led-loading" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="8" fill="none" stroke-width="2.2"
                    stroke-dasharray="14.6 2.2" stroke-linecap="round"
                    transform="rotate(-90 10 10)"/>
            </svg>
            <span>${BOT_NAME}</span>
        </div>
        <div class="message-bubble fade-in" id="${loaderId}-bubble" style="padding:8px 16px; min-height:10px;"></div>
    `;
    historyDiv.appendChild(loaderDiv);
    historyDiv.scrollTop = historyDiv.scrollHeight;

    if(typeof CYBORG !== 'undefined') {
        const resultado = await CYBORG.enviarMensagem(text, currentSessionId);

        isProcessing = false;
        sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

        const loaderEl = document.getElementById(loaderId);
        const bubbleEl = document.getElementById(`${loaderId}-bubble`);
        const ledEl    = loaderEl ? loaderEl.querySelector('.led-loading') : null;

        if (resultado && resultado.response && !resultado.error) {
            if (resultado.sessionId) currentSessionId = resultado.sessionId;

            const rawText   = resultado.response;
            const htmlFinal = typeof marked !== 'undefined' ? marked.parse(rawText) : rawText;

            if (bubbleEl) await typewriterEffect(bubbleEl, rawText);

            if (bubbleEl) {
                bubbleEl.innerHTML = htmlFinal;
                const timeDiv = document.createElement('span');
                timeDiv.className = 'message-time';
                timeDiv.innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                bubbleEl.appendChild(timeDiv);
            }

            if (ledEl) ledEl.classList.add('led-done');

        } else {
            if (ledEl) ledEl.classList.add('led-error');
            setTimeout(() => {
                if(loaderEl) loaderEl.remove();
                addMessage(BOT_NAME, "Minhas redes neurais sentiram um distúrbio. Tente novamente.", false);
            }, 1500);
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

    if (window.sidebarIsDesktop && window.sidebarIsDesktop() && localStorage.getItem('cyborgSidebarExpanded') === '1') {
        document.body.classList.add('sidebar-expanded');
    }

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
