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
        statusLabel.innerText = window.T ? window.T("on") : "ATIVADO";
        statusLabel.style.color = "#00ff00";
        window.systemLog("RAG Ativado pelo usuário.");
    } else {
        statusLabel.innerText = window.T ? window.T("off") : "DESATIVADO";
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
        btnNext.innerText = (slideIndex === slides.length) ? (window.T ? window.T("btn_close") : "Fechar") : (window.T ? window.T("btn_next") : "Próximo >");
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
window.gsapSwitch = function(fromId, toId, kind, onDone) {
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);
    if (!toEl) { if (onDone) onDone(); return; }

    // Sem GSAP disponível: mantém o comportamento antigo
    if (typeof gsap === 'undefined') { window.switchView(toId); if (onDone) onDone(); return; }
    if (window.__viewAnimating) return;

    window.__viewAnimating = true;
    toEl.classList.remove('hidden-view');
    toEl.classList.add('active-view');
    // Desliga transições CSS concorrentes durante a animação GSAP
    gsap.set([fromEl, toEl].filter(Boolean), { transition: 'none' });

    const finish = () => {
        if (fromEl && fromId !== toId) {
            fromEl.classList.remove('active-view');
            fromEl.classList.add('hidden-view');
            gsap.set(fromEl, { clearProps: 'opacity,transform,transition,zIndex,willChange' });
        }
        gsap.set(toEl, { clearProps: 'opacity,transform,transition,zIndex,willChange' });
        document.body.style.perspective = '';
        window.__viewAnimating = false;
        if (onDone) onDone();
    };

    const tl = gsap.timeline({ onComplete: finish });

    if (kind === 'depth-3d') {
        // Animação 2 (cadastro -> chat): leve profundidade 3D, elementos "chegando de trás"
        document.body.style.perspective = '1400px';
        gsap.set(toEl,   { opacity: 0, z: -460, rotationX: 7, transformOrigin: '50% 55%', zIndex: 300, willChange: 'transform,opacity' });
        if (fromEl) gsap.set(fromEl, { zIndex: 200, willChange: 'transform,opacity' });
        if (fromEl) tl.to(fromEl, { opacity: 0, z: 220, rotationX: -5, duration: 0.55, ease: 'power2.in' }, 0);
        tl.to(toEl, { opacity: 1, z: 0, rotationX: 0, duration: 0.9, ease: 'power3.out' }, 0.22);
    } else {
        // Animação 1 (intro -> cadastro): simples e elegante (fade + leve deslize/escala)
        gsap.set(toEl, { opacity: 0, y: 26, scale: 0.985, zIndex: 300, willChange: 'transform,opacity' });
        if (fromEl) tl.to(fromEl, { opacity: 0, y: -16, scale: 1.012, duration: 0.5, ease: 'power2.inOut' }, 0);
        tl.to(toEl, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out' }, 0.12);
    }
};

window.voltarParaIntro = function() { window.switchView('view-intro'); };
window.irParaLogin = function(event) { if(event) event.preventDefault(); window.gsapSwitch('view-intro', 'view-auth', 'fade-elegant'); };
window.irParaChat = function() {
    const mostrarSaudacao = () => {
        const historyDiv = document.getElementById('chat-history');
        if(historyDiv && historyDiv.innerHTML.trim() === '') {
            const ctx       = JSON.parse(localStorage.getItem('cyborg_current_session') || '{}');
            const firstName = ctx.userName || '';
            const greeting  = getGreeting(firstName);
            window.mostrarBoasVindas(window.saudacao(firstName));
        }
    };
    window.gsapSwitch('view-auth', 'view-chat', 'depth-3d', mostrarSaudacao);
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
        errorDiv.innerText = window.T ? window.T("name_required") : "Digite seu nome para continuar.";
        errorDiv.style.display = 'block';
        if (nameInput) nameInput.focus();
        return;
    }

    errorDiv.style.display = 'none';
    const btn = document.querySelector('.btn-start-research');
    btn.innerText = "ENTRANDO...";

    try {
        const anonymousId = window.gerarUUID();
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
        await DB.logout();
        DB.user = null;
    }
    document.getElementById('chat-history').innerHTML = '';
    if (window.esconderBoasVindas) window.esconderBoasVindas();
    currentSessionId = null;
    document.getElementById('side-panel').classList.remove('is-open');
    window.switchView('view-auth');
};

window.abrirHistorico = function() { window.openModal('modal-historico'); };

