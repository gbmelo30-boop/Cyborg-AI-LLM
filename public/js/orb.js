// ==============================================================================
// CYBORG ANEL — logo da tela inicial
// Particulas convergem de TODA a tela (cima, baixo e lados), em trajetorias
// curvas/imprevisiveis e um pouco mais lentas, e se fundem no anel solido azul
// escuro da marca. Depois, o anel pulsa de forma lenta e sutil.
// Cor fixa: azul escuro. Dispersao de brilho em AMBOS os temas (claro e escuro).
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

    const SUBIDA = 2300;                     // viagem de cada particula (ms) — mais lenta
    const DELAYS = 950;                      // espalhamento dos delays (ms)
    const FUSAO  = 1000;                     // fusao pontilhado -> anel solido (ms)
    const INI_FUSAO = SUBIDA + DELAYS - 300;

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 90;
    let estavaAtivo = false, inicioAtivo = 0, congelado = false;
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
    }

    function easeOutCubic(v) { return 1 - Math.pow(1 - v, 3); }

    function criar() {
        pts.length = 0;
        for (let i = 0; i < QTD; i++) {
            pts.push({
                ang:  Math.random() * Math.PI * 2,
                desvio: (Math.random() - 0.5),
                giro: (Math.random() - 0.5) * 2.0,   // redemoinho na chegada
                delay: Math.random() * DELAYS,
                tam:  0.9 + Math.random() * 1.5,
                alfa: 0.4 + Math.random() * 0.6,
                x0: 0, y0: 0, cxp: 0, cyp: 0
            });
        }
        const m = 60, desl = Math.min(W, H) * 0.4;
        for (const p of pts) {
            // origem em qualquer uma das quatro bordas (cima, baixo, esquerda, direita)
            const b = Math.floor(Math.random() * 4);
            if (b === 0)      { p.x0 = Math.random() * W;                 p.y0 = -m - Math.random() * H * 0.35; }
            else if (b === 1) { p.x0 = Math.random() * W;                 p.y0 = H + m + Math.random() * H * 0.35; }
            else if (b === 2) { p.x0 = -m - Math.random() * W * 0.35;     p.y0 = Math.random() * H; }
            else              { p.x0 = W + m + Math.random() * W * 0.35;  p.y0 = Math.random() * H; }
            // ponto de controle deslocado aleatoriamente -> trajetoria curva e imprevisivel
            p.cxp = (p.x0 + cx) / 2 + (Math.random() - 0.5) * desl;
            p.cyp = (p.y0 + cy) / 2 + (Math.random() - 0.5) * desl;
        }
    }

    function desenharAnelSolido(alfa, escalaR) {
        const rr = R * (escalaR || 1);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(' + COR + ', ' + alfa.toFixed(3) + ')';
        ctx.lineWidth = rr * 0.20;
        // dispersao de brilho em ambos os temas (claro e escuro)
        ctx.shadowColor = 'rgba(' + COR + ', ' + (alfa * 0.85).toFixed(3) + ')';
        ctx.shadowBlur = rr * 0.22;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function quadro(tE) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const escuro = !document.body.classList.contains('light-theme');
        const meiaEsp = R * 0.20 * 0.5;
        const fA = Math.max(0, Math.min(1, (tE - INI_FUSAO) / FUSAO));
        const pulso = 1 + Math.sin(tE / 1400) * 0.014;  // pulso lento e bem sutil
        if (fA > 0) desenharAnelSolido(easeOutCubic(fA), fA >= 1 ? pulso : 1);

        const alfaPart = 1 - fA;
        if (alfaPart > 0) {
            ctx.globalCompositeOperation = escuro ? 'lighter' : 'source-over';
            for (const p of pts) {
                const prog = Math.max(0, Math.min(1, (tE - p.delay) / SUBIDA));
                const e = easeOutCubic(prog);
                const ang = p.ang + p.giro * (1 - e);
                const alvoX = cx + Math.cos(ang) * (R + p.desvio * meiaEsp * 2);
                const alvoY = cy + Math.sin(ang) * (R + p.desvio * meiaEsp * 2);
                const mt = 1 - e;
                const x = mt * mt * p.x0 + 2 * mt * e * p.cxp + e * e * alvoX;
                const y = mt * mt * p.y0 + 2 * mt * e * p.cyp + e * e * alvoY;
                const a = p.alfa * (0.3 + 0.7 * e) * alfaPart;
                ctx.fillStyle = 'rgba(' + COR + ', ' + a.toFixed(3) + ')';
                ctx.beginPath();
                ctx.arc(x, y, p.tam * 0.62, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        }
        return fA >= 1;
    }

    function passo(agora) {
        requestAnimationFrame(passo);
        const atv = view.classList.contains('active-view') && !document.hidden;
        if (!atv) { estavaAtivo = false; return; }
        if (!estavaAtivo) { estavaAtivo = true; inicioAtivo = agora; congelado = false; medir(); criar(); }
        if (REDUZ && congelado) return;             // movimento reduzido: desenha uma vez e congela
        const tE = REDUZ ? 1e9 : (agora - inicioAtivo);
        const fim = quadro(tE);
        if (REDUZ && fim) congelado = true;
    }

    window.addEventListener('resize', () => { medir(); });
    window.addEventListener('orientationchange', () => { setTimeout(medir, 250); });

    medir();
    criar();
    requestAnimationFrame(passo);
}

document.addEventListener('DOMContentLoaded', iniciarAnelIntro);
})();
