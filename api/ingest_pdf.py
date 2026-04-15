import os
from pypdf import PdfReader
from supabase import create_client
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
embed_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

def processar_pdfs():
    pdf_path = "./api/documentos_pdf"
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )

    if not os.path.exists(pdf_path):
        print(f"Erro: A pasta {pdf_path} não foi encontrada.")
        return

    for arquivo in os.listdir(pdf_path):
        if arquivo.endswith(".pdf"):
            try:
                print(f"\n--- Iniciando: {arquivo} ---")
                caminho_completo = os.path.join(pdf_path, arquivo)
                reader = PdfReader(caminho_completo)
                
                texto_completo = ""
                for page in reader.pages:
                    try:
                        extraido = page.extract_text()
                        if extraido:
                            texto_completo += extraido + "\n"
                    except:
                        continue

                if not texto_completo.strip():
                    print(f" {arquivo} ignorado: Sem texto extraível.")
                    continue

                chunks = text_splitter.split_text(texto_completo)
                print(f"Texto dividido em {len(chunks)} pedaços.")

                for i, chunk_text in enumerate(chunks):
                    embedding = embed_model.embed_query(chunk_text)

                    data = {
                        "nome_documento": f"{arquivo}_parte_{i+1}",
                        "conteudo": chunk_text,
                        "embedding": embedding
                    }

                    supabase.table("documentos").insert(data).execute()
                    
                    if (i + 1) % 5 == 0:
                        print(f"Enviados {i+1} pedaços...")

                print(f"Sucesso Total: {arquivo} processado e fatiado.")

            except Exception as e:
                print(f"rro crítico em {arquivo}: {e}")

if __name__ == "__main__":
    print("Iniciando Ingestão de Conhecimento do Cyborg AI...")
    processar_pdfs()
