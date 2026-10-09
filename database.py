import sqlite3
import os

try:
    from werkzeug.security import generate_password_hash, check_password_hash
except ImportError:
    import hashlib
    import secrets

    def generate_password_hash(password):
        salt = secrets.token_hex(8)
        hashed = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
        return f"{salt}${hashed}"

    def check_password_hash(pwhash, password):
        if not pwhash or '$' not in pwhash:
            return False
        salt, hashed = pwhash.split('$', 1)
        return hashlib.sha256((salt + password).encode('utf-8')).hexdigest() == hashed

def get_db_path():
    if os.environ.get('VERCEL') or os.environ.get('AWS_LAMBDA_FUNCTION_NAME'):
        return '/tmp/tutor.db'
    local_dir = os.path.dirname(os.path.abspath(__file__))
    local_path = os.path.join(local_dir, 'tutor.db')
    try:
        test_conn = sqlite3.connect(local_path)
        test_conn.execute('CREATE TABLE IF NOT EXISTS _test_write (id INT)')
        test_conn.commit()
        test_conn.close()
        return local_path
    except Exception:
        return '/tmp/tutor.db'

DB_PATH = get_db_path()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # User settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id INTEGER PRIMARY KEY,
            groq_api_key TEXT DEFAULT "",
            model_name TEXT DEFAULT "llama-3.3-70b-versatile",
            english_level TEXT DEFAULT "intermediate",
            tutor_style TEXT DEFAULT "friendly",
            voice_rate REAL DEFAULT 1.0,
            voice_pitch REAL DEFAULT 1.0,
            auto_speak INTEGER DEFAULT 1,
            voice_lang TEXT DEFAULT "ru-RU",
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Chat history table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            corrections TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    try:
        cursor.execute('ALTER TABLE user_settings ADD COLUMN voice_lang TEXT DEFAULT "ru-RU"')
    except Exception:
        pass
    conn.commit()
    conn.close()

# Auto-initialize
try:
    init_db()
except Exception as e:
    print(f"Database init notice: {e}")

def create_user(username, email, password):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    try:
        pw_hash = generate_password_hash(password)
        cursor.execute("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                       (username.strip(), email.strip().lower(), pw_hash))
        user_id = cursor.lastrowid
        cursor.execute("INSERT INTO user_settings (user_id) VALUES (?)", (user_id,))
        conn.commit()
        return user_id, None
    except sqlite3.IntegrityError as e:
        if "users.email" in str(e):
            return None, "Пользователь с такой почтой уже зарегистрирован."
        elif "users.username" in str(e):
            return None, "Пользователь с таким логином уже существует."
        return None, "Ошибка регистрации: логин или email уже заняты."
    except Exception as e:
        return None, f"Ошибка базы данных: {str(e)}"
    finally:
        conn.close()

def authenticate_user(email, password):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
    user = cursor.fetchone()
    conn.close()
    if user and check_password_hash(user['password_hash'], password):
        return user
    return None

def get_or_create_demo_user():
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = 'demo@example.com'")
    user = cursor.fetchone()
    if not user:
        pw_hash = generate_password_hash('demo123')
        cursor.execute("INSERT INTO users (username, email, password_hash) VALUES ('Guest', 'demo@example.com', ?)", (pw_hash,))
        user_id = cursor.lastrowid
        cursor.execute("INSERT INTO user_settings (user_id) VALUES (?)", (user_id,))
        conn.commit()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
    conn.close()
    return user

def get_user_by_id(user_id):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    return user

def get_user_settings(user_id):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,))
    settings = cursor.fetchone()
    conn.close()
    if not settings:
        return {
            "groq_api_key": "",
            "model_name": "llama-3.3-70b-versatile",
            "english_level": "intermediate",
            "tutor_style": "friendly",
            "voice_rate": 1.0,
            "voice_pitch": 1.0,
            "auto_speak": 1,
            "voice_lang": "ru-RU"
        }
    return dict(settings)

def update_user_settings(user_id, groq_api_key=None, model_name=None, english_level=None, tutor_style=None, voice_rate=None, voice_pitch=None, auto_speak=None, voice_lang=None):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,))
    existing = cursor.fetchone()
    if not existing:
        cursor.execute("INSERT INTO user_settings (user_id) VALUES (?)", (user_id,))
    
    updates = []
    params = []
    if groq_api_key is not None:
        updates.append("groq_api_key = ?")
        params.append(groq_api_key.strip())
    if model_name is not None:
        updates.append("model_name = ?")
        params.append(model_name)
    if english_level is not None:
        updates.append("english_level = ?")
        params.append(english_level)
    if tutor_style is not None:
        updates.append("tutor_style = ?")
        params.append(tutor_style)
    if voice_rate is not None:
        updates.append("voice_rate = ?")
        params.append(float(voice_rate))
    if voice_pitch is not None:
        updates.append("voice_pitch = ?")
        params.append(float(voice_pitch))
    if auto_speak is not None:
        updates.append("auto_speak = ?")
        params.append(1 if auto_speak else 0)
    if voice_lang is not None:
        updates.append("voice_lang = ?")
        params.append(voice_lang)
        
    if updates:
        params.append(user_id)
        cursor.execute(f"UPDATE user_settings SET {', '.join(updates)} WHERE user_id = ?", params)
        conn.commit()
    conn.close()

def save_chat_message(user_id, role, content, corrections=None):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO chat_history (user_id, role, content, corrections) VALUES (?, ?, ?, ?)",
                   (user_id, role, content, corrections))
    conn.commit()
    conn.close()

def get_recent_chat_history(user_id, limit=20):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role, content, corrections, timestamp FROM chat_history WHERE user_id = ? ORDER BY id DESC LIMIT ?", (user_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]

def clear_chat_history(user_id):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_history WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
