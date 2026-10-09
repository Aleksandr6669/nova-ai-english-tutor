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

SUPPORTED_MODELS = [
    {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B (Recommended)", "desc": "Самая умная модель для глубоких объяснений и свободной речи"},
    {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "desc": "Сверхбыстрая легковесная модель для мгновенных реплик"},
    {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B", "desc": "Отличный баланс скорости и качества контекста"},
    {"id": "gemma2-9b-it", "name": "Gemma 2 9B IT", "desc": "Компактная и эффективная модель от Google в Groq Cloud"}
]

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
    if 'user_id' not in session:
        return redirect(url_for('login'))
    user = db.get_user_by_id(session['user_id'])
    if not user:
        # In serverless environments, if instance reloaded, re-create demo user smoothly
        user = db.get_or_create_demo_user()
        session['user_id'] = user['id']
        session['username'] = user['username']
    settings = db.get_user_settings(user['id'])
    history = db.get_recent_chat_history(user['id'], limit=30)
    return render_template('index.html', user=user, settings=settings, models=SUPPORTED_MODELS, history=history)

@app.route('/demo-login')
def demo_login():
    user = db.get_or_create_demo_user()
    session['user_id'] = user['id']
    session['username'] = user['username']
    flash('Вы вошли как гость (демо-режим). Начните диалог или введите API-ключ в настройках.', 'info')
    return redirect(url_for('index'))

@app.route('/standalone')
def standalone():
    standalone_file = os.path.join(BASE_DIR, 'english_ai_tutor.html')
    if os.path.exists(standalone_file):
        return send_from_directory(BASE_DIR, 'english_ai_tutor.html')
    return redirect(url_for('index'))

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'static'), filename)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(url_for('index'))
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()
        
        if not username or not email or not password:
            flash('Пожалуйста, заполните все поля формы.', 'danger')
            return render_template('register.html', username=username, email=email)
            
        user_id, error = db.create_user(username, email, password)
        if error:
            flash(error, 'danger')
            return render_template('register.html', username=username, email=email)
            
        session['user_id'] = user_id
        session['username'] = username
        flash('Регистрация успешна! Добро пожаловать.', 'success')
        return redirect(url_for('index'))
        
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('index'))
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()
        
        user = db.authenticate_user(email, password)
        if user:
            session['user_id'] = user['id']
            session['username'] = user['username']
            return redirect(url_for('index'))
        else:
            flash('Неверный адрес электронной почты или пароль.', 'danger')
            return render_template('login.html', email=email)
            
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Вы успешно вышли из системы.', 'info')
    return redirect(url_for('login'))

@app.route('/api/settings', methods=['POST'])
def save_settings():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json() or {}
    db.update_user_settings(
        session['user_id'],
        groq_api_key=data.get('groq_api_key'),
        model_name=data.get('model_name'),
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
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.get_json() or {}
    user_message = data.get('message', '').strip()
    if not user_message:
        return jsonify({"error": "Сообщение не может быть пустым"}), 400
        
    settings = db.get_user_settings(session['user_id'])
    api_key = settings.get('groq_api_key')
    if not api_key:
        return jsonify({
            "error": "api_key_missing",
            "message": "Пожалуйста, введите ваш Groq API ключ в Настройках приложения (кнопка в правом верхнем углу)."
        }), 400
        
    model = settings.get('model_name') or 'llama-3.3-70b-versatile'
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
        
    try:
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
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        
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
    if 'user_id' in session:
        return redirect(url_for('index'))
    return redirect(url_for('login'))

@app.errorhandler(500)
def server_error(e):
    if 'user_id' in session:
        return redirect(url_for('index'))
    return redirect(url_for('login'))

@app.errorhandler(Exception)
def handle_exception(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": "server_error", "message": str(e)}), 500
    try:
        if 'user_id' in session:
            return redirect(url_for('index'))
        return redirect(url_for('login'))
    except Exception:
        return render_template('login.html', error="Произошла временная ошибка, попробуйте войти снова."), 200

if __name__ == '__main__':
    print("Starting English AI Tutor Flask Server on http://127.0.0.1:5000 ...")
    app.run(debug=True, host='0.0.0.0', port=5000)
