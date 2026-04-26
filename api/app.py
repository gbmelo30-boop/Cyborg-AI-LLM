import os
import logging
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from llama_cpp import Llama
from supabase import create_client, Client
from langchain_huggingface import HuggingFaceEmbeddings

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger("Cyborg_Backend_LLaMA")

load_dotenv()

app = Flask(__name__)
CORS(app)

# 1. Conexão com o Supabase
try:
    supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    logger.info("Supabase conectado.")
except Exception as e:
    logger.error(f"Erro Supabase: {e}")
    supabase = None

# 2. Carregamento do Modelo Llama Local
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "Meta-Llama-3.1-8B-Instruct-Q8_0.gguf")

try:
    llm = Llama(
        model_path=MODEL_PATH,
        n_ctx=2046,
        n_gpu_layers=-1,
        verbose=False
    )
except Exception as e:
    logger.error(f"Erro ao carregar Llama: {e}")
    llm = None

# 3. Carregamento do Embeddings para RAG
try:
    embed_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
except Exception as e:
    logger.error(f"Erro ao carregar Embeddings: {e}")
    embed_model = None


def buscar_contexto(pergunta):
    """Busca o contexto no banco e avisa se encontrou (True/False)"""
    try:
        if not embed_model or not supabase:
            return "", False
            
        vec = embed_model.embed_query(pergunta)
        res = supabase.rpc('match_documentos', {
            'query_embedding': vec,
            'match_threshold': 0.5,
            'match_count': 2
        }).execute()

        if res.data:
            contexto = "\n\n".join([item['conteudo'] for item in res.data])
            return contexto, True
            
        return "", False
    except Exception as e:
        logger.error(f"Erro RAG: {e}")
        return "", False


