import os
import json
import requests
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash, send_from_directory
import database as db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_folder=os.path.join(BASE_DIR, 'static')
)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'english_ai_tutor_secret_key_2026_x99')

# Active Groq Models (October 2026)
SUPPORTED_MODELS = [
    {"id": "openai/gpt-oss-120b", "name": "OpenAI GPT-OSS 120B (Рекомендуется)", "desc": "Флагманская модель 120B: глубокие объяснения, живой диалог и грамматика"},
    {"id": "openai/gpt-oss-20b", "name": "OpenAI GPT-OSS 20B (Сверхбыстрая)", "desc": "Мгновенные реплики со скоростью до 1000 токенов/сек"},
    {"id": "qwen/qwen3.8-27b", "name": "Qwen 3.8 27B", "desc": "Отличный баланс скорости, логики и качества диалога"}
]

# Automatic resolver for older/deprecated Groq models
DEPRECATED_MODELS = {
    "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
    "llama-3.1-8b-instant": "openai/gpt-oss-20b",
    "mixtral-8x7b-32768": "openai/gpt-oss-120b",
    "gemma2-9b-it": "openai/gpt-oss-20b",
    "qwen/qwen3-32b": "openai/gpt-oss-120b",
    "meta-llama/llama-4-scout-17b-16e-instruct": "openai/gpt-oss-120b"
}

def build_system_prompt(level="intermediate", style="friendly"):
    return f"""You are 'Nova', an empathetic, engaging, and professional bilingual AI English tutor and conversational partner.
You possess native-level fluency in both RUSSIAN (Русский) and ENGLISH (English).
Your mission is to help the user learn and practice English with confidence, whether they write or speak to you in English, in Russian, or mix both languages.

Current student profile:
- CEFR Level: {level.upper()}
- Interaction style: {style}

Bilingual Tutoring Guidelines:
1. COMPLETE BILINGUAL UNDERSTANDING:
   - You completely understand everything the user says in Russian, English, or any mix of both languages.
   - If the user asks a question in Russian (e.g. "как сказать...", "в чем разница между...", "объясни правило...", "переведи..."), explain clearly, warmly, and concisely in Russian, providing natural English examples, usage notes, and pronunciation tips.
   - If the user responds in Russian during a dialog, understand their thought, show how a native speaker would express it naturally in English, and kindly encourage them to practice saying it in English.
   - If the user speaks or writes in English, reply predominantly in natural English suitable for their CEFR level ({level}).

2. CONSTRUCTIVE CORRECTIONS:
   - If the user writes or speaks with mistakes in English, kindly address them constructively using this clear format:
     [Correction]: "Your sentence" -> "Natural way to say it" (Пояснение на русском или английском).

3. CONVERSATION FLOW:
   - Conclude your responses with an engaging, friendly question or conversational hook in English to keep the practice going.
   - Keep your tone warm, encouraging, and supportive."""

@app.route('/')
def index():
    # Pure SPA: Render the complete app directly with demo guest session if unauthenticated
    user = None
    if 'user_id' in session:
        user = db.get_user_by_id(session['user_id'])
    
    if not user:
        user = db.get_or_create_demo_user()
        session['user_id'] = user['id']
        session['username'] = user['username']

    settings = db.get_user_settings(user['id'])
    # Automatically migrate deprecated models in user settings
    if settings.get('model_name') in DEPRECATED_MODELS:
        new_model = DEPRECATED_MODELS[settings['model_name']]
        db.update_user_settings(user['id'], model_name=new_model)
        settings = db.get_user_settings(user['id'])

    history = db.get_recent_chat_history(user['id'], limit=30)
    return render_template('index.html', user=user, settings=settings, history=history, models=SUPPORTED_MODELS)

@app.route('/standalone')
def standalone():
    return send_from_directory(os.path.join(BASE_DIR, 'public'), 'index.html')

@app.route('/api/auth/status', methods=['GET'])
def auth_status():
    if 'user_id' in session:
        user = db.get_user_by_id(session['user_id'])
        if user:
            return jsonify({"authenticated": True, "username": user['username'], "email": user['email']})
    return jsonify({"authenticated": False})

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    password = data.get('password', '')
    user = db.authenticate_user(email, password)
    if user:
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({"status": "success", "username": user['username']})
    return jsonify({"error": "invalid_credentials", "message": "Неверный email или пароль"}), 401

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    if not username or not email or not password:
        return jsonify({"error": "missing_fields", "message": "Заполните все поля"}), 400
    user_id = db.create_user(username, email, password)
    if user_id:
        session['user_id'] = user_id
        session['username'] = username
        return jsonify({"status": "success", "username": username})
    return jsonify({"error": "email_exists", "message": "Email уже зарегистрирован"}), 400

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"status": "success"})

