# Cyborg AI — App Android (Capacitor)

O app Android é um **invólucro nativo (Capacitor)** que carrega o site do Cyborg AI
(`http://200.156.26.159/chat/`) dentro de uma WebView. O visual e a estrutura são
**exatamente os mesmos** do site — nada foi alterado. Vantagem: toda vez que você
atualiza o servidor (git pull), o app já mostra a versão nova, **sem precisar
recompilar** o APK.

Configuração em `capacitor.config.json`:
- appId: `br.cyborgai.app`
- appName: `Cyborg AI`
- server.url: `http://200.156.26.159/chat/`  (cleartext liberado p/ HTTP)

---

## Pré-requisitos (na SUA máquina — Windows, não no servidor)

1. **Node.js 18+** — https://nodejs.org
2. **Android Studio** — https://developer.android.com/studio
   (na 1ª execução ele instala o Android SDK; aceite as licenças)

## Passo a passo para gerar o APK

Abra o PowerShell na pasta do projeto (o repositório clonado no seu PC):

```bash
git clone https://github.com/gbmelo30-boop/Cyborg-AI-LLM.git
cd Cyborg-AI-LLM

npm install                 # baixa o Capacitor
npx cap add android         # cria o projeto Android nativo (pasta android/)
npx cap sync                # aplica a configuracao

npx cap open android        # abre no Android Studio
```

No Android Studio:
- Menu **Build > Build Bundle(s) / APK(s) > Build APK(s)**
- Ao terminar, clique em **locate** — o arquivo estará em:
  `android/app/build/outputs/apk/debug/app-debug.apk`

## Instalar no celular Android

- Envie o `app-debug.apk` para o celular (WhatsApp, Google Drive, cabo USB…)
- No celular, toque no arquivo → autorize **"Instalar de fontes desconhecidas"**
- Pronto: o app "Cyborg AI" aparece na gaveta de apps.

## Quando o app precisa ser recompilado?
- **NÃO precisa** para mudanças no site (HTML/CSS/JS) — como o app carrega a URL
  do servidor, um `git pull` no servidor já reflete no app.
- **Precisa recompilar** só se mudar: ícone, nome, splash, ou a `server.url`.

## Distribuição para participantes da pesquisa
- **Sideload (recomendado p/ IC):** compartilhe o `app-debug.apk` por link (Drive).
  Cada pessoa instala manualmente (fontes desconhecidas).
- **Google Play:** exige conta de desenvolvedor (US$ 25, única vez) e revisão.
  Para publicar na Play, o ideal é **HTTPS** (o cleartext HTTP é desencorajado).

## Observação importante (segurança)
O app fala com o servidor via **HTTP** (IP puro). Para uso interno/testes funciona
(cleartext liberado). Para um app público e mais seguro, o recomendado é migrar o
servidor para **HTTPS com um domínio** — aí trocamos a `server.url` para `https://`.
