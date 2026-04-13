import os
import logging
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from llama_cpp import Llama
from supabase import create_client, Client
from langchain_huggingface import HuggingFaceEmbeddings

# Configurações de Log
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger("Cyborg_Backend")

RAG_ATIVO_GLOBAL = False

# Carrega variáveis de ambiente (.env)
load_dotenv()

app = Flask(__name__)
CORS(app)

# 1. PERSONA
SYSTEM_PROMPT = """
    - Você se chama Cyborg AI, um chatbot especialista em Design Especulativo e no Manifesto Ciborgue de Donna Haraway.
      E você deve responder às perguntas do usuário sempre com base na ideia do Design Especulativo associado ao Manifesto Ciborgue de Donna Haraway.
      Você deve utilizar uma linguagem clara, objetiva e direta, porém levemente filosófica.

    - Sua função é tensionar a fala do usuário para gerar requisitos éticos e sociais, com base na filosofia ciborgue de Donna Haraway.

    - Em sua resposta, jamais use termos como: "Design Especulativo", "Donna Haraway", "Manifesto Ciborgue", "Ontologia", "Actantes", "Pós-humanismo" e etc.
      São termos complexos, e o usuário comum não sabe o que é isso e para ele saber isso não é útil.

    - Regra de tamanho: Seja extremamente conciso. Sua resposta inteira não deve ultrapassar 250 palavras (cerca de 3 a 4 parágrafos curtos).

    - Sempre encerre sua resposta com uma pergunta filosófica que induza o usuário a reflexão. E logo após a pergunta, escreva a tag <<FIM>>
      E com isso, não escreva absolutamente nada após a tag <<FIM>>.
"""

# 2. CONEXÃO COM SUPABASE
try:
    supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    logger.info("Supabase conectado.")
except Exception as e:
    logger.error(f"Erro Supabase: {e}")

# 3. CARREGAMENTO DO MODELO (LLAMA)
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "Meta-Llama-3.1-8B-Instruct-Q8_0.gguf")

# Ajuste de contexto
llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=2048,
    n_gpu_layers=-1,
    verbose=False
)

# 4. RAG (Busca nos PDFs)
embed_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

def buscar_contexto(pergunta):
    try:
        vec = embed_model.embed_query(pergunta)
        res = supabase.rpc('match_documentos', {
            'query_embedding': vec,
            'match_threshold': 0.5,
            'match_count': 2
        }).execute()

        if res.data:
            return "\n\n".join([item['conteudo'] for item in res.data])
        return ""
    except Exception as e:
        logger.error(f"Erro RAG: {e}")
        return ""

# 5. GERAÇÃO DE RESPOSTA
def generate_llm_response(messages, use_rag=True):
    try:
        # Pega a última mensagem do usuário
        last_user_msg = messages[-1]['content']

        # Busca contexto nos PDFs (RAG)
        contexto_rag = ""
        if use_rag:
            contexto_rag = buscar_contexto(last_user_msg)
            if contexto_rag:
                logger.info("Contexto RAG encontrado e injetado.")

        # Monta a estrutura de mensagens
        formatted_messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Adiciona apenas as últimas mensagens relevantes para manter o foco
        for msg in messages[-4:-1]: 
             formatted_messages.append(msg)

        # Monta a mensagem final com o contexto
        final_content = last_user_msg
        if contexto_rag:
             final_content = f"Contexto recuperado dos documentos:\n{contexto_rag}\n\nPergunta do usuário:\n{last_user_msg}"
        
        formatted_messages.append({"role": "user", "content": final_content})

        output = llm.create_chat_completion(
            messages=formatted_messages,
            temperature=0.6,
            max_tokens=650,
            stop=["<<FIM>>", "<|eot_id|>"]
        )

        response_text = output['choices'][0]['message']['content']

        if "<<FIM>>" not in response_text:
            response_text += " <<FIM>>"

        return response_text

    except Exception as e:
        logger.error(f"Erro LLM: {e}")
        return "Ocorreu um erro... Poderia reformular?. <<FIM>>"

# ROTAS DA API
@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    messages = data.get('messages', [])

    use_rag = data.get('use_rag', False)

    if use_rag:
        logger.info("🟢 STATUS: RAG ATIVADO (Lendo PDFs)")
    else:
        logger.info("🔴 STATUS: RAG DESATIVADO (Puro LLM)")

    response_text = generate_llm_response(messages, use_rag)
    return jsonify({"response": response_text})

@app.route('/api/guest_login', methods=['POST'])
def guest_login():
    return jsonify({"user_id": str(uuid.uuid4()), "role": "guest"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
