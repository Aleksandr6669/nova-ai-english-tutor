// Nova AI English Tutor — Client Script (SPA & Dual Voice Engine)

document.addEventListener('DOMContentLoaded', () => {
    // Navigation & UI Elements
    const openDrawerBtn = document.getElementById('open-drawer-btn');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');
    const drawerPanel = document.getElementById('drawer-panel');
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const drawerSettingsGearBtn = document.getElementById('drawer-settings-gear-btn');
    const closeSettingsSheetBtn = document.getElementById('close-settings-sheet-btn');
    const settingsSheet = document.getElementById('settings-sheet');
    const linkOpenSettings = document.getElementById('link-open-settings');
    const newChatDrawerBtn = document.getElementById('new-chat-drawer-btn');
    const drawerVoiceToggle = document.getElementById('drawer-voice-toggle');
    const drawerLangToggle = document.getElementById('drawer-lang-toggle');
    const drawerLangVal = document.getElementById('drawer-lang-val');
    const pillAddBtn = document.getElementById('pill-add-btn');

    // Chat & Voice Elements
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const contentArea = document.getElementById('content-area');
    const voiceInputBtn = document.getElementById('voice-input-btn');
    const liveVoiceModeBtn = document.getElementById('live-voice-mode-btn');
    const characterOrbContainer = document.getElementById('character-orb-container');
    const characterOrb = document.getElementById('character-orb');
    const statusText = document.getElementById('status-text');
    const settingsForm = document.getElementById('settings-form');
    const autoSpeakCheck = document.getElementById('auto_speak');
    const voiceRateInput = document.getElementById('voice_rate');
    const rateVal = document.getElementById('rate-val');
    const clearHistoryRow = document.getElementById('clear-history-row');
    const voiceLangSelect = document.getElementById('voice_lang');

    // Dual Voice State
    let voiceMode = null; // null | 'dictation' | 'live'
    let isSpeaking = false;
    let isListening = false;
    let synth = window.speechSynthesis;
    let selectedVoice = null;
    let enVoice = null;
    let ruVoice = null;
    let recognition = null;
    let currentVoiceLang = localStorage.getItem('nova_voice_lang') || 'ru-RU';

    // TTS Voices Initialization
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

    if (synth && synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = initVoices;
    }
    initVoices();

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

    if (drawerLangToggle) {
        drawerLangToggle.addEventListener('click', (e) => {
            e.preventDefault();
            currentVoiceLang = currentVoiceLang.startsWith('ru') ? 'en-US' : 'ru-RU';
            localStorage.setItem('nova_voice_lang', currentVoiceLang);
            updateVoiceLangUI();
            const langName = currentVoiceLang.startsWith('ru') ? 'Русский (RU)' : 'English (EN)';
            if (statusText && !isListening && !isSpeaking) {
                statusText.textContent = 'Язык ввода: ' + langName;
                setTimeout(() => {
                    if (!isListening && !isSpeaking) statusText.textContent = 'Готов к разговору';
                }, 1500);
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

    // Drawer Controls
    function openDrawer() {
        if (drawerPanel) drawerPanel.classList.add('open');
        if (drawerBackdrop) drawerBackdrop.classList.add('active');
    }
    function closeDrawer() {
        if (drawerPanel) drawerPanel.classList.remove('open');
        if (drawerBackdrop) drawerBackdrop.classList.remove('active');
    }
    if (openDrawerBtn) openDrawerBtn.addEventListener('click', (e) => { e.preventDefault(); openDrawer(); });
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', (e) => { e.preventDefault(); closeDrawer(); });
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);
    if (pillAddBtn) pillAddBtn.addEventListener('click', (e) => { e.preventDefault(); openDrawer(); });

    // Settings Sheet Controls
    function openSettings() {
        closeDrawer();
        if (settingsSheet) settingsSheet.classList.add('active');
    }
    function closeSettings() {
        if (settingsSheet) settingsSheet.classList.remove('active');
    }
    if (openSettingsBtn) openSettingsBtn.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });
    if (drawerSettingsGearBtn) drawerSettingsGearBtn.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });
    if (closeSettingsSheetBtn) closeSettingsSheetBtn.addEventListener('click', (e) => { e.preventDefault(); closeSettings(); });
    if (linkOpenSettings) linkOpenSettings.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });

    if (voiceRateInput && rateVal) {
        voiceRateInput.addEventListener('input', (e) => rateVal.textContent = e.target.value + 'x');
    }

    // Settings Submit via AJAX (In-place SPA, No reload)
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(settingsForm);
            const payload = {
                groq_api_key: formData.get('groq_api_key') || '',
                model_name: formData.get('model_name') || 'openai/gpt-oss-120b',
                english_level: formData.get('english_level') || 'intermediate',
                tutor_style: formData.get('tutor_style') || 'friendly',
                voice_rate: parseFloat(formData.get('voice_rate') || 1.0),
                auto_speak: formData.get('auto_speak') === 'on' || formData.get('auto_speak') === 'true',
                voice_lang: currentVoiceLang
            };
            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    closeSettings();
                    if (statusText) {
                        statusText.textContent = 'Настройки сохранены';
                        setTimeout(() => { if (!isListening && !isSpeaking) statusText.textContent = 'Готов к разговору'; }, 1500);
                    }
                }
            } catch (err) {
                console.error('Settings save error:', err);
            }
        });
    }

    // Orb State Controller
    function setOrbState(state) {
        if (!characterOrb) return;
        characterOrb.className = 'orb-sphere ' + state;
        if (!statusText) return;
        if (state === 'speaking') {
            statusText.textContent = 'Nova говорит...';
        } else if (state === 'listening') {
            if (voiceMode === 'dictation') {
                statusText.textContent = currentVoiceLang.startsWith('ru') ? 'Диктовка: говорите...' : 'Dictation: speak now...';
            } else if (voiceMode === 'live') {
                statusText.textContent = currentVoiceLang.startsWith('ru') ? 'Лайв-общение: слушаю вас...' : 'Live: listening to you...';
            } else {
                statusText.textContent = 'Слушаю вас...';
            }
        } else if (state === 'thinking') {
            statusText.textContent = 'Nova думает...';
        } else {
            statusText.textContent = 'Готов к разговору';
        }
    }

    // ========================================================
    // DUAL VOICE ENGINE: 1) Dictation vs. 2) Live Conversation
    // ========================================================
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
        recognition = new SpeechRec();
        recognition.lang = currentVoiceLang;
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
            isListening = true;
            setOrbState('listening');
            if (voiceMode === 'dictation') {
                if (voiceInputBtn) voiceInputBtn.classList.add('active');
                if (liveVoiceModeBtn) liveVoiceModeBtn.classList.remove('active');
            } else if (voiceMode === 'live') {
                if (liveVoiceModeBtn) liveVoiceModeBtn.classList.add('active');
                if (voiceInputBtn) voiceInputBtn.classList.remove('active');
            }
        };

        recognition.onresult = (e) => {
            let interim = '';
            let final = '';
            for (let i = e.resultIndex; i < e.results.length; ++i) {
                if (e.results[i].isFinal) {
                    final += e.results[i][0].transcript;
                } else {
                    interim += e.results[i][0].transcript;
                }
            }
            const currentText = (final || interim).trim();
            if (currentText && chatInput) {
                chatInput.value = currentText;
            }

            if (final.trim()) {
                const sendText = final.trim();
                if (voiceMode === 'dictation') {
                    // Dictation: Single utterance -> stop -> submit
                    stopVoice(false);
                    submitMessage(sendText);
                } else if (voiceMode === 'live') {
                    // Live: Submit -> Let Nova answer and auto-resume listening
                    try { recognition.stop(); } catch(err) {}
                    isListening = false;
                    submitMessage(sendText);
                }
            }
        };

        recognition.onerror = (e) => {
            console.warn('Speech recognition error:', e.error);
            if (voiceMode === 'dictation') {
                stopVoice(true);
            } else if (voiceMode === 'live') {
                isListening = false;
                if (e.error === 'no-speech' || e.error === 'network') {
                    setTimeout(() => {
                        if (voiceMode === 'live' && !isSpeaking) {
                            startVoice('live');
                        }
                    }, 400);
                } else {
                    stopVoice(true);
                }
            }
        };

        recognition.onend = () => {
            isListening = false;
            if (voiceMode === 'dictation') {
                const pendingText = chatInput ? chatInput.value.trim() : '';
                stopVoice(true);
                if (pendingText) {
                    submitMessage(pendingText);
                }
            } else if (voiceMode === 'live') {
                if (!isSpeaking) {
                    setTimeout(() => {
                        if (voiceMode === 'live' && !isSpeaking) {
                            startVoice('live');
                        }
                    }, 300);
                }
            } else {
                stopVoice(true);
            }
        };
    } else {
        if (voiceInputBtn) voiceInputBtn.title = 'Web Speech Recognition не поддерживается в этом браузере';
        if (liveVoiceModeBtn) liveVoiceModeBtn.title = 'Web Speech Recognition не поддерживается в этом браузере';
    }

    function startVoice(mode) {
        if (!recognition) {
            alert('Голосовой ввод поддерживается в Google Chrome, Microsoft Edge и Safari.');
            return;
        }
        voiceMode = mode;
        if (synth) synth.cancel();
        recognition.lang = currentVoiceLang;
        try {
            recognition.start();
        } catch(e) {
            // already running
        }
    }

    function stopVoice(resetOrb = true) {
        voiceMode = null;
        isListening = false;
        if (voiceInputBtn) voiceInputBtn.classList.remove('active');
        if (liveVoiceModeBtn) liveVoiceModeBtn.classList.remove('active');
        if (recognition) {
            try { recognition.stop(); } catch(e) {}
        }
        if (resetOrb && !isSpeaking) {
            setOrbState('idle');
        }
    }

    // 1. Microphone Button Click -> DICTATION MODE
    if (voiceInputBtn) {
        voiceInputBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (voiceMode === 'dictation' && isListening) {
                const text = chatInput ? chatInput.value.trim() : '';
                stopVoice(true);
                if (text) submitMessage(text);
            } else {
                if (voiceMode === 'live') stopVoice(true);
                startVoice('dictation');
            }
        });
    }

    // 2. Waveform Button Click -> LIVE CONVERSATION MODE
    if (liveVoiceModeBtn) {
        liveVoiceModeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (voiceMode === 'live') {
                stopVoice(true);
                if (synth) synth.cancel();
            } else {
                if (voiceMode === 'dictation') stopVoice(true);
                startVoice('live');
            }
        });
    }

    if (drawerVoiceToggle) {
        drawerVoiceToggle.addEventListener('click', (e) => {
            e.preventDefault();
            closeDrawer();
            if (voiceMode === 'live') {
                stopVoice(true);
                if (synth) synth.cancel();
            } else {
                if (voiceMode === 'dictation') stopVoice(true);
                startVoice('live');
            }
        });
    }

    if (characterOrbContainer) {
        characterOrbContainer.addEventListener('click', (e) => {
            e.preventDefault();
            if (voiceMode === 'dictation' && isListening) {
                stopVoice(true);
            } else if (voiceMode === 'live') {
                stopVoice(true);
                if (synth) synth.cancel();
            } else {
                startVoice('dictation');
            }
        });
    }

    // Text-to-Speech (TTS)
    window.speakTextFromEl = function(btn) {
        if (!synth) return;
        const bubble = btn.closest('.chat-bubble');
        if (!bubble) return;
        const textEl = bubble.querySelector('.bubble-assistant-content');
        if (!textEl) return;
        const rawText = textEl.innerText.replace(/Nova AI — виртуальный.*/, '').replace(/Nova — это ИИ.*/, '').trim();
        speakRawText(rawText);
    };

    function speakRawText(rawText) {
        if (!synth || !rawText) return;
        synth.cancel();
        const config = getVoiceConfig(rawText);
        const utterance = new SpeechSynthesisUtterance(rawText);
        if (config.voice) utterance.voice = config.voice;
        utterance.lang = config.lang;
        utterance.rate = voiceRateInput ? parseFloat(voiceRateInput.value || 1.0) : 1.0;

        utterance.onstart = () => {
            isSpeaking = true;
            setOrbState('speaking');
        };

        utterance.onend = () => {
            isSpeaking = false;
            if (voiceMode === 'live') {
                setOrbState('listening');
                setTimeout(() => {
                    if (voiceMode === 'live' && !isSpeaking) {
                        startVoice('live');
                    }
                }, 350);
            } else {
                setOrbState('idle');
            }
        };

        utterance.onerror = () => {
            isSpeaking = false;
            if (voiceMode === 'live') {
                setTimeout(() => { if (voiceMode === 'live') startVoice('live'); }, 350);
            } else {
                setOrbState('idle');
            }
        };

        synth.speak(utterance);
    }

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

    // Topics In-place Submit (No reload)
    document.querySelectorAll('.topic-item').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.preventDefault();
            closeDrawer();
            const prompt = chip.getAttribute('data-prompt');
            if (chatInput) chatInput.value = prompt;
            submitMessage(prompt);
        });
    });

    // Chat Form Submit (No reload)
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = chatInput ? chatInput.value.trim() : '';
            if (text) submitMessage(text);
        });
    }

    // Submit Message to Backend
    async function submitMessage(text) {
        if (chatInput) chatInput.value = '';
        appendMessage('user', text);
        setOrbState('thinking');

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const data = await res.json();

            if (res.ok && data.status === 'success') {
                appendMessage('assistant', data.response);
                if (voiceMode === 'live' || (autoSpeakCheck && autoSpeakCheck.checked)) {
                    speakRawText(data.response);
                } else {
                    setOrbState('idle');
                }
            } else {
                setOrbState('idle');
                let errText = data.message || 'Ошибка соединения';
                if (data.error === 'api_key_missing') {
                    errText = '⚠️ <strong>Groq API Key не настроен!</strong><br>Пожалуйста, откройте настройки и введите ваш бесплатный ключ от <a href="https://console.groq.com/keys" target="_blank">console.groq.com</a>.';
                }
                appendMessage('assistant', `⚠️ ${errText}`);
            }
        } catch (err) {
            setOrbState('idle');
            appendMessage('assistant', `❌ <strong>Ошибка сети:</strong> ${err.message}`);
        }
    }

    // SPA Chat Message Rendering
    function appendMessage(role, text) {
        if (!chatMessages) return;
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${role}`;
        if (role === 'user') {
            bubble.innerHTML = `<div class="bubble-user-content">${escapeHtml(text)}</div>`;
        } else {
            bubble.innerHTML = `
                <div class="bubble-assistant-content">${formatMarkdown(text)}</div>
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
        if (contentArea) contentArea.scrollTop = contentArea.scrollHeight;
    }

    // New Chat Action (Pure SPA in-place reset, no reload)
    if (newChatDrawerBtn) {
        newChatDrawerBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            closeDrawer();
            try {
                await fetch('/api/chat/clear', { method: 'POST' });
            } catch(err) {}
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="chat-bubble assistant">
                        <div class="bubble-assistant-content">
                            <p>Привет! Я <strong>Nova</strong> — твой персональный AI-тьютор английского языка. Я отлично понимаю как английский, так и русский язык. Ты можешь писать сообщения, надиктовывать их голосом или общаться со мной в живом режиме. О чем поговорим?</p>
                        </div>
                        <div class="msg-actions-row">
                            <button class="action-icon-btn speak-btn" title="Озвучить" onclick="speakTextFromEl(this)">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                            </button>
                            <button class="action-icon-btn" title="Скопировать" onclick="copyTextFromEl(this)">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            </button>
                        </div>
                        <div class="ai-disclaimer">Nova AI — виртуальный тьютор английского языка.</div>
                    </div>
                `;
            }
            setOrbState('idle');
            if (chatInput) chatInput.value = '';
            if (contentArea) contentArea.scrollTop = 0;
            if (statusText) statusText.textContent = 'Новый диалог начат';
            setTimeout(() => { if (!isListening && !isSpeaking) statusText.textContent = 'Готов к разговору'; }, 1500);
        });
    }

    // Clear History Action in Settings (Pure SPA in-place reset)
    if (clearHistoryRow) {
        clearHistoryRow.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('Очистить историю сообщений?')) {
                try {
                    await fetch('/api/chat/clear', { method: 'POST' });
                } catch(err) {}
                if (chatMessages) {
                    chatMessages.innerHTML = `
                        <div class="chat-bubble assistant">
                            <div class="bubble-assistant-content">
                                <p>История сообщений очищена. О чем ты хочешь поговорить?</p>
                            </div>
                        </div>
                    `;
                }
                closeSettings();
            }
        });
    }

    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function formatMarkdown(t) {
        return t
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\[Correction\]:(.*?)(?=\n|$)/g, '<div class="correction-block"><strong>Correction:</strong>$1</div>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
    }
});