import os
from pypdf import PdfReader
from supabase import create_client
from langchain_community.embeddings import HuggingFaceEmbeddings
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
embed_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

def processar_pdfs():
    pdf_path = "./api/documentos_pdf"
    
    for arquivo in os.listdir(pdf_path):
        if arquivo.endswith(".pdf"):
            try:
                print(f"--- Processando: {arquivo} ---")
                reader = PdfReader(f"{pdf_path}/{arquivo}")
                texto_completo = ""
                
                for page in reader.pages:
                    try:
                        extraido = page.extract_text()
                        if extraido:
                            texto_completo += extraido
                    except:
                        continue

                if not texto_completo.strip():
                    print(f"⚠️ {arquivo} ignorado: Sem texto extraível.")
                    continue

                # Gera o vetor
                embedding = embed_model.embed_query(texto_completo)


                data = {
                    "nome_documento": arquivo,
                    "conteudo": texto_completo,
                    "embedding": embedding
                }

                supabase.table("documentos").insert(data).execute()
                print(f"✅ Sucesso: {arquivo} enviado ao banco.")

            except Exception as e:
                print(f"❌ Erro em {arquivo}: {e}")

if __name__ == "__main__":
    processar_pdfs()
