// ==============================================================================
// CYBORG ANEL — logo da tela inicial
// Partículas pontilhadas sobem da parte inferior da tela, convergem em círculo
// e se FUNDEM aos poucos no anel sólido azul escuro da marca.
// Só existe na tela inicial; nas demais telas o anel já aparece sólido (SVG).
// Cor fixa: azul escuro — independente do tema claro/escuro.
// ==============================================================================
(function() {
'use strict';

const COR = '30, 64, 175'; // azul escuro fixo
const MOBILE = window.matchMedia('(max-width: 768px)').matches;

function iniciarAnelIntro() {
    const view   = document.getElementById('view-intro');
    const canvas = document.getElementById('intro-orb-canvas');
    const ancora = document.getElementById('intro-orb-anchor');
    if (!view || !canvas || !ancora || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const REDUZ = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const QTD = MOBILE ? 1500 : 2600;

    const SUBIDA = 1500;   // duração da subida de cada partícula (ms)
    const DELAYS = 650;    // espalhamento dos delays (ms)
    const FUSAO  = 900;    // fusão pontilhado -> anel sólido (ms)
    const INI_FUSAO = SUBIDA + DELAYS - 250; // a fusão começa no fim da chegada

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 90;
    let estavaAtivo = false, inicioAtivo = 0, pronto = false, escuroCache = null;
    const pts = [];

    function medir() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vr = view.getBoundingClientRect();
        W = Math.max(vr.width, 1); H = Math.max(vr.height, 1);
        canvas.width  = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        const ar = ancora.getBoundingClientRect();
        cx = (ar.left - vr.left) + ar.width / 2;
        cy = (ar.top  - vr.top)  + ar.height / 2;
        R  = ar.width * 0.44;
        pronto = false;
    }

    function easeOutCubic(v) { return 1 - Math.pow(1 - v, 3); }

    function criar() {
        pts.length = 0;
        for (let i = 0; i < QTD; i++) {
            pts.push({
                ang:  Math.random() * Math.PI * 2,          // posição final no círculo
                desvio: (Math.random() - 0.5),              // desvio dentro da espessura
                giro: (Math.random() - 0.5) * 1.6,          // redemoinho que decai na chegada
                delay: Math.random() * DELAYS,
                tam:  0.8 + Math.random() * 1.2,
                alfa: 0.4 + Math.random() * 0.6,
                x0: 0, y0: 0
            });
        }
        for (const p of pts) {
            p.x0 = cx + (Math.random() - 0.5) * W * 1.1;    // parte inferior da tela
            p.y0 = H + 10 + Math.random() * H * 0.4;
        }
    }

    function desenharAnelSolido(alfa) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(' + COR + ', ' + alfa.toFixed(3) + ')';
        ctx.lineWidth = R * 0.20;
        // brilho só no tema escuro; no claro o anel fica limpo, sem dispersão
        const claro = document.body.classList.contains('light-theme');
        ctx.shadowColor = claro ? 'transparent' : 'rgba(' + COR + ', ' + (alfa * 0.9).toFixed(3) + ')';
        ctx.shadowBlur = claro ? 0 : R * 0.22;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // desenha um instante da animação; retorna true quando ela terminou
    function quadro(tE) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const escuro = !document.body.classList.contains('light-theme');
        escuroCache = escuro;

        const meiaEsp = R * 0.20 * 0.5;
        const fA = Math.max(0, Math.min(1, (tE - INI_FUSAO) / FUSAO)); // avanço da fusão
        if (fA > 0) desenharAnelSolido(easeOutCubic(fA));

        const alfaPart = 1 - fA; // pontilhado desaparece conforme o sólido surge
        if (alfaPart > 0) {
            ctx.globalCompositeOperation = escuro ? 'lighter' : 'source-over';
            for (const p of pts) {
                const prog = Math.max(0, Math.min(1, (tE - p.delay) / SUBIDA));
                const e = easeOutCubic(prog);
                const ang = p.ang + p.giro * (1 - e);
                const alvoX = cx + Math.cos(ang) * (R + p.desvio * meiaEsp * 2);
                const alvoY = cy + Math.sin(ang) * (R + p.desvio * meiaEsp * 2);
                const x = p.x0 + (alvoX - p.x0) * e;
                const y = p.y0 + (alvoY - p.y0) * e;
                const a = p.alfa * (0.3 + 0.7 * e) * alfaPart;
                ctx.fillStyle = 'rgba(' + COR + ', ' + a.toFixed(3) + ')';
                ctx.fillRect(x, y, p.tam, p.tam);
            }
            ctx.globalCompositeOperation = 'source-over';
        }
        return tE >= INI_FUSAO + FUSAO;
    }

    function passo(agora) {
        requestAnimationFrame(passo);
        const atv = view.classList.contains('active-view') && !document.hidden;
        if (!atv) { estavaAtivo = false; return; }
        if (!estavaAtivo) {          // replay sempre que a intro reaparece
            estavaAtivo = true;
            inicioAtivo = agora;
            medir();
            criar();
        }
        const escuro = !document.body.classList.contains('light-theme');
        if (pronto && escuro === escuroCache) return;   // congelado: custo zero

        const tE = REDUZ ? 1e9 : (agora - inicioAtivo);
        if (quadro(tE)) pronto = true;
    }

    window.addEventListener('resize', medir);
    window.addEventListener('orientationchange', () => { setTimeout(medir, 250); });

    medir();
    criar();
    requestAnimationFrame(passo);
}

document.addEventListener('DOMContentLoaded', iniciarAnelIntro);
})();
