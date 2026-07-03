# ==============================================================================
# BANCO DE DADOS LOCAL (SQLite) — autônomo, sem dependências externas.
# Guarda sessões, mensagens e os documentos do RAG (embeddings) num único
# arquivo em ../data/cyborg.db. A busca vetorial do RAG é feita em Python.
# ==============================================================================
import os
import io
import csv
import uuid
import hashlib
import sqlite3
import threading
from datetime import datetime, timezone, timedelta

try:
    import numpy as np
except Exception:
    np = None

DB_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DB_PATH = os.path.join(DB_DIR, "cyborg.db")

_lock = threading.Lock()
_vec_cache = None  # (ids, conteudos, matriz_normalizada)


def _conn():
    os.makedirs(DB_DIR, exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL;")
    c.execute("PRAGMA foreign_keys=ON;")
    return c


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def init_db():
    with _lock, _conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                grupo TEXT DEFAULT 'Uso Individual',
                tema TEXT DEFAULT 'Geral',
                user_name TEXT,
                is_pinned INTEGER DEFAULT 0,
                oculta_para_usuario INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('user','assistant')),
                content TEXT NOT NULL,
                used_rag INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS documentos (
                id TEXT PRIMARY KEY,
                nome_documento TEXT,
                conteudo TEXT,
                embedding BLOB
            );
            CREATE INDEX IF NOT EXISTS idx_msg_session ON chat_messages(session_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_sess_user ON chat_sessions(user_id);
            CREATE TABLE IF NOT EXISTS config (
                chave TEXT PRIMARY KEY,
                valor TEXT
            );
            """
        )
        # Valores padrão do painel admin (só inserem se ainda não existirem)
        c.execute("INSERT OR IGNORE INTO config (chave,valor) VALUES ('gravar_no_bd','true')")
        c.execute("INSERT OR IGNORE INTO config (chave,valor) VALUES ('rag_padrao','false')")
        # Anonimizacao: garante que nenhum nome real fique guardado no banco.
        c.execute("UPDATE chat_sessions SET user_name=NULL WHERE user_name IS NOT NULL")


# ------------------------------------------------------------------- Config (admin)
def get_config(chave, default=None):
    with _conn() as c:
        r = c.execute("SELECT valor FROM config WHERE chave=?", (chave,)).fetchone()
    return r["valor"] if r else default


def set_config(chave, valor):
    with _lock, _conn() as c:
        c.execute(
            "INSERT INTO config (chave,valor) VALUES (?,?) "
            "ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor",
            (chave, str(valor)),
        )


def get_bool(chave, default=False):
    v = get_config(chave, None)
    if v is None:
        return default
    return str(v).lower() in ("1", "true", "yes", "on", "sim")


def clear_history():
    """Apaga TODAS as sessões e mensagens (não mexe nos documentos do RAG)."""
    with _lock, _conn() as c:
        c.execute("DELETE FROM chat_messages")
        c.execute("DELETE FROM chat_sessions")


def list_all_sessions():
    """Todas as sessões (inclui ocultas) com contagem de mensagens — uso admin."""
    with _conn() as c:
        rows = c.execute(
            "SELECT s.id, s.user_id, s.user_name, s.grupo, s.tema, s.title, s.created_at, "
            "       s.oculta_para_usuario, "
            "       (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) AS n_msgs "
            "FROM chat_sessions s ORDER BY s.created_at DESC"
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["participante"] = anon_label(d.get("user_id"))
        d["user_name"] = d["participante"]
        out.append(d)
    return out


def stats():
    with _conn() as c:
        ns = c.execute("SELECT COUNT(*) AS n FROM chat_sessions").fetchone()["n"]
        nm = c.execute("SELECT COUNT(*) AS n FROM chat_messages").fetchone()["n"]
        nd = c.execute("SELECT COUNT(*) AS n FROM documentos").fetchone()["n"]
    return {"sessoes": ns, "mensagens": nm, "documentos": nd}


# ------------------------------------------------------------------ Sessoes
def anon_label(user_id):
    """Rotulo anonimo e estavel por participante (derivado do ID do navegador).
    Dois usuarios que digitem o mesmo nome recebem rotulos diferentes."""
    if not user_id:
        return "Participante ?"
    codigo = hashlib.sha1(str(user_id).encode("utf-8")).hexdigest()[:6].upper()
    return "Participante " + codigo


def create_session(user_id, title, grupo="Uso Individual", tema="Geral", user_name=None):
    sid = str(uuid.uuid4())
    ts = now_iso()
    user_name = None  # anonimizacao: o nome real nunca e gravado
    raw = (title or "").strip()
    titulo = (raw[:30] + "...") if len(raw) > 30 else (raw or "Nova conversa")
    if not get_bool("gravar_no_bd", True):
        # Gravação desligada no painel admin: sessão efêmera (não persiste)
        return {"id": sid, "user_id": user_id, "title": titulo, "grupo": grupo,
                "tema": tema, "user_name": user_name, "is_pinned": False,
                "created_at": ts, "gravado": False}
    with _lock, _conn() as c:
        c.execute(
            "INSERT INTO chat_sessions (id,user_id,title,grupo,tema,user_name,is_pinned,oculta_para_usuario,created_at)"
            " VALUES (?,?,?,?,?,?,0,0,?)",
            (sid, user_id, titulo, grupo, tema, user_name, ts),
        )
    return {
        "id": sid, "user_id": user_id, "title": titulo, "grupo": grupo,
        "tema": tema, "user_name": user_name, "is_pinned": False, "created_at": ts,
    }


def list_sessions(user_id):
    with _conn() as c:
        rows = c.execute(
            "SELECT id,title,grupo,tema,is_pinned,created_at FROM chat_sessions"
            " WHERE user_id=? AND oculta_para_usuario=0"
            " ORDER BY is_pinned DESC, created_at DESC",
            (user_id,),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["is_pinned"] = bool(d["is_pinned"])
        out.append(d)
    return out


def update_session(session_id, title=None, is_pinned=None, oculta=None):
    sets, vals = [], []
    if title is not None:
        sets.append("title=?"); vals.append(str(title)[:60])
    if is_pinned is not None:
        sets.append("is_pinned=?"); vals.append(1 if is_pinned else 0)
    if oculta is not None:
        sets.append("oculta_para_usuario=?"); vals.append(1 if oculta else 0)
    if not sets:
        return
    vals.append(session_id)
    with _lock, _conn() as c:
        c.execute(f"UPDATE chat_sessions SET {', '.join(sets)} WHERE id=?", vals)


# ----------------------------------------------------------------- Mensagens
def add_message(session_id, role, content, used_rag=False):
    if role not in ("user", "assistant"):
        role = "assistant"
    mid = str(uuid.uuid4())
    ts = now_iso()
    if not get_bool("gravar_no_bd", True):
        return {"id": mid, "created_at": ts, "gravado": False}
    with _lock, _conn() as c:
        c.execute(
            "INSERT INTO chat_messages (id,session_id,role,content,used_rag,created_at)"
            " VALUES (?,?,?,?,?,?)",
            (mid, session_id, role, content, 1 if used_rag else 0, ts),
        )
    return {"id": mid, "created_at": ts}


def get_messages(session_id):
    with _conn() as c:
        rows = c.execute(
            "SELECT role,content,created_at FROM chat_messages WHERE session_id=? ORDER BY created_at ASC",
            (session_id,),
        ).fetchall()
    return [dict(r) for r in rows]


# --------------------------------------------------------------- Exportar CSV
def _fmt_dt(iso_str):
    try:
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        try:
            from zoneinfo import ZoneInfo
            dt = dt.astimezone(ZoneInfo("America/Sao_Paulo"))
        except Exception:
            dt = dt.astimezone(timezone(timedelta(hours=-3)))
        return dt.strftime("%d/%m/%Y %H:%M:%S")
    except Exception:
        return iso_str or ""


def export_csv(user_id=None, delimiter=";"):
    """Gera CSV pareando cada pergunta (usuario) com a resposta (chatbot) seguinte,
    por sessao - mesma logica do 'Codigo 3' do Supabase. Colunas bem separadas:
    session_id, usuario, grupo, tema, pergunta, resposta, data_hora.
    Delimitador ';' (padrao do Excel em pt-BR -> abre em colunas)."""
    q = "SELECT id,user_id,user_name,grupo,tema,created_at FROM chat_sessions"
    params = []
    if user_id:
        q += " WHERE user_id=?"; params.append(user_id)
    q += " ORDER BY created_at ASC"

    buf = io.StringIO()
    w = csv.writer(buf, delimiter=delimiter)
    w.writerow(["session_id", "participante", "grupo", "tema", "pergunta", "resposta", "data_hora"])
    with _conn() as c:
        sessions = c.execute(q, params).fetchall()
        for s in sessions:
            participante = anon_label(s["user_id"])
            msgs = c.execute(
                "SELECT role,content,created_at FROM chat_messages WHERE session_id=? ORDER BY created_at ASC",
                (s["id"],),
            ).fetchall()
            i = 0
            while i < len(msgs):
                if msgs[i]["role"] == "user":
                    pergunta = msgs[i]["content"]
                    data_hora = _fmt_dt(msgs[i]["created_at"])
                    resposta = ""
                    if i + 1 < len(msgs) and msgs[i + 1]["role"] == "assistant":
                        resposta = msgs[i + 1]["content"]
                        i += 2
                    else:
                        i += 1
                    w.writerow([s["id"], participante, s["grupo"], s["tema"], pergunta, resposta, data_hora])
                else:
                    i += 1
    return buf.getvalue()


# --------------------------------------------------------- Documentos (RAG)
def _emb_to_blob(vec):
    return np.asarray(vec, dtype=np.float32).tobytes()


def _blob_to_emb(blob):
    return np.frombuffer(blob, dtype=np.float32)


def clear_documents():
    global _vec_cache
    with _lock, _conn() as c:
        c.execute("DELETE FROM documentos")
    _vec_cache = None


def add_document(nome, conteudo, embedding):
    global _vec_cache
    did = str(uuid.uuid4())
    with _lock, _conn() as c:
        c.execute(
            "INSERT INTO documentos (id,nome_documento,conteudo,embedding) VALUES (?,?,?,?)",
            (did, nome, conteudo, _emb_to_blob(embedding)),
        )
    _vec_cache = None


def count_documents():
    with _conn() as c:
        return c.execute("SELECT COUNT(*) AS n FROM documentos").fetchone()["n"]


def _load_vectors():
    global _vec_cache
    if _vec_cache is not None:
        return _vec_cache
    ids, conts, mats = [], [], []
    with _conn() as c:
        for r in c.execute("SELECT id,conteudo,embedding FROM documentos"):
            ids.append(r["id"]); conts.append(r["conteudo"]); mats.append(_blob_to_emb(r["embedding"]))
    if mats:
        M = np.vstack(mats).astype(np.float32)
        norms = np.linalg.norm(M, axis=1, keepdims=True)
        norms[norms == 0] = 1e-9
        Mn = M / norms
    else:
        Mn = np.zeros((0, 0), dtype=np.float32)
    _vec_cache = (ids, conts, Mn)
    return _vec_cache


def search_documents(query_embedding, threshold=0.55, count=3):
    """Busca por similaridade de cosseno em Python. Corpus pequeno -> instantaneo."""
    if np is None:
        return []
    ids, conts, Mn = _load_vectors()
    if len(conts) == 0:
        return []
    q = np.asarray(query_embedding, dtype=np.float32)
    qn = q / (np.linalg.norm(q) or 1e-9)
    sims = Mn @ qn
    order = np.argsort(-sims)
    res = []
    for idx in order:
        if float(sims[idx]) < threshold:
            break
        res.append({"conteudo": conts[idx], "similaridade": float(sims[idx])})
        if len(res) >= count:
            break
    return res
