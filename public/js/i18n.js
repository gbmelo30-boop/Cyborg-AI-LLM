// ==============================================================================
// INTERNACIONALIZAÇÃO (Português / Inglês)
// ==============================================================================
window.I18N = {
  pt: {
    intro_sub: "Uma jornada pela fronteira entre humano e máquina",
    loading: "INICIALIZANDO SISTEMA...",
    start_btn: "INICIAR INTERAÇÃO",
    auth_title: "Identificação",
    auth_sub: "Como prefere ser chamado?",
    name_ph: "Digite seu nome...",
    enter_btn: "ENTRAR",
    chat_ph: "Converse com o Cyborg AI...",
    menu: "Menu",
    nav_instructions: "Instruções",
    nav_new: "Nova Conversa",
    nav_history: "Histórico",
    nav_settings: "Configurações",
    nav_theme: "Alternar Tema",
    nav_logout: "Sair",
    instr_title: "Instruções de Uso",
    btn_prev: "< Anterior",
    btn_next: "Próximo >",
    btn_close: "Fechar",
    settings_title: "Configurações",
    rag_label: "Contexto (RAG)",
    rag_desc: "Permitir que a IA leia a biblioteca de PDFs.",
    status_label: "Status:",
    admin_link: "Painel administrativo",
    hist_title: "Histórico de Conversas",
    hist_search_ph: "Buscar conversa...",
    hist_empty: "Nenhuma conversa salva.",
    loading_word: "Carregando...",
    you: "Você",
    on: "ATIVADO",
    off: "DESATIVADO",
    error_neural: "Minhas redes neurais sentiram um distúrbio. Tente novamente.",
    confirm_delete: "Excluir conversa?",
    rename_prompt: "Novo nome:",
    name_required: "Digite seu nome para continuar.",
    greet_morning: "Bom dia", greet_afternoon: "Boa tarde", greet_evening: "Boa noite",
    greet_tail: "Sou o Cyborg AI, como posso ajudá-lo?",
    slide1: "<h3>1. Quem sou eu?</h3><p>Olá, eu sou o Cyborg AI.</p><p>Não sou um assistente virtual focado em produtividade. Fui criado para explorar as fronteiras entre humanos, animais e máquinas, inspirado pela filosofia ciborgue e pelo Design Especulativo.</p>",
    slide2: "<h3>2. Quando me usar?</h3><p>Use-me quando quiser testar os limites de uma ideia. Se você está pensando em uma nova tecnologia, um projeto, ou simplesmente refletindo sobre os impactos do futuro na sociedade, este é o lugar.</p>",
    slide3: "<h3>3. Como falar comigo?</h3><p>Para que eu possa te ajudar, preciso de contexto. No chat, envie um texto contendo:</p><ul><li><strong>A ideia:</strong> Qual é a tecnologia, projeto ou problema que você quer discutir?</li><li><strong>A intenção:</strong> O que você espera que isso mude no mundo?</li></ul>",
    slide4: "<h3>4. Como eu respondo?</h3><p>Não espere respostas prontas, resumos ou soluções fáceis. Minhas falas serão concisas, diretas e, muitas vezes, provocarão desconforto.</p><p>Meu papel é tensionar a sua visão de mundo.</p>",
    slide5: "<h3>5. O que fazer com a resposta?</h3><p>Toda interação comigo terminará com uma pergunta. Use essa pergunta para investigar os pontos cegos éticos e sociais das suas próprias ideias.</p><p>A reflexão final nunca é minha, é sempre sua.</p>"
  },
  en: {
    intro_sub: "A journey across the frontier between human and machine",
    loading: "INITIALIZING SYSTEM...",
    start_btn: "START INTERACTION",
    auth_title: "Identification",
    auth_sub: "What should we call you?",
    name_ph: "Enter your name...",
    enter_btn: "ENTER",
    chat_ph: "Chat with Cyborg AI...",
    menu: "Menu",
    nav_instructions: "Instructions",
    nav_new: "New Chat",
    nav_history: "History",
    nav_settings: "Settings",
    nav_theme: "Toggle Theme",
    nav_logout: "Log Out",
    instr_title: "How to Use",
    btn_prev: "< Previous",
    btn_next: "Next >",
    btn_close: "Close",
    settings_title: "Settings",
    rag_label: "Context (RAG)",
    rag_desc: "Allow the AI to read the PDF library.",
    status_label: "Status:",
    admin_link: "Admin panel",
    hist_title: "Chat History",
    hist_search_ph: "Search chats...",
    hist_empty: "No saved chats.",
    loading_word: "Loading...",
    you: "You",
    on: "ENABLED",
    off: "DISABLED",
    error_neural: "My neural networks felt a disturbance. Please try again.",
    confirm_delete: "Delete chat?",
    rename_prompt: "New name:",
    name_required: "Enter your name to continue.",
    greet_morning: "Good morning", greet_afternoon: "Good afternoon", greet_evening: "Good evening",
    greet_tail: "I'm Cyborg AI, how can I help you?",
    slide1: "<h3>1. Who am I?</h3><p>Hi, I'm Cyborg AI.</p><p>I'm not a productivity assistant. I was created to explore the boundaries between humans, animals and machines, inspired by cyborg philosophy and Speculative Design.</p>",
    slide2: "<h3>2. When to use me?</h3><p>Use me when you want to test the limits of an idea. If you're thinking about a new technology, a project, or simply reflecting on how the future may impact society, this is the place.</p>",
    slide3: "<h3>3. How to talk to me?</h3><p>To help you, I need context. In the chat, send a message containing:</p><ul><li><strong>The idea:</strong> which technology, project or problem do you want to discuss?</li><li><strong>The intention:</strong> what do you hope it will change in the world?</li></ul>",
    slide4: "<h3>4. How do I respond?</h3><p>Don't expect ready-made answers, summaries or easy solutions. My replies will be concise, direct and, often, uncomfortable.</p><p>My role is to tension your worldview.</p>",
    slide5: "<h3>5. What to do with the answer?</h3><p>Every interaction with me ends with a question. Use that question to investigate the ethical and social blind spots of your own ideas.</p><p>The final reflection is never mine, it's always yours.</p>"
  }
};

