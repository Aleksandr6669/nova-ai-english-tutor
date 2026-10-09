document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const voiceInputBtn = document.getElementById('voice-input-btn');
    const speechStatus = document.getElementById('speech-recognition-status');
    const characterOrb = document.getElementById('character-orb');
    const characterState = document.getElementById('character-state');
    const waveVisualizer = document.getElementById('wave-visualizer');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    
    // Settings modal elements
    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
    const settingsForm = document.getElementById('settings-form');
    const toggleVoiceBtn = document.getElementById('toggle-voice-btn');
    const toggleKeyBtn = document.getElementById('toggle-key-visibility');
    const apiKeyInput = document.getElementById('groq_api_key');
    const linkOpenSettings = document.getElementById('link-open-settings');

    const voiceRateRange = document.getElementById('voice_rate');
    const voicePitchRange = document.getElementById('voice_pitch');
    const voiceRateVal = document.getElementById('voice_rate_val');
    const voicePitchVal = document.getElementById('voice_pitch_val');

    // State
    let isSpeaking = false;
    let isListening = false;
    let autoSpeak = true;
    let selectedVoice = null;
    let recognition = null;
    let synth = window.speechSynthesis;

    // Load available voices for SpeechSynthesis
    function initVoices() {
        if (!synth) return;
        const voices = synth.getVoices();
        // Prefer natural English voices (Google US English, Samantha, Daniel, etc.)
        selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))) 
                     || voices.find(v => v.lang.startsWith('en')) 
                     || voices[0];
    }
    initVoices();
    if (synth && synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = initVoices;
    }

    // Modal Events
    function showModal() {
        settingsModal.classList.add('show');
    }
    function hideModal() {
        settingsModal.classList.remove('show');
    }

    if (openSettingsBtn) openSettingsBtn.addEventListener('click', showModal);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', hideModal);
    if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', hideModal);
    if (linkOpenSettings) linkOpenSettings.addEventListener('click', (e) => { e.preventDefault(); showModal(); });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) hideModal();
    });

    if (toggleKeyBtn && apiKeyInput) {
        toggleKeyBtn.addEventListener('click', () => {
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                toggleKeyBtn.textContent = 'Скрыть';
            } else {
                apiKeyInput.type = 'password';
                toggleKeyBtn.textContent = 'Показать';
            }
        });
    }

    if (voiceRateRange) {
        voiceRateRange.addEventListener('input', (e) => {
            voiceRateVal.textContent = e.target.value + 'x';
        });
    }
    if (voicePitchRange) {
        voicePitchRange.addEventListener('input', (e) => {
            voicePitchVal.textContent = e.target.value;
        });
    }

    // Toggle voice playback button in navbar
    if (toggleVoiceBtn) {
        toggleVoiceBtn.addEventListener('click', () => {
            autoSpeak = !autoSpeak;
            toggleVoiceBtn.classList.toggle('active', autoSpeak);
            if (!autoSpeak && synth) synth.cancel();
        });
    }

    // Save Settings Form
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(settingsForm);
            const payload = {
                groq_api_key: formData.get('groq_api_key'),
                model_name: formData.get('model_name'),
                english_level: formData.get('english_level'),
                tutor_style: formData.get('tutor_style'),
                voice_rate: parseFloat(formData.get('voice_rate')),
                voice_pitch: parseFloat(formData.get('voice_pitch')),
                auto_speak: formData.get('auto_speak') ? 1 : 0
            };

            autoSpeak = !!payload.auto_speak;
            if (toggleVoiceBtn) toggleVoiceBtn.classList.toggle('active', autoSpeak);

            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) {
                    alert('Настройки успешно сохранены!');
                    hideModal();
                } else {
                    alert('Ошибка сохранения: ' + (data.message || 'Неизвестная ошибка'));
                }
            } catch (err) {
                alert('Сетевая ошибка при сохранении настроек.');
            }
        });
    }

    // Character State Visualizer
    function setCharacterState(state) {
        characterOrb.className = 'avatar-orb ' + state;
        const badgeText = characterState.querySelector('.state-text');
        const badgeIcon = characterState.querySelector('.state-icon');

        if (state === 'speaking') {
            badgeIcon.textContent = '🔊';
            badgeText.textContent = 'Nova is speaking...';
            waveVisualizer.classList.add('active');
        } else if (state === 'listening') {
            badgeIcon.textContent = '🎙️';
            badgeText.textContent = 'Listening to you...';
            waveVisualizer.classList.add('active');
        } else if (state === 'thinking') {
            badgeIcon.textContent = '⚡';
            badgeText.textContent = 'Thinking with Groq...';
            waveVisualizer.classList.add('active');
        } else {
            badgeIcon.textContent = '✨';
            badgeText.textContent = 'Ready to talk';
            waveVisualizer.classList.remove('active');
        }
    }

    // Text to Speech (Voice Output)
    window.speakText = function(btnOrText) {
        if (!synth) {
            console.warn('Speech synthesis not supported in this browser.');
            return;
        }

        let text = '';
        if (typeof btnOrText === 'string') {
            text = btnOrText;
        } else if (btnOrText && btnOrText.parentElement) {
            const msgTextEl = btnOrText.parentElement.querySelector('.msg-text');
            if (msgTextEl) text = msgTextEl.innerText;
        }

        if (!text) return;

        synth.cancel(); // Stop any ongoing speech

        const utterance = new SpeechSynthesisUtterance(text);
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.lang = 'en-US';
        utterance.rate = voiceRateRange ? parseFloat(voiceRateRange.value) : 1.0;
        utterance.pitch = voicePitchRange ? parseFloat(voicePitchRange.value) : 1.0;

        utterance.onstart = () => {
            isSpeaking = true;
            setCharacterState('speaking');
        };

        utterance.onend = () => {
            isSpeaking = false;
            setCharacterState('idle');
        };

        utterance.onerror = () => {
            isSpeaking = false;
            setCharacterState('idle');
        };

        synth.speak(utterance);
    };

    // Speech-to-Text (Voice Input via Web Speech API)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isListening = true;
            voiceInputBtn.classList.add('recording');
            speechStatus.textContent = 'Recording speech... Speak clearly in English';
            setCharacterState('listening');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            chatInput.value = transcript;
            speechStatus.textContent = 'Voice captured! Sending...';
            sendMessage(transcript);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            speechStatus.textContent = 'Microphone error: ' + event.error;
            stopListening();
        };

        recognition.onend = () => {
            stopListening();
        };
    } else {
        voiceInputBtn.title = 'Speech Recognition is not supported by your browser (use Chrome/Edge/Safari)';
        speechStatus.textContent = 'Voice input: Web Speech API unavailable in this browser';
    }

    function toggleListening() {
        if (!recognition) {
            alert('Голосовой ввод не поддерживается данным браузером. Рекомендуем использовать Google Chrome или Edge.');
            return;
        }
        if (isListening) {
            recognition.stop();
            stopListening();
        } else {
            if (synth) synth.cancel();
            recognition.start();
        }
    }

    function stopListening() {
        isListening = false;
        voiceInputBtn.classList.remove('recording');
        speechStatus.textContent = 'Microphone: Ready';
        if (!isSpeaking) setCharacterState('idle');
    }

    if (voiceInputBtn) {
        voiceInputBtn.addEventListener('click', toggleListening);
    }

    // Quick Practice Topics Click
    document.querySelectorAll('.topic-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const prompt = pill.getAttribute('data-prompt');
            chatInput.value = prompt;
            sendMessage(prompt);
        });
    });

    // Auto-expand textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (text) sendMessage(text);
        }
    });

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text) sendMessage(text);
    });

    // Send Message Logic
    async function sendMessage(messageText) {
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // Append user message to chat UI
        appendMessage('user', messageText);
        setCharacterState('thinking');

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({message: messageText})
            });
            const data = await res.json();

            if (res.ok) {
                appendMessage('assistant', data.response);
                if (autoSpeak) {
                    speakText(data.response);
                } else {
                    setCharacterState('idle');
                }
            } else {
                setCharacterState('idle');
                if (data.error === 'api_key_missing') {
                    appendMessage('assistant', `⚠️ <strong>Groq API Key отсутствует:</strong> ${data.message} <br><button class="btn btn-secondary btn-sm" onclick="document.getElementById('open-settings-btn').click()" style="margin-top:8px;">Открыть Настройки</button>`);
                } else {
                    appendMessage('assistant', `❌ <strong>Ошибка:</strong> ${data.message || 'Не удалось получить ответ от Groq'}`);
                }
            }
        } catch (err) {
            setCharacterState('idle');
            appendMessage('assistant', `❌ <strong>Сетевая ошибка:</strong> Не удалось связаться с сервером.`);
        }
    }

    // Append Message to UI
    function appendMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role === 'user' ? 'user-message' : 'assistant-message'}`;

        const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        let avatarHtml = '';
        if (role === 'assistant') {
            avatarHtml = '<div class="avatar-glow"></div>';
        } else {
            avatarHtml = '<div class="user-avatar-circle">U</div>';
        }

        let speakBtnHtml = '';
        if (role === 'assistant') {
            speakBtnHtml = `
                <button class="speak-msg-btn" title="Озвучить ответ" onclick="speakText(this)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    <span>Слушать</span>
                </button>
            `;
        }

        msgDiv.innerHTML = `
            <div class="msg-avatar">${avatarHtml}</div>
            <div class="msg-body">
                <div class="msg-header">
                    <span class="sender-name">${role === 'user' ? 'You' : 'Nova'}</span>
                    <span class="msg-time">${timeStr}</span>
                </div>
                <div class="msg-text">${formatMessageText(content)}</div>
                ${speakBtnHtml}
            </div>
        `;

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function formatMessageText(text) {
        // Convert basic markdown tags to HTML
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
            .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
            .replace(/\\[Correction\\]:(.*?)(?=\\n|$)/g, '<div class="grammar-correction-card">💡 <strong>Correction:</strong>$1</div>')
            .replace(/\\n/g, '<br>');
    }

    // Clear Chat
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', async () => {
            if (confirm('Вы уверены, что хотите очистить историю чата?')) {
                try {
                    await fetch('/api/chat/clear', {method: 'POST'});
                    chatMessages.innerHTML = '';
                    appendMessage('assistant', "Conversation history cleared! Let's start fresh. What would you like to talk about today?");
                } catch (e) {
                    console.error(e);
                }
            }
        });
    }
});
