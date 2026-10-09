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

    // Speech & Voice State
    let isSpeaking = false;
    let isListening = false;
    let isLiveModeActive = false;
    let synth = window.speechSynthesis;
    let selectedVoice = null;
    let recognition = null;

    // Initialize English Voices
    function initVoices() {
        if (!synth) return;
        const voices = synth.getVoices();
        selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Alex')))
                     || voices.find(v => v.lang.startsWith('en'))
                     || voices[0];
    }
    initVoices();
    if (synth && synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = initVoices;
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
            statusText.textContent = 'Слушаю вас (English)...';
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
        const utterance = new SpeechSynthesisUtterance(rawText);
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.lang = 'en-US';
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

    // Web Speech API: Speech-to-Text
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
        recognition = new SpeechRec();
        recognition.lang = 'en-US';
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
        if (synth) synth.cancel();
        try {
            recognition.start();
        } catch (e) {
            // Already active
        }
    }

    function stopListening() {
        isListening = false;
        if (voiceInputBtn) voiceInputBtn.classList.remove('active');
        if (!isLiveModeActive && liveVoiceModeBtn) liveVoiceModeBtn.classList.remove('active');
        if (!isSpeaking) setOrbState('idle');
    }

    function toggleListening() {
        if (isListening) {
            recognition.stop();
            stopListening();
        } else {
            startListening();
        }
    }

    if (voiceInputBtn) voiceInputBtn.addEventListener('click', toggleListening);
    if (characterOrb) characterOrb.addEventListener('click', toggleListening);

    // Live Voice Mode (Waveform Button)
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
            toggleListening();
        });
    }

    // Quick Practice Topic Chips
    document.querySelectorAll('.topic-chip, .topic-item').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.preventDefault();
            closeDrawer();
            const prompt = chip.getAttribute('data-prompt');
            chatInput.value = prompt;
            submitMessage(prompt);
        });
    });

    // Chat Form Submit
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text) submitMessage(text);
    });

    // Submit Message to Flask Backend -> Groq API
    async function submitMessage(text) {
        chatInput.value = '';
        appendMessage('user', text);
        setOrbState('thinking');

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({message: text})
            });
            const data = await res.json();

            if (res.ok) {
                appendMessage('assistant', data.response);
                const autoSpeakCheck = document.getElementById('auto_speak');
                if ((autoSpeakCheck && autoSpeakCheck.checked) || isLiveModeActive) {
                    const lastBubble = chatMessages.lastElementChild;
                    const speakBtn = lastBubble ? lastBubble.querySelector('.speak-btn') : null;
                    if (speakBtn) speakTextFromEl(speakBtn);
                } else {
                    setOrbState('idle');
                }
            } else {
                setOrbState('idle');
                if (data.error === 'api_key_missing') {
                    appendMessage('assistant', `⚠️ <strong>Groq API Key не настроен:</strong> ${data.message} <br><button onclick="document.getElementById('open-settings-btn').click()" style="margin-top:8px; background: #6366f1; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer;">Открыть настройки</button>`);
                } else {
                    appendMessage('assistant', `❌ <strong>Ошибка:</strong> ${data.message || 'Не удалось связаться с Groq'}`);
                }
            }
        } catch (err) {
            setOrbState('idle');
            appendMessage('assistant', `❌ <strong>Ошибка сети:</strong> Проверьте подключение к интернету.`);
        }
    }

    function appendMessage(role, text) {
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
        contentArea.scrollTop = contentArea.scrollHeight;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function formatMarkdown(text) {
        return text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\[Correction\]:(.*?)(?=\n|$)/g, '<div class="correction-block"><strong>Correction:</strong>$1</div>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
    }

    // Save Settings
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
                auto_speak: formData.get('auto_speak') ? 1 : 0
            };

            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    alert('Настройки успешно сохранены!');
                    closeSettings();
                } else {
                    alert('Ошибка сохранения настроек');
                }
            } catch (err) {
                alert('Сетевая ошибка');
            }
        });
    }

    // Clear History Action
    if (clearHistoryRow) {
        clearHistoryRow.addEventListener('click', async () => {
            if (confirm('Очистить историю диалогов?')) {
                await fetch('/api/chat/clear', {method: 'POST'});
                chatMessages.innerHTML = `
                    <div class="chat-bubble assistant">
                        <div class="bubble-assistant-content">
                            <p>История очищена. О чем ты хочешь поговорить сегодня?</p>
                        </div>
                    </div>
                `;
                closeSettings();
            }
        });
    }

    // New Chat Drawer Item
    const newChatDrawerBtn = document.getElementById('new-chat-drawer-btn');
    if (newChatDrawerBtn) {
        newChatDrawerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeDrawer();
            chatInput.focus();
        });
    }
});
