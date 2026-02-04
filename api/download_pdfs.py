import os
from supabase import create_client
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv()

def baixar_biblioteca():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        print("Erro: SUPABASE_URL ou SUPABASE_KEY não configurados no .env")
        return

    supabase = create_client(url, key)
    bucket_name = 'biblioteca_cyborg'
    local_path = './api/documentos_pdf'

    # Garante que a pasta local existe
    if not os.path.exists(local_path):
        os.makedirs(local_path)
        print(f"Pasta criada: {local_path}")

    try:
        # Lista arquivos no bucket
        arquivos = supabase.storage.from_(bucket_name).list()
        
        if not arquivos:
            print(f"Nenhum arquivo encontrado no bucket '{bucket_name}'.")
            return

        for arquivo in arquivos:
            nome = arquivo['name']
            
            # Pula pastas ou arquivos vazios que o Supabase às vezes lista
            if nome == '.emptyFolderPlaceholder' or not nome.endswith('.pdf'):
                continue

            print(f"Baixando: {nome}...")
            caminho_local = os.path.join(local_path, nome)
            
            try:
                # Realiza o download
                res = supabase.storage.from_(bucket_name).download(nome)
                
                # Escreve em modo binário garantindo o fechamento do arquivo
                with open(caminho_local, 'wb') as f:
                    f.write(res)
                
                # Verifica se o arquivo não está vazio após o download
                if os.path.getsize(caminho_local) > 0:
                    print(f"Salvo com sucesso: {caminho_local} ({os.path.getsize(caminho_local)} bytes)")
                else:
                    print(f"Aviso: O arquivo {nome} foi baixado mas está vazio.")
                    
            except Exception as e:
                print(f"Falha ao processar o arquivo {nome}: {e}")

    except Exception as e:
        print(f"Erro ao conectar com o Supabase Storage: {e}")

if __name__ == "__main__":
    baixar_biblioteca()
