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
                f"[INSTRUÇÃO INTERNA: Referência factual.]\n\n"
                f"CONTEXTO EXTRAÍDO:\n{contexto_rag}\n\n"
                f"FALA DO USUÁRIO:\n{last_user_msg}"
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
    session_id = data.get('session_id') 
    
    if not messages:
        return jsonify({"error": "Nenhuma mensagem enviada"}), 400

    # LOG para depuração no terminal do servidor
    logger.info(f"Gerando resposta Llama para Sessão: {session_id} | Tema: {tema_pesquisa}")

    try:
        # 1. Chama a função que você já tem para rodar o Llama local e RAG
        response_text, rag_foi_usado = generate_llm_response(messages, use_rag, tema_pesquisa)
        
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

@app.route('/api/guest_login', methods=['POST'])
def guest_login():
    return jsonify({"user_id": str(uuid.uuid4()), "role": "guest"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
