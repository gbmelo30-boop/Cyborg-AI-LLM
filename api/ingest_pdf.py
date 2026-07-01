# ==============================================================================
# INGESTÃO DE PDFs -> banco local SQLite (RAG).
# Lê os PDFs de ./documentos_pdf, fatia em trechos, gera embeddings e grava
# tudo no SQLite local (tabela documentos). Rode uma vez (e sempre que trocar
# os PDFs):   python3 api/ingest_pdf.py
# ==============================================================================
import os
from pypdf import PdfReader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter

import db_local

embed_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


def processar_pdfs():
    db_local.init_db()
    db_local.clear_documents()  # reingestão limpa (evita duplicar trechos)

    pdf_path = os.path.join(os.path.dirname(__file__), "documentos_pdf")

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        length_function=len,
        separators=["\n\n", "\n", " ", ""],
    )

    if not os.path.exists(pdf_path):
        print(f"Erro: a pasta {pdf_path} não foi encontrada.")
        return

    total = 0
    for arquivo in sorted(os.listdir(pdf_path)):
        if not arquivo.endswith(".pdf"):
            continue
        try:
            print(f"\n--- Iniciando: {arquivo} ---")
            reader = PdfReader(os.path.join(pdf_path, arquivo))

            texto_completo = ""
            for page in reader.pages:
                try:
                    extraido = page.extract_text()
                    if extraido:
                        texto_completo += extraido + "\n"
                except Exception:
                    continue

            if not texto_completo.strip():
                print(f"  {arquivo} ignorado: sem texto extraível.")
                continue

            chunks = text_splitter.split_text(texto_completo)
            print(f"  {len(chunks)} trechos.")

            for i, chunk_text in enumerate(chunks):
                embedding = embed_model.embed_query(chunk_text)
                db_local.add_document(f"{arquivo}_parte_{i+1}", chunk_text, embedding)
                total += 1
                if (i + 1) % 20 == 0:
                    print(f"    ... {i+1} trechos gravados")

            print(f"  OK: {arquivo}")
        except Exception as e:
            print(f"  Erro em {arquivo}: {e}")

    print(f"\nConcluído. Total de trechos no banco: {db_local.count_documents()} (adicionados agora: {total})")


if __name__ == "__main__":
    print("Iniciando ingestão de conhecimento do Cyborg AI (SQLite local)...")
    processar_pdfs()