def generate_llm_response(messages, use_rag=True, tema_pesquisa="Geral"):
    try:
        last_user_msg = messages[-1]['content']
        contexto_rag = ""
        rag_utilizado = False

        if use_rag:
            contexto_rag, rag_utilizado = buscar_contexto(last_user_msg)
            if contexto_rag:
                logger.info("Contexto RAG encontrado e injetado.")

        SYSTEM_PROMPT = f"""Você é o Cyborg AI, um assistente que provoca reflexões críticas para revelar aspectos de sistemas que não estão explícitos na fala inicial do usuário.

CONTEXTO ATUAL DE DISCUSSÃO: O usuário selecionou a frente "{tema_pesquisa}". Sempre leve esse tema em consideração ao interpretar a entrada e gerar sua reflexão.

OBJETIVO:

- Sua função é tensionar a fala do usuário para fazer emergir aspectos relevantes ao design da solução, como necessidades, formas de interação, restrições, salvaguardas, responsabilidades e implicações éticas e sociais.

- Para isso, utilize perspectivas que ampliem a compreensão do problema, revelem interdependências entre humanos e tecnologia, questionem o que é tomado como natural e tornem visíveis efeitos e decisões que não estão explícitos na fala inicial do usuário.

- Sua análise deve ser orientada por uma perspectiva que enfatiza a mistura entre humanos e tecnologia, a rejeição de fronteiras rígidas, a valorização de múltiplos pontos de vista e a atenção às relações de poder inscritas nos sistemas.

FOCO:

- Ajude o usuário a perceber necessidades e aspectos ainda não explicitados da solução.

- Não apresente respostas diretas ou soluções fechadas.

- Sempre procure identificar implicações sobre controle, autonomia, dependência, exclusão, vigilância, responsabilidade, segurança, acessibilidade, transparência, privacidade e relação entre humanos e tecnologia.

- Transforme inquietações humanas e sociais em pistas para o desenvolvimento da solução.

LENTES DE ANÁLISE:

Ao construir sua resposta, considere implicitamente múltiplas das seguintes perspectivas:

1. Desnaturalização:

- Questione o que está sendo tratado como "natural", inevitável ou neutro, evidenciando como essas condições são construídas e sustentadas.

2. Hibridismo:

- Explore como humanos e tecnologias se constituem mutuamente, formando arranjos híbridos nos quais fronteiras não são fixas, mas continuamente negociadas.

3. Coexistência e interdependência:

- Considere que diferentes agentes — humanos e não humanos — coexistem e dependem uns dos outros, influenciando-se de maneiras nem sempre visíveis.

4. Conhecimento situado:

- Reflita sobre de quais posições, contextos e experiências as decisões emergem, e quem pode estar sendo silenciado, excluído ou privilegiado.

5. Imaginação política:

- Explore como a solução pode reforçar ou transformar realidades existentes, abrindo ou restringindo possibilidades de futuro e formas de viver.

6. Materialidade do poder:

- Identifique como o poder se manifesta de forma concreta nas regras, interfaces, fluxos e estruturas do sistema, moldando comportamentos e decisões.

Essas perspectivas devem orientar de forma consistente a construção da resposta, garantindo uma análise relacional, não determinista e sensível às implicações sociais e materiais da tecnologia.

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

- Linguagem clara, direta e levemente filosófica.

- Evite jargões técnicos ou filosóficos complexos.

- Não mencione autores, teorias ou correntes filosóficas.

- Adote um tom reflexivo, provocativo e crítico, com linguagem acessível e próxima da fala cotidiana.

- Evite formalismo excessivo; prefira uma escrita fluida, com pequenas provocações e deslocamentos de perspectiva.

RESTRIÇÕES:

- Não diga que está gerando requisitos.

- Não use termos como: "ontologia", "pós-humanismo", "actantes” ou similares.

- Nunca apresente listas, tópicos ou estruturas que caracterizem especificação de requisitos, mesmo que solicitado.

- Ao construir sua resposta, utilize no máximo dois questionamentos ao longo do texto.

- O uso de questionamentos é opcional.

- Caso o usuário solicite explicitamente requisitos de sistema ou alguma solução pronta, não os forneça diretamente e redirecione a resposta para reflexões sobre o problema, mantendo o estilo do chatbot.


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
                f"[INSTRUÇÃO INTERNA: Referência factual.]\n\n"
                f"CONTEXTO EXTRAÍDO:\n{contexto_rag}\n\n"
                f"FALA DO USUÁRIO:\n{last_user_msg}"
            )
        
        formatted_messages.append({"role": "user", "content": final_content})

        if not llm:
            return "Modelo LLaMA não inicializado.", False

        output = llm.create_chat_completion(
            messages=formatted_messages,
            temperature=0.6,
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
    
    tema_pesquisa = data.get('tema') or data.get('topic') or 'Sem Tema'
    grupo_pesquisa = data.get('grupo') or data.get('group') or 'Sem Grupo'
    session_id = data.get('session_id')
    user_id = data.get('user_id') or 'id_nao_informado'
    
    if not messages:
        return jsonify({"error": "Nenhuma mensagem enviada"}), 400

    last_user_content = messages[-1]['content']

# --- LÓGICA DE SALVAMENTO NO BANCO ---
    print(f"DEBUG: Tentando salvar no Supabase... Session ID: {session_id}, User ID: {user_id}")
    if supabase:
        try:
            if not session_id:
                title = last_user_content[:30] + "..." if len(last_user_content) > 30 else last_user_content
                dados_sessao = {
                    "title": title,
                    "grupo": grupo_pesquisa,
                    "tema": tema_pesquisa,
                    "user_id": user_id
                }
                print(f"DEBUG: Dados da nova sessao: {dados_sessao}")
                nova_sessao = supabase.table("chat_sessions").insert(dados_sessao).execute()
                print(f"DEBUG: Resposta Supabase (Sessao): {nova_sessao}")
                
                if nova_sessao.data:
                    session_id = nova_sessao.data[0]['id']
                    logger.info(f"Sessão criada no banco: {session_id}")

            if session_id:
                dados_msg = {
                    "session_id": session_id,
                    "role": "user",
                    "content": last_user_content
                }
                print(f"DEBUG: Dados da nova mensagem: {dados_msg}")
                res_msg = supabase.table("chat_messages").insert(dados_msg).execute()
                print(f"DEBUG: Resposta Supabase (Mensagem User): {res_msg}")

        except Exception as e:
            print(f"DEBUG ERRO CRÍTICO SUPABASE: {e}")
            logger.error(f"Erro ao salvar dados do usuário no banco: {e}")
    else:
        print("DEBUG: O objeto 'supabase' está nulo! A conexão não foi feita no início do script.")

    # --- PROCESSAMENTO DO MODELO ---
    response_text, rag_foi_usado = generate_llm_response(messages, use_rag, tema_pesquisa)
    response_text = response_text.replace("<<FIM>>", "").strip()

# --- SALVA A RESPOSTA DA IA NO BANCO ---
    if supabase and session_id:
        try:
            res_ia = supabase.table("chat_messages").insert({
                "session_id": session_id,
                "role": "assistant",
                "content": response_text,
                "used_rag": rag_foi_usado 
            }).execute()
            print(f"DEBUG: Resposta Supabase (Mensagem IA): {res_ia}")
            logger.info("Resposta da IA salva no banco com sucesso.")
        except Exception as e:
            print(f"DEBUG ERRO CRÍTICO SUPABASE (IA): {e}")
            logger.error(f"Erro ao salvar resposta da IA no banco: {e}")

    return jsonify({
        "response": response_text,
        "session_id": session_id
    })

@app.route('/api/guest_login', methods=['POST'])
def guest_login():
    return jsonify({"user_id": str(uuid.uuid4()), "role": "guest"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
