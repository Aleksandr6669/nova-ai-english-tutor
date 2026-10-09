document.addEventListener('DOMContentLoaded', () => {
    // Top Bar & Navigation
    const openDrawerBtn = document.getElementById('open-drawer-btn');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');
    const drawerPanel = document.getElementById('drawer-panel');
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const drawerSettingsGearBtn = document.getElementById('drawer-settings-gear-btn');
    const closeSettingsSheetBtn = document.getElementById('close-settings-sheet-btn');
    const settingsSheet = document.getElementById('settings-sheet');
    const linkOpenSettings = document.getElementById('link-open-settings');
    const drawerVoiceToggle = document.getElementById('drawer-voice-toggle');

    // Chat & Voice Elements
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const contentArea = document.getElementById('content-area');
    const voiceInputBtn = document.getElementById('voice-input-btn');
    const liveVoiceModeBtn = document.getElementById('live-voice-mode-btn');
    const characterOrb = document.getElementById('character-orb');
    const statusText = document.getElementById('status-text');
    const settingsForm = document.getElementById('settings-form');
    const voiceRateInput = document.getElementById('voice_rate');
    const rateVal = document.getElementById('rate-val');
    const clearHistoryRow = document.getElementById('clear-history-row');
    const drawerLangToggle = document.getElementById('drawer-lang-toggle');
    const drawerLangVal = document.getElementById('drawer-lang-val');
    const voiceLangSelect = document.getElementById('voice_lang');

    // Speech & Voice State
    let isSpeaking = false;
    let isListening = false;
    let isLiveModeActive = false;
    let synth = window.speechSynthesis;
    let selectedVoice = null;
    let enVoice = null;
    let ruVoice = null;
    let recognition = null;
    let currentVoiceLang = localStorage.getItem('nova_voice_lang') || 'ru-RU';

    // Initialize English and Russian Voices
    function initVoices() {
        if (!synth) return;
        const voices = synth.getVoices();
        enVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Alex')))
               || voices.find(v => v.lang.startsWith('en'))
               || voices[0];

        ruVoice = voices.find(v => v.lang.startsWith('ru') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Milena') || v.name.includes('Yuri') || v.name.includes('Tatyana')))
               || voices.find(v => v.lang.startsWith('ru'));

        selectedVoice = enVoice;
    }
    initVoices();
    if (synth && synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = initVoices;
    }

    function getVoiceConfig(text) {
        const cyrillic = (text.match(/[\u0400-\u04FF]/g) || []).length;
        const latin = (text.match(/[a-zA-Z]/g) || []).length;
        if (cyrillic > latin && ruVoice) {
            return { voice: ruVoice, lang: 'ru-RU' };
        }
        return { voice: enVoice || selectedVoice, lang: 'en-US' };
    }

    function updateVoiceLangUI() {
        const isRu = currentVoiceLang.startsWith('ru');
        if (drawerLangVal) {
            drawerLangVal.textContent = isRu ? 'Русский (RU)' : 'English (EN)';
            drawerLangVal.style.color = isRu ? '#60a5fa' : '#a78bfa';
        }
        if (voiceLangSelect) {
            voiceLangSelect.value = currentVoiceLang;
        }
        if (recognition) {
            recognition.lang = currentVoiceLang;
        }
    }

    // Drawer Open/Close
    function openDrawer() {
        drawerPanel.classList.add('open');
        drawerBackdrop.classList.add('active');
    }
    function closeDrawer() {
        drawerPanel.classList.remove('open');
        drawerBackdrop.classList.remove('active');
    }

    if (openDrawerBtn) openDrawerBtn.addEventListener('click', openDrawer);
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

    // Settings Sheet Open/Close
    function openSettings() {
        closeDrawer();
        settingsSheet.classList.add('active');
    }
    function closeSettings() {
        settingsSheet.classList.remove('active');
    }

    if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettings);
    if (drawerSettingsGearBtn) drawerSettingsGearBtn.addEventListener('click', openSettings);
    if (closeSettingsSheetBtn) closeSettingsSheetBtn.addEventListener('click', closeSettings);
    if (linkOpenSettings) linkOpenSettings.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });

    if (voiceRateInput && rateVal) {
        voiceRateInput.addEventListener('input', (e) => {
            rateVal.textContent = e.target.value + 'x';
        });
    }

    // Avatar State Manager
    function setOrbState(state) {
        if (!characterOrb) return;
        characterOrb.className = 'orb-sphere ' + state;
        if (state === 'speaking') {
            statusText.textContent = 'Nova говорит...';
        } else if (state === 'listening') {
            statusText.textContent = currentVoiceLang.startsWith('ru') ? 'Слушаю вас (Русский)...' : 'Слушаю вас (English)...';
        } else if (state === 'thinking') {
            statusText.textContent = 'Генерация ответа...';
        } else {
            statusText.textContent = 'Готов к разговору';
        }
    }

    // Text to Speech
    window.speakTextFromEl = function(btn) {
        if (!synth) return;
        const bubble = btn.closest('.chat-bubble');
        if (!bubble) return;
        const textEl = bubble.querySelector('.bubble-assistant-content');
        if (!textEl) return;

        synth.cancel();
        const rawText = textEl.innerText.replace(/Nova AI —.*/, '').replace(/\[Correction\].*/, '');
        const config = getVoiceConfig(rawText);
        const utterance = new SpeechSynthesisUtterance(rawText);
        if (config.voice) utterance.voice = config.voice;
        utterance.lang = config.lang;
        utterance.rate = voiceRateInput ? parseFloat(voiceRateInput.value) : 1.0;

        utterance.onstart = () => {
            isSpeaking = true;
            setOrbState('speaking');
        };
        utterance.onend = () => {
            isSpeaking = false;
            setOrbState('idle');
            if (isLiveModeActive) {
                setTimeout(startListening, 300);
            }
        };
        utterance.onerror = () => {
            isSpeaking = false;
            setOrbState('idle');
        };

        synth.speak(utterance);
    };

    // Copy Text Helper
    window.copyTextFromEl = function(btn) {
        const bubble = btn.closest('.chat-bubble');
        if (!bubble) return;
        const textEl = bubble.querySelector('.bubble-assistant-content');
        if (!textEl) return;
        navigator.clipboard.writeText(textEl.innerText).then(() => {
            btn.style.color = '#34d399';
            setTimeout(() => { btn.style.color = ''; }, 1200);
        });
    };

    // Speech Recognition Lang Toggle in Drawer & Settings
    if (drawerLangToggle) {
        drawerLangToggle.addEventListener('click', (e) => {
            e.preventDefault();
            currentVoiceLang = currentVoiceLang.startsWith('ru') ? 'en-US' : 'ru-RU';
            localStorage.setItem('nova_voice_lang', currentVoiceLang);
            updateVoiceLangUI();
            const langName = currentVoiceLang.startsWith('ru') ? 'Русский (RU)' : 'English (EN)';
            if (statusText && !isListening && !isSpeaking) {
                statusText.textContent = 'Микрофон: ' + langName;
                setTimeout(() => {
                    if (!isListening && !isSpeaking) statusText.textContent = 'Готов к разговору';
                }, 1600);
            }
            closeDrawer();
        });
    }

    if (voiceLangSelect) {
        voiceLangSelect.addEventListener('change', (e) => {
            currentVoiceLang = e.target.value;
            localStorage.setItem('nova_voice_lang', currentVoiceLang);
            updateVoiceLangUI();
        });
    }
    updateVoiceLangUI();

    // Web Speech API: Speech-to-Text
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
        recognition = new SpeechRec();
        recognition.lang = currentVoiceLang;
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isListening = true;
            if (voiceInputBtn) voiceInputBtn.classList.add('active');
            if (liveVoiceModeBtn) liveVoiceModeBtn.classList.add('active');
            setOrbState('listening');
        };

        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            chatInput.value = transcript;
            submitMessage(transcript);
        };

        recognition.onerror = (e) => {
            console.error('Speech recognition error:', e.error);
            stopListening();
        };

        recognition.onend = () => {
            stopListening();
        };
    } else {
        if (voiceInputBtn) voiceInputBtn.title = 'Web Speech Recognition не поддерживается в этом браузере';
    }

    function startListening() {
        if (!recognition) {
            alert('Голосовой ввод поддерживается в Google Chrome, Microsoft Edge и Safari.');
            return;
        }
        if (synth && synth.speaking) {
            synth.cancel();
            isSpeaking = false;
        }
        recognition.lang = currentVoiceLang;
        try {
            recognition.start();
        } catch (e) {
            console.warn('Recognition start error:', e);
        }
    }

    function stopListening() {
        isListening = false;
        if (voiceInputBtn) voiceInputBtn.classList.remove('active');
        if (!isLiveModeActive && liveVoiceModeBtn) liveVoiceModeBtn.classList.remove('active');
        if (!isSpeaking) setOrbState('idle');
    }

    if (voiceInputBtn) {
        voiceInputBtn.addEventListener('click', () => {
            if (isListening) {
                recognition.stop();
                stopListening();
            } else {
                startListening();
            }
        });
    }

    if (liveVoiceModeBtn) {
        liveVoiceModeBtn.addEventListener('click', () => {
            isLiveModeActive = !isLiveModeActive;
            liveVoiceModeBtn.classList.toggle('active', isLiveModeActive);
            if (isLiveModeActive) {
                startListening();
            } else {
                if (recognition) recognition.stop();
                stopListening();
                if (synth) synth.cancel();
            }
        });
    }

    if (drawerVoiceToggle) {
        drawerVoiceToggle.addEventListener('click', (e) => {
            e.preventDefault();
            closeDrawer();
            startListening();
        });
    }

    // Scroll Helper
    function scrollToBottom() {
        if (contentArea) {
            setTimeout(() => {
                contentArea.scrollTop = contentArea.scrollHeight;
            }, 60);
        }
    }

    // Append Message to Chat UI
    function appendMessage(role, text) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${role}`;

        if (role === 'user') {
            bubble.innerHTML = `<div class="bubble-user-content">${escapeHTML(text)}</div>`;
        } else {
            // Process [Correction] block if present
            let formattedText = escapeHTML(text);
            const correctionMatch = formattedText.match(/\[Correction\]:\s*(.*?)(?=\n\n|\n[A-Z]|$)/s);
            if (correctionMatch) {
                const corrBlock = `<div class="correction-block"><strong>[Correction]</strong>${correctionMatch[1]}</div>`;
                formattedText = formattedText.replace(correctionMatch[0], corrBlock);
            }
            formattedText = formattedText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');

            bubble.innerHTML = `
                <div class="bubble-assistant-content"><p>${formattedText}</p></div>
                <div class="msg-actions-row">
                    <button class="action-icon-btn speak-btn" title="Озвучить" onclick="speakTextFromEl(this)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    </button>
                    <button class="action-icon-btn" title="Скопировать" onclick="copyTextFromEl(this)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                </div>
                <div class="ai-disclaimer">Nova AI — виртуальный тьютор английского языка.</div>
            `;
        }

        chatMessages.appendChild(bubble);
        scrollToBottom();

        // Auto Speak if enabled
        if (role === 'assistant') {
            const autoSpeakCheck = document.getElementById('auto_speak');
            if (autoSpeakCheck && autoSpeakCheck.checked) {
                const speakBtn = bubble.querySelector('.speak-btn');
                if (speakBtn) speakTextFromEl(speakBtn);
            }
        }
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // Submit Message to Backend API
    async function submitMessage(message) {
        if (!message || !message.trim()) return;
        const cleanMsg = message.trim();
        chatInput.value = '';

        appendMessage('user', cleanMsg);
        setOrbState('thinking');

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: cleanMsg })
            });

            const data = await res.json();
            setOrbState('idle');

            if (res.ok && data.status === 'success') {
                appendMessage('assistant', data.response);
            } else if (data.error === 'api_key_missing') {
                appendMessage('assistant', '⚠️ <strong>Groq API ключ не найден!</strong><br>Пожалуйста, нажмите на иконку настроек вверху справа и введите ваш бесплатный ключ с <a href="https://console.groq.com/keys" target="_blank" style="color: #60a5fa; text-decoration: underline;">console.groq.com</a>.');
            } else {
                appendMessage('assistant', `⚠️ Ошибка: ${data.message || 'Не удалось получить ответ от Groq.'}`);
            }
        } catch (err) {
            setOrbState('idle');
            console.error('Chat error:', err);
            appendMessage('assistant', '⚠️ Ошибка подключения к серверу. Проверьте интернет-соединение.');
        }
    }

    // Form Submit Listener
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitMessage(chatInput.value);
        });
    }

    // Quick Topic Chips
    document.querySelectorAll('.topic-chip, .topic-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const prompt = btn.dataset.prompt;
            if (prompt) {
                if (drawerPanel.classList.contains('open')) closeDrawer();
                submitMessage(prompt);
            }
        });
    });

    // New Chat Button
    const newChatBtn = document.getElementById('new-chat-drawer-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeDrawer();
            chatInput.focus();
        });
    }

    // Settings Form Submission
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                groq_api_key: document.getElementById('groq_api_key').value.trim(),
                model_name: document.getElementById('model_name').value,
                english_level: document.getElementById('english_level').value,
                tutor_style: document.getElementById('tutor_style').value,
                voice_rate: document.getElementById('voice_rate').value,
                auto_speak: document.getElementById('auto_speak').checked,
                voice_lang: document.getElementById('voice_lang').value
            };

            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) {
                    alert('Настройки успешно сохранены!');
                    closeSettings();
                } else {
                    alert('Ошибка: ' + (data.message || 'Не удалось сохранить настройки'));
                }
            } catch (err) {
                alert('Ошибка сети при сохранении настроек');
            }
        });
    }

    // Clear History
    if (clearHistoryRow) {
        clearHistoryRow.addEventListener('click', async () => {
            if (!confirm('Вы уверены, что хотите очистить всю историю диалога?')) return;
            try {
                const res = await fetch('/api/chat/clear', { method: 'POST' });
                if (res.ok) {
                    chatMessages.innerHTML = '';
                    closeSettings();
                }
            } catch (err) {
                alert('Не удалось очистить историю');
            }
        });
    }
});