window.carregarListaSessoes = async () => {
    if(typeof DB === 'undefined') return;
    const listDiv = document.getElementById('history-list');
    listDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">' + (window.T ? window.T("loading_word") : "Carregando...") + '</div>';
    const sessoes = await DB.listarSessoes();
    listDiv.innerHTML = '';
    if (!sessoes || sessoes.length === 0) {
        listDiv.innerHTML = '<div style="padding:20px; text-align:center; opacity:0.5; font-size:0.8em;">' + (window.T ? window.T("hist_empty") : "Nenhuma conversa salva.") + '</div>';
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
    if (window.esconderBoasVindas) window.esconderBoasVindas();
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
    const ctx       = JSON.parse(localStorage.getItem('cyborg_current_session') || '{}');
    const firstName = ctx.userName || '';
    const greeting  = getGreeting(firstName);
    window.mostrarBoasVindas(window.saudacao(firstName));
    window.toggleSidebar();
};

window.filtrarHistorico = () => { carregarListaSessoes(); }
window.togglePin = async (id, status) => { await DB.fixarSessao(id, status); carregarListaSessoes(); };
window.renomearConversa = async (id, atual) => {
    const novo = prompt(window.T ? window.T("rename_prompt") : "Novo nome:", atual);
    if(novo && novo.trim() !== "") { await DB.renomearSessao(id, novo.trim()); carregarListaSessoes(); }
};
window.deletarSessao = async (id) => {
    if(confirm(window.T ? window.T("confirm_delete") : "Excluir conversa?")) { await DB.deletarSessao(id); if(currentSessionId === id) novaConversa(); carregarListaSessoes(); }
};

// --- INTERFACE DO CHAT ---
window.toggleSidebar = () => { document.getElementById('side-panel').classList.toggle('is-open'); };
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
        ? `<svg class="header-halo" style="width:16px;height:16px;" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" fill="none" stroke-width="2.2" stroke-linecap="round" transform="rotate(-90 10 10)"/></svg>`
        : `<div style="width:12px;height:12px;background:var(--secondary-text-color);border-radius:50%;opacity:0.7;"></div>`;
    metaDiv.innerHTML = `${iconHtml} <span>${(isUser && window.T) ? window.T('you') : author}</span>`;

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

    if (window.__welcomeActive) window.encerrarBoasVindas();

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
                    stroke-linecap="round"
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
                addMessage(BOT_NAME, window.T ? window.T("error_neural") : "Minhas redes neurais sentiram um distúrbio. Tente novamente.", false);
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
            if (e.key !== 'Enter' || e.isComposing) return;
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                // Ctrl/Cmd/Shift + Enter -> quebra de linha
                e.preventDefault();
                const el = e.target;
                const ini = el.selectionStart, fim = el.selectionEnd;
                el.value = el.value.slice(0, ini) + '\n' + el.value.slice(fim);
                el.selectionStart = el.selectionEnd = ini + 1;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                el.scrollTop = el.scrollHeight;
            } else {
                // Enter puro -> enviar (desktop e celular)
                e.preventDefault();
                window.handleChatSubmit(e);
            }
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


// Aplica a config global do servidor (ex.: RAG ligado por padrão) no carregamento
async function aplicarConfigServidor() {
    try {
        const r = await fetch(`${API_BASE_URL}/api/config`);
        if (!r.ok) return;
        const cfg = await r.json();
        window.useRag = !!cfg.rag_padrao;
        const chk = document.getElementById('rag-toggle');
        const st = document.getElementById('rag-status');
        if (chk) chk.checked = window.useRag;
        if (st) { st.innerText = window.useRag ? (window.T ? window.T('on') : 'ATIVADO') : (window.T ? window.T('off') : 'DESATIVADO'); st.style.color = window.useRag ? '#00ff00' : '#ff4444'; }
    } catch (e) {}
}
document.addEventListener('DOMContentLoaded', aplicarConfigServidor);


// ===================== Painel admin (modal in-app) =====================
let __adminSenha = "";
const __ADMIN_EYE_ON = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12.5a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z"/>';
const __ADMIN_EYE_OFF = '<path d="M12 7a5 5 0 015 5c0 .64-.13 1.25-.36 1.82l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.74C21.27 7.61 17 4.5 12 4.5c-1.4 0-2.74.25-3.98.7l2.16 2.16c.57-.23 1.18-.36 1.82-.36zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65a3 3 0 003 3c.22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53a5 5 0 01-5-5c0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16a3 3 0 00-3-3l-.17.01z"/>';

window.abrirAdmin = function() {
    __adminSenha = "";
    const pw = document.getElementById('admin-pw'); if (pw) { pw.value = ""; pw.type = "password"; }
    const eye = document.getElementById('admin-eye-svg'); if (eye) eye.innerHTML = __ADMIN_EYE_ON;
    const err = document.getElementById('admin-err'); if (err) err.innerText = "";
    document.getElementById('admin-panel').classList.add('hidden-admin');
    const sv = document.getElementById('admin-stats-view'); if (sv) sv.classList.add('hidden-admin');
    const mv = document.getElementById('admin-messages-view'); if (mv) mv.classList.add('hidden-admin');
    document.getElementById('admin-gate').classList.remove('hidden-admin');
    if (window.closeModal) window.closeModal('modal-config');
    window.openModal('modal-admin');
    if (pw) setTimeout(() => pw.focus(), 120);
};