window.currentLang = (function(){ try { return localStorage.getItem('cyborgLang') || 'pt'; } catch(e){ return 'pt'; } })();

window.T = function(key){
  const d = window.I18N[window.currentLang] || window.I18N.pt;
  return (d && d[key] != null) ? d[key] : (window.I18N.pt[key] != null ? window.I18N.pt[key] : key);
};

window.saudacao = function(firstName){
  const h = new Date().getHours();
  const p = (h >= 5 && h < 12) ? window.T('greet_morning') : ((h >= 12 && h < 18) ? window.T('greet_afternoon') : window.T('greet_evening'));
  const nome = firstName ? (', ' + firstName) : '';
  return p + nome + '! ' + window.T('greet_tail');
};

window.applyLang = function(lang){
  if (lang) window.currentLang = lang;
  try { localStorage.setItem('cyborgLang', window.currentLang); } catch(e){}
  document.documentElement.lang = (window.currentLang === 'en') ? 'en' : 'pt-BR';
  document.querySelectorAll('[data-i18n]').forEach(function(el){ const v = window.T(el.getAttribute('data-i18n')); if (v != null) el.textContent = v; });
  document.querySelectorAll('[data-i18n-ph]').forEach(function(el){ const v = window.T(el.getAttribute('data-i18n-ph')); if (v != null) el.setAttribute('placeholder', v); });
  document.querySelectorAll('[data-i18n-html]').forEach(function(el){ const v = window.T(el.getAttribute('data-i18n-html')); if (v != null) el.innerHTML = v; });
  const ll = document.getElementById('lang-label'); if (ll) ll.textContent = (window.currentLang === 'pt') ? 'English' : 'Português';
  const st = document.getElementById('rag-status'); if (st) st.textContent = window.useRag ? window.T('on') : window.T('off');
};

window.toggleLang = function(){
  window.applyLang(window.currentLang === 'pt' ? 'en' : 'pt');
  if (window.closeSidebarMobile) window.closeSidebarMobile();
};

document.addEventListener('DOMContentLoaded', function(){ window.applyLang(window.currentLang); });
