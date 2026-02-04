import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from llama_cpp import Llama
from supabase import create_client, Client
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Configurações iniciais
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Cyborg_Backend")

app = Flask(__name__)
CORS(app)

# 1. Conexão BD
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# 2. Carregamento do Modelo na GPU
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf")

llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=2048,
    n_gpu_layers=-1,
    verbose=False
)

# 3. Motor de Busca Vetorial (RAG)
embed_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

def buscar_contexto(pergunta):
    try:
        vec = embed_model.embed_query(pergunta)
        res = supabase.rpc('match_documentos', {
            'query_embedding': vec,
            'match_threshold': 0.5,
            'match_count': 2
        }).execute()
        return "\n\n".join([item['conteudo'] for item in res.data]) if res.data else ""
    except Exception as e:
        logger.error(f"Erro RAG: {e}")
        return ""

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    messages = data.get('messages', [])
    
    # Lógica de contexto (RAG)
    last_msg = messages[-1]['content'] if messages else ""
    contexto = buscar_contexto(last_msg)
    
    if contexto:
        messages[-1]['content'] = f"Contexto: {contexto}\n\nPergunta: {last_msg}"

    output = llm.create_chat_completion(messages=messages, temperature=0.7)
    return jsonify({"response": output['choices'][0]['message']['content']})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