window.adminVoltar = function() {
    const msgs = document.getElementById('admin-messages-view');
    const stats = document.getElementById('admin-stats-view');
    if (msgs && !msgs.classList.contains('hidden-admin')) {
        msgs.classList.add('hidden-admin');
        stats.classList.remove('hidden-admin');
        return;
    }
    if (stats && !stats.classList.contains('hidden-admin')) {
        stats.classList.add('hidden-admin');
        document.getElementById('admin-panel').classList.remove('hidden-admin');
        return;
    }
    window.closeModal('modal-admin');
};

window.adminToggleSenha = function() {
    const inp = document.getElementById('admin-pw');
    const mostrando = inp.type === 'text';
    inp.type = mostrando ? 'password' : 'text';
    document.getElementById('admin-eye-svg').innerHTML = mostrando ? __ADMIN_EYE_ON : __ADMIN_EYE_OFF;
};

async function __adminApi(path, body) {
    return fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function __adminStats(st) {
    if (!st) return;
    document.getElementById('admin-s-sessoes').innerText = st.sessoes;
    document.getElementById('admin-s-mensagens').innerText = st.mensagens;
    document.getElementById('admin-s-docs').innerText = st.documentos;
}
function __adminPintar(d) {
    document.getElementById('admin-t-gravar').checked = !!d.config.gravar_no_bd;
    document.getElementById('admin-t-rag').checked = !!d.config.rag_padrao;
    __adminStats(d.stats);
}

window.adminEntrar = async function() {
    __adminSenha = document.getElementById('admin-pw').value;
    const err = document.getElementById('admin-err'); err.innerText = "";
    try {
        const r = await __adminApi('/api/admin/settings', { password: __adminSenha });
        const data = await r.json().catch(() => ({}));
        if (r.ok) {
            document.getElementById('admin-gate').classList.add('hidden-admin');
            document.getElementById('admin-panel').classList.remove('hidden-admin');
            __adminPintar(data);
        } else if (r.status === 401) { err.innerText = "Senha incorreta."; }
        else { err.innerText = data.error || "Erro ao acessar o painel."; }
    } catch (e) { err.innerText = "Erro de conexão."; }
};

window.adminSalvar = async function(chave, valor) {
    const t = document.getElementById('admin-toast'); t.innerText = "Salvando...";
    try {
        const r = await __adminApi('/api/admin/settings', { password: __adminSenha, updates: { [chave]: valor } });
        const data = await r.json().catch(() => ({}));
        if (r.ok) { __adminPintar(data); t.innerText = "Salvo \u2713"; setTimeout(() => t.innerText = "", 1500); }
        else t.innerText = "Falha ao salvar.";
    } catch (e) { t.innerText = "Erro ao salvar."; }
};

window.adminBaixarCSV = async function() {
    const t = document.getElementById('admin-toast'); t.innerText = "Gerando CSV...";
    try {
        const r = await __adminApi('/api/admin/export', { password: __adminSenha });
        if (!r.ok) { t.innerText = "Falha ao gerar o CSV."; return; }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'historico_cyborg.csv';
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        t.innerText = "Download iniciado \u2713"; setTimeout(() => t.innerText = "", 2000);
    } catch (e) { t.innerText = "Erro ao baixar."; }
};

window.adminApagar = async function() {
    if (!confirm('Apagar TODAS as sessões e mensagens do banco? Esta ação não pode ser desfeita.')) return;
    const t = document.getElementById('admin-toast'); t.innerText = "Apagando...";
    try {
        const r = await __adminApi('/api/admin/clear_history', { password: __adminSenha });
        const data = await r.json().catch(() => ({}));
        if (r.ok) { __adminStats(data.stats); t.innerText = "Histórico apagado \u2713"; setTimeout(() => t.innerText = "", 2000); }
        else t.innerText = data.error || "Falha ao apagar.";
    } catch (e) { t.innerText = "Erro ao apagar."; }
};

// Acesso pela URL secreta: admin.html redireciona para index.html?admin=1
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (new URLSearchParams(location.search).get('admin') === '1') {
            window.switchView('view-chat');
            setTimeout(() => window.abrirAdmin(), 300);
        }
    } catch (e) {}
});