@app.route('/api/settings', methods=['POST'])
def update_settings():
    if 'user_id' not in session:
        user = db.get_or_create_demo_user()
        session['user_id'] = user['id']
        session['username'] = user['username']

    data = request.get_json() or {}
    model_name = data.get('model_name')
    if model_name in DEPRECATED_MODELS:
        model_name = DEPRECATED_MODELS[model_name]

    db.update_user_settings(
        session['user_id'],
        groq_api_key=data.get('groq_api_key'),
        model_name=model_name,
        english_level=data.get('english_level'),
        tutor_style=data.get('tutor_style'),
        voice_rate=data.get('voice_rate'),
        voice_pitch=data.get('voice_pitch'),
        auto_speak=data.get('auto_speak'),
        voice_lang=data.get('voice_lang')
    )
    return jsonify({"status": "success", "message": "Настройки сохранены"})

@app.route('/api/chat', methods=['POST'])
def chat():
    if 'user_id' not in session:
        user = db.get_or_create_demo_user()
        session['user_id'] = user['id']
        session['username'] = user['username']
        
    data = request.get_json() or {}
    user_message = data.get('message', '').strip()
    if not user_message:
        return jsonify({"error": "Сообщение не может быть пустым"}), 400
        
    settings = db.get_user_settings(session['user_id'])
    api_key = settings.get('groq_api_key') or data.get('api_key')
    if not api_key:
        return jsonify({
            "error": "api_key_missing",
            "message": "Пожалуйста, введите ваш Groq API ключ в Настройках приложения."
        }), 400
        
    model = settings.get('model_name') or 'openai/gpt-oss-120b'
    if model in DEPRECATED_MODELS:
        model = DEPRECATED_MODELS[model]
        db.update_user_settings(session['user_id'], model_name=model)

    level = settings.get('english_level') or 'intermediate'
    style = settings.get('tutor_style') or 'friendly'
    
    # Save user message to DB
    db.save_chat_message(session['user_id'], 'user', user_message)
    
    # Prepare messages payload
    system_prompt = build_system_prompt(level=level, style=style)
    history_records = db.get_recent_chat_history(session['user_id'], limit=12)
    
    messages = [{"role": "system", "content": system_prompt}]
    for msg in history_records:
        messages.append({"role": msg['role'], "content": msg['content']})
        
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1024
    }

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        # Automatic fallback if model is 404 or decommissioned
        if response.status_code == 404 and "model_not_found" in response.text and model != "openai/gpt-oss-120b":
            print(f"Model {model} not found, falling back to openai/gpt-oss-120b")
            payload["model"] = "openai/gpt-oss-120b"
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            if response.status_code == 200:
                model = "openai/gpt-oss-120b"
                db.update_user_settings(session['user_id'], model_name="openai/gpt-oss-120b")

        if response.status_code == 200:
            res_data = response.json()
            bot_text = res_data['choices'][0]['message']['content']
            db.save_chat_message(session['user_id'], 'assistant', bot_text)
            return jsonify({
                "status": "success",
                "response": bot_text,
                "model": model
            })
        else:
            err_msg = f"Groq API Error ({response.status_code}): {response.text}"
            return jsonify({"error": "groq_api_error", "message": err_msg}), response.status_code
            
    except requests.exceptions.RequestException as e:
        return jsonify({"error": "network_error", "message": f"Ошибка соединения с Groq: {str(e)}"}), 500

@app.route('/api/chat/clear', methods=['POST'])
def clear_chat():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    db.clear_chat_history(session['user_id'])
    return jsonify({"status": "success", "message": "История очищена"})

@app.errorhandler(404)
def not_found(e):
    return redirect(url_for('index'))

@app.errorhandler(500)
def server_error(e):
    return redirect(url_for('index'))

@app.errorhandler(Exception)
def handle_exception(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": "server_error", "message": str(e)}), 500
    return redirect(url_for('index'))

if __name__ == '__main__':
    print("Starting English AI Tutor Flask Server on http://127.0.0.1:5000 ...")
    app.run(debug=True, host='0.0.0.0', port=5000)
