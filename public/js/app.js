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
            let content = isBot && typeof marked !== 'undefined' ? marked.parse(msg.content) : msg.content;
            if (isBot && typeof DOMPurify !== 'undefined') content = DOMPurify.sanitize(content);
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
            <span class="loader-ring-wrap">
                <canvas class="loader-parts" aria-hidden="true"></canvas>
                <svg class="header-halo led-loading" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="8" fill="none" stroke-width="2.2"
                        stroke-linecap="round"
                        transform="rotate(-90 10 10)"/>
                </svg>
            </span>
            <span>${BOT_NAME}</span>
        </div>
        <div class="message-bubble fade-in" id="${loaderId}-bubble" style="padding:8px 16px; min-height:10px;"></div>
    `;
    historyDiv.appendChild(loaderDiv);
    historyDiv.scrollTop = historyDiv.scrollHeight;
    if (window.iniciarRastroLoader) window.iniciarRastroLoader(loaderDiv);

    if(typeof CYBORG !== 'undefined') {
        const resultado = await CYBORG.enviarMensagem(text, currentSessionId);

        isProcessing = false;
        sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

        const loaderEl = document.getElementById(loaderId);
        if (window.pararRastroLoader) window.pararRastroLoader(loaderEl);
        const bubbleEl = document.getElementById(`${loaderId}-bubble`);
        const ledEl    = loaderEl ? loaderEl.querySelector('.led-loading') : null;

        if (resultado && resultado.response && !resultado.error) {
            if (resultado.sessionId) currentSessionId = resultado.sessionId;

            const rawText   = resultado.response;
            let htmlFinal   = typeof marked !== 'undefined' ? marked.parse(rawText) : rawText;
            if (typeof DOMPurify !== 'undefined') htmlFinal = DOMPurify.sanitize(htmlFinal);

            if (bubbleEl) {
                bubbleEl.innerHTML = htmlFinal;
                bubbleEl.classList.remove('fade-in');
                void bubbleEl.offsetWidth;         // reflow p/ reiniciar a animacao
                bubbleEl.classList.add('msg-appear');
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




// ===================== Tela de boas-vindas do chat (mensagem central) =====================
window.__welcomeActive = false;
window.__welcomeGreeting = '';
function __chatCont(){ return document.querySelector('.cyborg-chat-container'); }
window.mostrarBoasVindas = function(texto) {
    const cont = __chatCont();
    const txt = document.getElementById('chat-landing-text');
    if (!cont || !txt) { if (typeof addMessage === 'function') addMessage(BOT_NAME, texto, false); return; }
    window.__welcomeGreeting = texto;
    txt.textContent = texto;
    cont.classList.add('landing');
    window.__welcomeActive = true;
};
window.encerrarBoasVindas = function() {
    if (!window.__welcomeActive) return;
    window.__welcomeActive = false;
    const cont = __chatCont();
    if (cont) cont.classList.remove('landing');
};
window.esconderBoasVindas = function() {
    window.__welcomeActive = false;
    const cont = __chatCont();
    if (cont) cont.classList.remove('landing');
};


// ==============================================================================
// Frases rotativas da tela inicial (ordem aleatoria + transicao suave)
// ==============================================================================
window.iniciarFrasesIntro = function() {
    const el = document.getElementById('intro-sub');
    if (!el) return;
    if (window.__introPhraseTimer) clearInterval(window.__introPhraseTimer);
    let ordem = [], idx = 0;
    const lista = () => (window.I18N && window.I18N[window.currentLang] && window.I18N[window.currentLang].intro_phrases)
                        || (window.I18N && window.I18N.pt && window.I18N.pt.intro_phrases) || [];
    const embaralhar = () => {
        const n = lista().length;
        ordem = Array.from({ length: n }, (_, i) => i);
        for (let i = ordem.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
        }
        idx = 0;
    };
    embaralhar();
    const trocar = () => {
        const arr = lista();
        if (!arr.length) return;
        if (idx >= ordem.length) embaralhar();
        const frase = arr[ordem[idx] % arr.length];
        idx++;
        el.style.opacity = '0';
        setTimeout(() => { el.textContent = frase; el.style.opacity = '1'; }, 550);
    };
    window.__introPhraseTimer = setInterval(trocar, 5200);
};
document.addEventListener('DOMContentLoaded', () => { window.iniciarFrasesIntro(); });


// ==============================================================================
// Rastro de particulas no anel de carregamento do chat (para ao chegar a resposta)
// ==============================================================================
window.iniciarRastroLoader = function(loaderEl) {
    if (!loaderEl) return;
    const canvas = loaderEl.querySelector('.loader-parts');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const COR = '30, 64, 175'; // azul escuro, igual ao anel da marca
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S = 54;
    canvas.width = S * dpr; canvas.height = S * dpr;
    const cx = S / 2, cy = S / 2, R = 9;
    let ang = 0;
    loaderEl.__rastro = true;
    const passo = () => {
        if (!loaderEl.__rastro) { ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,S,S); return; }
        requestAnimationFrame(passo);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.085)';
        ctx.fillRect(0, 0, S, S);
        ctx.globalCompositeOperation = 'source-over';
        ang += 0.09;
        const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 2.8);
        g.addColorStop(0, 'rgba(' + COR + ', 0.95)');
        g.addColorStop(1, 'rgba(' + COR + ', 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 2.8, 0, Math.PI * 2); ctx.fill();
    };
    requestAnimationFrame(passo);
};
window.pararRastroLoader = function(loaderEl) { if (loaderEl) loaderEl.__rastro = false; };