// ---- Estatísticas e conversas (admin) ----
function __escapeHtml(x) {
    return String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function __adminFmtData(iso) {
    try { return new Date(iso).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
    catch (e) { return iso || ''; }
}

window.adminAbrirStats = async function() {
    document.getElementById('admin-panel').classList.add('hidden-admin');
    document.getElementById('admin-messages-view').classList.add('hidden-admin');
    document.getElementById('admin-stats-view').classList.remove('hidden-admin');
    await adminCarregarSessoes();
};

async function adminCarregarSessoes() {
    const lista = document.getElementById('admin-sessoes-lista');
    lista.innerHTML = '<div class="admin-empty">Carregando...</div>';
    try {
        const r = await __adminApi('/api/admin/sessions', { password: __adminSenha });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) { lista.innerHTML = '<div class="admin-empty">Erro ao carregar.</div>'; return; }
        if (data.stats) __adminStats(data.stats);
        const sess = data.sessoes || [];
        if (!sess.length) { lista.innerHTML = '<div class="admin-empty">Nenhuma conversa registrada.</div>'; return; }
        lista.innerHTML = '';
        sess.forEach(sx => {
            const div = document.createElement('div');
            div.className = 'admin-list-item';
            div.onclick = () => adminVerMensagens(sx.id, sx);
            const usuario = sx.user_name || sx.user_id || '—';
            div.innerHTML =
                '<div class="ali-top"><span class="ali-user">' + __escapeHtml(usuario) + '</span>' +
                '<span class="ali-count">' + sx.n_msgs + ' msg</span></div>' +
                '<div class="ali-sub">' + __escapeHtml(sx.grupo || '') + ' \u00b7 ' + __escapeHtml(sx.tema || '') + ' \u00b7 ' + __adminFmtData(sx.created_at) + '</div>' +
                '<div class="ali-title">' + __escapeHtml(sx.title || '') + '</div>';
            lista.appendChild(div);
        });
    } catch (e) { lista.innerHTML = '<div class="admin-empty">Erro de conexão.</div>'; }
}

window.adminVerMensagens = async function(sessionId, sx) {
    document.getElementById('admin-stats-view').classList.add('hidden-admin');
    document.getElementById('admin-messages-view').classList.remove('hidden-admin');
    const usuario = sx ? (sx.user_name || sx.user_id || '—') : '';
    document.getElementById('admin-msg-titulo').innerText = 'Conversa de ' + usuario;
    const lista = document.getElementById('admin-mensagens-lista');
    lista.innerHTML = '<div class="admin-empty">Carregando...</div>';
    try {
        const r = await __adminApi('/api/admin/messages', { password: __adminSenha, session_id: sessionId });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) { lista.innerHTML = '<div class="admin-empty">Erro ao carregar.</div>'; return; }
        const msgs = data.mensagens || [];
        if (!msgs.length) { lista.innerHTML = '<div class="admin-empty">Sem mensagens.</div>'; return; }
        lista.innerHTML = '';
        msgs.forEach(m => {
            const div = document.createElement('div');
            div.className = 'admin-msg ' + (m.role === 'user' ? 'admin-msg-user' : 'admin-msg-bot');
            div.innerHTML =
                '<div class="am-role">' + (m.role === 'user' ? 'Usuário' : 'Cyborg AI') + ' \u00b7 ' + __adminFmtData(m.created_at) + '</div>' +
                '<div class="am-text">' + __escapeHtml(m.content || '') + '</div>';
            lista.appendChild(div);
        });
    } catch (e) { lista.innerHTML = '<div class="admin-empty">Erro de conexão.</div>'; }
};


// ===================== Tela de boas-vindas do chat (mensagem central) =====================
window.__welcomeActive = false;
window.__welcomeGreeting = '';
window.mostrarBoasVindas = function(texto) {
    const el = document.getElementById('chat-welcome');
    const txt = document.getElementById('chat-welcome-text');
    if (!el || !txt) { if (typeof addMessage === 'function') addMessage(BOT_NAME, texto); return; }
    window.__welcomeGreeting = texto;
    txt.textContent = texto;
    el.classList.add('active');
    window.__welcomeActive = true;
    if (typeof gsap !== 'undefined') {
        gsap.fromTo(el, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' });
    }
};
window.encerrarBoasVindas = function() {
    if (!window.__welcomeActive) return;
    window.__welcomeActive = false;
    const el = document.getElementById('chat-welcome');
    if (window.__welcomeGreeting) addMessage(BOT_NAME, window.__welcomeGreeting, false);
    if (el) {
        if (typeof gsap !== 'undefined') {
            gsap.to(el, { opacity: 0, y: -16, duration: 0.35, ease: 'power2.in', onComplete: () => { el.classList.remove('active'); gsap.set(el, { clearProps: 'all' }); } });
        } else { el.classList.remove('active'); }
    }
};
window.esconderBoasVindas = function() {
    window.__welcomeActive = false;
    const el = document.getElementById('chat-welcome');
    if (el) { el.classList.remove('active'); if (typeof gsap !== 'undefined') gsap.set(el, { clearProps: 'all' }); }
};
