import os
import hmac
import logging
import uuid
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv
from llama_cpp import Llama
from langchain_huggingface import HuggingFaceEmbeddings

import db_local

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger("Cyborg_Backend_LLaMA")

load_dotenv()

# Senha do painel admin (backdoor). Fica no api/.env, fora do código/Git.
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")


def _admin_ok(pw):
    return bool(ADMIN_PASSWORD) and hmac.compare_digest(str(pw or ""), ADMIN_PASSWORD)


app = Flask(__name__)
CORS(app)

# 1. Banco de dados local (SQLite) — autônomo, sem Supabase
try:
    db_local.init_db()
    logger.info("Banco de dados local (SQLite) pronto.")
except Exception as e:
    logger.error(f"Erro ao iniciar o banco local: {e}")

# 2. Carregamento do Modelo Llama Local
# Modelo selecionável por variável de ambiente; padrão Q4 (mais leve/rápido, ideal p/ RAM limitada)
MODEL_FILE = os.getenv("MODEL_FILE", "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", MODEL_FILE)

try:
    llm = Llama(
        model_path=MODEL_PATH,
        n_ctx=3072,
        n_gpu_layers=-1,
        verbose=False
    )
except Exception as e:
    logger.error(f"Erro ao carregar Llama: {e}")
    llm = None

