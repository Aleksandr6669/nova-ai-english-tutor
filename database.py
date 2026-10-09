import sqlite3
import os
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = os.path.join(os.path.dirname(__file__), 'tutor.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
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
    
    conn.commit()
    conn.close()

def create_user(username, email, password):
    conn = get_db()
    cursor = conn.cursor()
    try:
        pw_hash = generate_password_hash(password)
        cursor.execute("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                       (username.strip(), email.strip().lower(), pw_hash))
        user_id = cursor.lastrowid
        # Create default settings
        cursor.execute("INSERT INTO user_settings (user_id) VALUES (?)", (user_id,))
        conn.commit()
        return user_id, None
    except sqlite3.IntegrityError as e:
        if "users.email" in str(e):
            return None, "Пользователь с такой почтой уже зарегистрирован."
        elif "users.username" in str(e):
            return None, "Пользователь с таким логином уже существует."
        return None, "Ошибка регистрации: логин или email уже заняты."
    finally:
        conn.close()

def authenticate_user(email, password):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
    user = cursor.fetchone()
    conn.close()
    if user and check_password_hash(user['password_hash'], password):
        return user
    return None

def get_user_by_id(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    return user

def get_user_settings(user_id):
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
            "auto_speak": 1
        }
    return dict(settings)

def update_user_settings(user_id, groq_api_key=None, model_name=None, english_level=None, tutor_style=None, voice_rate=None, voice_pitch=None, auto_speak=None):
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
        
    if updates:
        params.append(user_id)
        cursor.execute(f"UPDATE user_settings SET {', '.join(updates)} WHERE user_id = ?", params)
        conn.commit()
    conn.close()

def save_chat_message(user_id, role, content, corrections=None):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO chat_history (user_id, role, content, corrections) VALUES (?, ?, ?, ?)",
                   (user_id, role, content, corrections))
    conn.commit()
    conn.close()

def get_recent_chat_history(user_id, limit=20):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role, content, corrections, timestamp FROM chat_history WHERE user_id = ? ORDER BY id DESC LIMIT ?", (user_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]

def clear_chat_history(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_history WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