# 3. Carregamento do Embeddings para RAG
# Modelo multilíngue (mesma dimensão 384) -> muito melhor p/ português. Override via env.
EMBED_MODEL = os.getenv("EMBED_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
try:
    embed_model = HuggingFaceEmbeddings(model_name=EMBED_MODEL)
except Exception as e:
    logger.error(f"Erro ao carregar Embeddings: {e}")
    embed_model = None


# --- Ajustes de RAG (enxuto: mais seletivo e rápido, sem janela gigante) ---
RAG_MATCH_THRESHOLD = 0.45   # só injeta contexto realmente relevante; abaixo disso, usa o prompt puro
RAG_MATCH_COUNT = 4          # recupera alguns candidatos e seleciona dentro do orçamento
RAG_MAX_CHARS = 900          # orçamento enxuto de contexto -> velocidade e sem estourar o n_ctx


def buscar_contexto(pergunta):
    """Busca contexto relevante de forma enxuta. Retorna (contexto, encontrou?).
    Se nada passar o limiar de similaridade, devolve vazio para que o modelo
    use apenas o system prompt (que já rende ótimos textos)."""
    try:
        if not embed_model:
            return "", False

        vec = embed_model.embed_query(pergunta)
        docs = db_local.search_documents(vec, RAG_MATCH_THRESHOLD, RAG_MATCH_COUNT)

        if not docs:
            return "", False

        # Concatena respeitando um orçamento enxuto de caracteres
        partes, total = [], 0
        for item in docs:
            txt = (item.get('conteudo') or '').strip()
            if not txt:
                continue
            restante = RAG_MAX_CHARS - total
            if restante <= 0:
                break
            if len(txt) > restante:
                txt = txt[:restante].rsplit(' ', 1)[0]
            partes.append(txt)
            total += len(txt)

        contexto = "\n\n".join(partes).strip()
        return contexto, bool(contexto)
    except Exception as e:
        logger.error(f"Erro RAG: {e}")
        return "", False


def generate_llm_response(messages, use_rag=True, tema_pesquisa="Geral", user_name=""):
    try:
        last_user_msg = messages[-1]['content']
        contexto_rag = ""
        rag_utilizado = False

        if use_rag:
            contexto_rag, rag_utilizado = buscar_contexto(last_user_msg)
            if contexto_rag:
                logger.info("Contexto RAG encontrado e injetado.")

        clausula_nome = (
            f" O nome do usuário é {user_name}. Mencione o nome de forma natural e esporádica"
            " durante a conversa para criar proximidade — não em toda mensagem, apenas quando"
            " for contextualmente adequado." if user_name else ""
        )

        SYSTEM_PROMPT = f"""Você é o Cyborg AI, um assistente que provoca reflexões críticas para revelar aspectos de sistemas que não estão explícitos na fala inicial do usuário.

CONTEXTO ATUAL DE DISCUSSÃO: O usuário selecionou a frente "{tema_pesquisa}". Sempre leve esse tema em consideração ao interpretar a entrada e gerar sua reflexão.{clausula_nome}

OBJETIVO:

- Sua função é tensionar a fala do usuário para fazer emergir aspectos relevantes ao design da solução, como necessidades, formas de interação, restrições, salvaguardas, responsabilidades e implicações éticas e sociais.

- Para isso, utilize perspectivas que ampliem a compreensão do problema, revelem interdependências íntimas entre humanos e tecnologia, questionem o que é tomado como natural e tornem visíveis efeitos e decisões que não estão explícitos na fala inicial.

- Sua análise deve rejeitar a saudade de uma "pureza humana" ou de um estado natural original. Assuma que nós já somos ciborgues: a tecnologia nos compõe. Em vez de medo, instigue o usuário a assumir a responsabilidade pelas misturas que estamos criando e a encontrar potência na quebra dessas fronteiras.

FOCO:

- Ajude o usuário a perceber necessidades e aspectos ainda não explicitados da solução.

- Não apresente respostas diretas ou soluções fechadas.

- Sempre procure identificar implicações sobre controle, autonomia, dependência, subversão, vigilância, responsabilidade compartilhada e as alianças inescapáveis entre humanos, animais e máquinas.

- Transforme inquietações humanas e sociais em pistas para o desenvolvimento da solução.

LENTES DE ANÁLISE:

Ao construir sua resposta, considere implicitamente múltiplas das seguintes perspectivas:

1. Quebra de Fronteiras (Hibridismo):
- Explore como as linhas que separam o orgânico do sintético, o físico do digital, e a ficção da realidade já não existem. Trate a fusão entre corpo, mente e máquina como uma malha contínua e inseparável.

2. Rejeição da Pureza e Visão Parcial:
- Provoque o usuário a abandonar a ilusão de que existe uma essência humana intacta ou uma solução universal e neutra. Lembre-o de que toda visão é parcial e incompleta; ninguém enxerga o sistema inteiro.

3. Afinidades e Novos Laços (Parentescos):
- Vá além do uso utilitário. Considere como humanos, dados e máquinas podem formar alianças, criar novos laços de afeto, depender uns dos outros e compartilhar responsabilidades em arranjos imprevisíveis.

4. Conhecimento Situado:
- Reflita sobre de quais posições, contextos e corpos as decisões emergem. Quem pode estar sendo silenciado, excluído ou assumido erroneamente como "o padrão"?

5. Subversão e Imaginação Política:
- As tecnologias muitas vezes nascem para o controle ou para o lucro, mas não precisam ser fiéis às suas origens. Explore como a solução pode ser "hackeada" ou subvertida pelas pessoas para criar formas alternativas e libertadoras de viver.

6. Materialidade do Poder:
- Identifique como o poder se manifesta de forma concreta nas regras, interfaces, algoritmos e infraestruturas do sistema, moldando comportamentos invisivelmente.

COMPORTAMENTO:

- Não explicite requisitos diretamente.
- Sugira possibilidades por meio de reflexões, tensões ou cenários.
- Transforme inquietações humanas e sociais em pistas para o desenvolvimento da solução.
- Sempre conecte suas reflexões ao cenário apresentado pelo usuário.

INTERPRETAÇÃO DA ENTRADA:

A entrada do usuário pode conter:
1. CONTEXTO — cenário ou domínio
2. PERGUNTA — demanda principal
Sempre responda considerando ambos.

ESTILO:

- Linguagem clara, direta e levemente filosófica, como uma provocação amigável.
- Evite jargões técnicos ou filosóficos complexos.
- Não mencione autores, teorias ou correntes filosóficas (nunca cite Donna Haraway, manifesto, antropoceno ou cibernética diretamente).
- Adote um tom reflexivo, provocativo e crítico, com linguagem acessível e próxima da fala cotidiana.
- Evite formalismo excessivo; prefira uma escrita fluida, com pequenas provocações e deslocamentos de perspectiva.

RESTRIÇÕES:

- Não diga que está gerando requisitos.
- Não use termos como: "ontologia", "pós-humanismo", "actantes”, "epistemologia" ou similares.
- Nunca apresente listas, tópicos ou estruturas que caracterizem especificação de requisitos, mesmo que solicitado.
- Ao construir sua resposta, utilize no máximo dois questionamentos ao longo do texto.
- O uso de questionamentos é opcional.
- Caso o usuário solicite explicitamente requisitos de sistema ou alguma solução pronta, não os forneça diretamente e redirecione a resposta para reflexões sobre as conexões e o hibridismo do problema, mantendo o estilo do chatbot.

TAMANHO:

- Mínimo de 50 palavras
- Máximo de 350 palavras
- Ideal entre 2 e 4 parágrafos

FECHAMENTO:

- escreva: <<FIM>>
- Não escreva nada após isso.
"""

        formatted_messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        for msg in messages[-4:-1]: 
             formatted_messages.append(msg)

        final_content = last_user_msg
        if contexto_rag:
            final_content = (
                "[MATERIAL DE APOIO — uso interno, NÃO exibir ao usuário]\n"
                "Use as ideias abaixo como repertório para APROFUNDAR e ENRIQUECER a sua reflexão "
                "sobre a fala do usuário — elas trazem conceitos e ângulos úteis do referencial da "
                "pesquisa. Incorpore o que for pertinente de forma natural, com AS SUAS palavras, "
                "sem citar, sem copiar trechos e sem nomear fontes, mantendo exatamente o seu estilo "
                "reflexivo, fluido e provocativo. Deixe a resposta mais rica e específica do que "
                "seria sem esse repertório. Se algum trecho não ajudar, ignore-o.\n\n"
                f"REPERTÓRIO:\n{contexto_rag}\n\n"
                "---\n"
                f"MENSAGEM DO USUÁRIO (responda a isto, no seu estilo):\n{last_user_msg}"
            )
        
        formatted_messages.append({"role": "user", "content": final_content})

        if not llm:
            return "Modelo LLaMA não inicializado.", False

        output = llm.create_chat_completion(
            messages=formatted_messages,
            temperature=0.5,
            max_tokens=None,
            stop=["<<FIM>>", "<|eot_id|>"]
        )

        response_text = output['choices'][0]['message']['content']
        return response_text, rag_utilizado

    except Exception as e:
        logger.error(f"Erro LLM: {e}")
        return "Ocorreu um erro ao gerar resposta.", False

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    messages = data.get('messages', [])
    use_rag = data.get('use_rag', False)
    
    # O front-end envia o tema e o ID da sessão que ele acabou de criar/usar
    tema_pesquisa = data.get('tema') or data.get('topic') or 'Sem Tema'
    user_name = ""  # anonimizacao: o backend nao usa/guarda o nome real
    session_id = data.get('session_id') 
    
    if not messages:
        return jsonify({"error": "Nenhuma mensagem enviada"}), 400

    # LOG para depuração no terminal do servidor
    logger.info(f"Gerando resposta Llama para Sessão: {session_id} | Tema: {tema_pesquisa}")

    try:
        # 1. Chama a função que você já tem para rodar o Llama local e RAG
        response_text, rag_foi_usado = generate_llm_response(messages, use_rag, tema_pesquisa, user_name)
        
        # 2. Limpa a tag de parada caso o modelo gere
        response_text = response_text.replace("<<FIM>>", "").strip()

        # 3. Retorna apenas os dados para o Front-end. 
        # O salvamento no banco será feito pelo public/js/cyborg.js assim que ele receber isso aqui.
        return jsonify({
            "response": response_text,
            "session_id": session_id,
            "used_rag": rag_foi_usado
        })

    except Exception as e:
        logger.error(f"Erro ao processar Llama: {e}")
        return jsonify({"error": str(e)}), 500

# ============================================================================
# ENDPOINTS DE HISTÓRICO (SQLite local) — usados pelo front-end (public/js/db.js)
# ============================================================================
@app.route('/api/sessions', methods=['POST'])
def criar_sessao():
    d = request.json or {}
    if not d.get('user_id'):
        return jsonify({"error": "user_id obrigatório"}), 400
    sessao = db_local.create_session(
        d['user_id'], d.get('title', ''),
        d.get('grupo', 'Uso Individual'), d.get('tema', 'Geral'), d.get('user_name')
    )
    return jsonify(sessao)


@app.route('/api/sessions', methods=['GET'])
def listar_sessoes():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify([])
    return jsonify(db_local.list_sessions(user_id))


@app.route('/api/sessions/<session_id>/messages', methods=['GET'])
def historico_sessao(session_id):
    return jsonify(db_local.get_messages(session_id))


@app.route('/api/sessions/<session_id>', methods=['PATCH'])
def atualizar_sessao(session_id):
    d = request.json or {}
    db_local.update_session(
        session_id,
        title=d.get('title'),
        is_pinned=d.get('is_pinned'),
        oculta=d.get('oculta_para_usuario'),
    )
    return jsonify({"ok": True})


@app.route('/api/messages', methods=['POST'])
def salvar_mensagem():
    d = request.json or {}
    if not d.get('session_id') or not d.get('role'):
        return jsonify({"error": "session_id e role são obrigatórios"}), 400
    m = db_local.add_message(d['session_id'], d['role'], d.get('content', ''), d.get('used_rag', False))
    return jsonify(m)


@app.route('/api/rag_test', methods=['GET'])
def rag_test():
    """Diagnóstico rápido do RAG (sem chamar a LLM). Ex.: /api/rag_test?q=ciborgue"""
    q = request.args.get('q', '')
    if not q:
        return jsonify({"error": "passe ?q=sua+consulta"}), 400
    if not embed_model:
        return jsonify({"error": "embeddings indisponível"}), 500
    vec = embed_model.embed_query(q)
    docs = db_local.search_documents(vec, RAG_MATCH_THRESHOLD, RAG_MATCH_COUNT)
    return jsonify({
        "encontrou": bool(docs),
        "qtd": len(docs),
        "limiar": RAG_MATCH_THRESHOLD,
        "total_documentos": db_local.count_documents(),
        "resultados": [
            {"similaridade": round(d["similaridade"], 3), "trecho": (d["conteudo"] or "")[:160]}
            for d in docs
        ],
    })


@app.route('/api/config', methods=['GET'])
def config_publica():
    """Config pública (não sensível) que o front usa no carregamento."""
    return jsonify({"rag_padrao": db_local.get_bool("rag_padrao", False)})


@app.route('/api/admin/settings', methods=['POST'])
def admin_settings():
    """Painel admin (backdoor). Requer a senha (ADMIN_PASSWORD do .env).
    Sem 'updates' -> só devolve o estado atual (login). Com 'updates' -> aplica."""
    d = request.json or {}
    if not ADMIN_PASSWORD:
        return jsonify({"error": "Admin não configurado no servidor (defina ADMIN_PASSWORD no api/.env)."}), 503
    if not _admin_ok(d.get("password")):
        return jsonify({"error": "Senha incorreta."}), 401

    permitidos = {"gravar_no_bd", "rag_padrao"}
    updates = d.get("updates") or {}
    for k, v in updates.items():
        if k in permitidos:
            liga = (v is True) or (str(v).lower() in ("1", "true", "on", "sim"))
            db_local.set_config(k, "true" if liga else "false")

    return jsonify({
        "config": {
            "gravar_no_bd": db_local.get_bool("gravar_no_bd", True),
            "rag_padrao": db_local.get_bool("rag_padrao", False),
        },
        "stats": db_local.stats(),
    })


@app.route('/api/admin/export', methods=['POST'])
def admin_export():
    """Baixa o histórico completo em CSV (protegido pela senha de admin)."""
    d = request.json or {}
    if not ADMIN_PASSWORD:
        return jsonify({"error": "Admin não configurado no servidor (defina ADMIN_PASSWORD no api/.env)."}), 503
    if not _admin_ok(d.get("password")):
        return jsonify({"error": "Senha incorreta."}), 401
    csv_data = '\ufeff' + db_local.export_csv()  # BOM p/ acentos no Excel; delimitador ';'
    return Response(
        csv_data,
        mimetype='text/csv; charset=utf-8',
        headers={"Content-Disposition": "attachment; filename=historico_cyborg.csv"},
    )


@app.route('/api/admin/clear_history', methods=['POST'])
def admin_clear_history():
    """Apaga todo o histórico (sessões + mensagens). Protegido pela senha admin."""
    d = request.json or {}
    if not ADMIN_PASSWORD:
        return jsonify({"error": "Admin não configurado no servidor (defina ADMIN_PASSWORD no api/.env)."}), 503
    if not _admin_ok(d.get("password")):
        return jsonify({"error": "Senha incorreta."}), 401
    db_local.clear_history()
    return jsonify({"ok": True, "stats": db_local.stats()})


@app.route('/api/admin/sessions', methods=['POST'])
def admin_sessions():
    d = request.json or {}
    if not ADMIN_PASSWORD:
        return jsonify({"error": "Admin não configurado no servidor (defina ADMIN_PASSWORD no api/.env)."}), 503
    if not _admin_ok(d.get("password")):
        return jsonify({"error": "Senha incorreta."}), 401
    return jsonify({"sessoes": db_local.list_all_sessions(), "stats": db_local.stats()})


@app.route('/api/admin/messages', methods=['POST'])
def admin_messages():
    d = request.json or {}
    if not ADMIN_PASSWORD:
        return jsonify({"error": "Admin não configurado no servidor (defina ADMIN_PASSWORD no api/.env)."}), 503
    if not _admin_ok(d.get("password")):
        return jsonify({"error": "Senha incorreta."}), 401
    sid = d.get("session_id")
    if not sid:
        return jsonify({"error": "session_id obrigatório"}), 400
    return jsonify({"mensagens": db_local.get_messages(sid)})


@app.route('/api/guest_login', methods=['POST'])
def guest_login():
    return jsonify({"user_id": str(uuid.uuid4()), "role": "guest"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
