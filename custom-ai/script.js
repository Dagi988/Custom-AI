const state = {
    messages: [],
    chats: [],
    currentChatId: null,
    isGenerating: false,
    apiKey: localStorage.getItem("customAI_openRouterKey") || "",
    model:
        localStorage.getItem("customAI_model") === "openai/gpt-oss-120b:free"
            ? "openrouter/free"
            : localStorage.getItem("customAI_model") || "openrouter/free",
    systemPrompt:
        localStorage.getItem("customAI_systemPrompt") ||
        "You are Custom AI, a helpful, friendly, intelligent AI assistant."
};

const elements = {
    messages: document.getElementById("messages"),
    welcome: document.getElementById("welcome"),
    messageInput: document.getElementById("messageInput"),
    sendBtn: document.getElementById("sendBtn"),
    newChatBtn: document.getElementById("newChatBtn"),
    clearHistoryBtn: document.getElementById("clearHistoryBtn"),
    clearChatBtn: document.getElementById("clearChatBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    topSettingsBtn: document.getElementById("topSettingsBtn"),
    settingsModal: document.getElementById("settingsModal"),
    apiKeyInput: document.getElementById("apiKey"),
    toggleKey: document.getElementById("toggleKey"),
    modelSelect: document.getElementById("modelSelect"),
    systemPromptInput: document.getElementById("systemPrompt"),
    saveSettingsBtn: document.getElementById("saveSettingsBtn"),
    cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
    closeSettingsBtn: document.getElementById("closeSettingsBtn"),
    chatHistory: document.getElementById("chatHistory"),
    mobileMenuBtn: document.getElementById("mobileMenuBtn"),
    mobileCloseBtn: document.getElementById("mobileCloseBtn"),
    sidebar: document.getElementById("sidebar"),
    suggestions: document.querySelectorAll(".suggestion")
};

document.addEventListener("DOMContentLoaded", init);

function init() {
    loadChats();
    loadSettings();

    elements.sendBtn?.addEventListener("click", sendMessage);

    elements.messageInput?.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    elements.messageInput?.addEventListener("input", autoResize);

    elements.newChatBtn?.addEventListener("click", startNewChat);
    elements.clearChatBtn?.addEventListener("click", clearCurrentChat);
    elements.clearHistoryBtn?.addEventListener("click", clearHistory);

    elements.settingsBtn?.addEventListener("click", openSettings);
    elements.topSettingsBtn?.addEventListener("click", openSettings);

    elements.saveSettingsBtn?.addEventListener("click", saveSettings);
    elements.cancelSettingsBtn?.addEventListener("click", closeSettings);
    elements.closeSettingsBtn?.addEventListener("click", closeSettings);

    elements.toggleKey?.addEventListener("click", toggleApiKeyVisibility);

    elements.mobileMenuBtn?.addEventListener("click", toggleSidebar);
    elements.mobileCloseBtn?.addEventListener("click", closeSidebar);

    elements.suggestions?.forEach(function (button) {
        button.addEventListener("click", function () {
            const text =
                button.dataset.prompt ||
                button.textContent.trim();

            elements.messageInput.value = text;
            autoResize();
            sendMessage();
        });
    });

    elements.settingsModal?.addEventListener("click", function (event) {
        if (event.target === elements.settingsModal) {
            closeSettings();
        }
    });

    renderHistory();
}

function loadSettings() {
    if (elements.apiKeyInput) {
        elements.apiKeyInput.value = state.apiKey;
    }

    if (elements.modelSelect) {
        const optionExists = Array.from(elements.modelSelect.options).some(
            function (option) {
                return option.value === state.model;
            }
        );

        if (optionExists) {
            elements.modelSelect.value = state.model;
        } else {
            elements.modelSelect.value = "openrouter/free";
        }
    }

    if (elements.systemPromptInput) {
        elements.systemPromptInput.value = state.systemPrompt;
    }
}

function saveSettings() {
    state.apiKey = elements.apiKeyInput.value.trim();
    state.model = elements.modelSelect.value || "openrouter/free";
    state.systemPrompt =
        elements.systemPromptInput.value.trim() ||
        "You are Custom AI, a helpful, friendly, intelligent AI assistant.";

    localStorage.setItem("customAI_openRouterKey", state.apiKey);
    localStorage.setItem("customAI_model", state.model);
    localStorage.setItem("customAI_systemPrompt", state.systemPrompt);

    closeSettings();
    showTemporaryMessage("Settings saved.");
}

function openSettings() {
    loadSettings();

    if (elements.settingsModal) {
        elements.settingsModal.classList.add("active");
    }
}

function closeSettings() {
    if (elements.settingsModal) {
        elements.settingsModal.classList.remove("active");
    }
}

function toggleApiKeyVisibility() {
    if (!elements.apiKeyInput) return;

    if (elements.apiKeyInput.type === "password") {
        elements.apiKeyInput.type = "text";
        if (elements.toggleKey) {
            elements.toggleKey.textContent = "Hide";
        }
    } else {
        elements.apiKeyInput.type = "password";
        if (elements.toggleKey) {
            elements.toggleKey.textContent = "Show";
        }
    }
}

async function sendMessage() {
    if (state.isGenerating) return;

    const text = elements.messageInput.value.trim();
    if (!text) return;

    if (!state.apiKey) {
        openSettings();
        showTemporaryMessage("Add your OpenRouter API key in Settings first.");
        return;
    }

    addMessage("user", text);

    elements.messageInput.value = "";
    autoResize();

    if (elements.welcome) {
        elements.welcome.style.display = "none";
    }

    state.isGenerating = true;
    elements.sendBtn.disabled = true;

    showTyping();

    try {
        const reply = await callOpenRouter();
        removeTyping();
        addMessage("assistant", reply);
        saveCurrentChat();
    } catch (error) {
        removeTyping();
        console.error("Custom AI error:", error);
        addMessage("assistant", getReadableError(error));
    } finally {
        state.isGenerating = false;
        elements.sendBtn.disabled = false;
        elements.messageInput.focus();
    }
}

async function callOpenRouter() {
    const apiMessages = [
        {
            role: "system",
            content: state.systemPrompt
        },
        ...state.messages.map(function (message) {
            return {
                role: message.role,
                content: message.content
            };
        })
    ];

    const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + state.apiKey,
                "HTTP-Referer": window.location.origin,
                "X-Title": "Custom AI"
            },
            body: JSON.stringify({
                model: state.model,
                messages: apiMessages,
                temperature: 0.7
            })
        }
    );

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error("OpenRouter returned an invalid response.");
    }

    if (!response.ok) {
        const apiError =
            data && data.error && data.error.message
                ? data.error.message
                : "OpenRouter request failed.";

        const error = new Error(apiError);

        if (data && data.error) {
            error.code = data.error.code;
            error.type = data.error.type;
        }

        throw error;
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("OpenRouter returned no assistant response.");
    }

    return data.choices[0].message.content;
}

function addMessage(role, content) {
    state.messages.push({
        role: role,
        content: content
    });

    renderMessage(role, content);
}

function renderMessage(role, content) {
    const message = document.createElement("div");

    message.className =
        "message " + (role === "user" ? "user-message" : "assistant-message");

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "You" : "AI";

    const body = document.createElement("div");
    body.className = "message-content";

    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = content;

    body.appendChild(text);
    message.appendChild(avatar);
    message.appendChild(body);

    elements.messages.appendChild(message);
    scrollToBottom();
}

function showTyping() {
    removeTyping();

    const typing = document.createElement("div");
    typing.className = "message assistant-message typing-message";
    typing.id = "typingIndicator";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "AI";

    const body = document.createElement("div");
    body.className = "message-content";

    const typingIndicator = document.createElement("div");
    typingIndicator.className = "typing";

    const dot1 = document.createElement("span");
    const dot2 = document.createElement("span");
    const dot3 = document.createElement("span");

    typingIndicator.appendChild(dot1);
    typingIndicator.appendChild(dot2);
    typingIndicator.appendChild(dot3);

    body.appendChild(typingIndicator);
    typing.appendChild(avatar);
    typing.appendChild(body);

    elements.messages.appendChild(typing);
    scrollToBottom();
}

function removeTyping() {
    const typing = document.getElementById("typingIndicator");
    if (typing) {
        typing.remove();
    }
}

function scrollToBottom() {
    if (!elements.messages) return;
    elements.messages.scrollTop = elements.messages.scrollHeight;
}

function autoResize() {
    const input = elements.messageInput;
    if (!input) return;

    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 180) + "px";
}

function startNewChat() {
    if (state.messages.length > 0) {
        saveCurrentChat();
    }

    state.messages = [];
    state.currentChatId = null;
    elements.messages.innerHTML = "";

    if (elements.welcome) {
        elements.welcome.style.display = "";
    }

    elements.messageInput.value = "";
    autoResize();
    closeSidebar();
}

function clearCurrentChat() {
    state.messages = [];

    if (state.currentChatId) {
        state.chats = state.chats.filter(function (chat) {
            return chat.id !== state.currentChatId;
        });

        localStorage.setItem("customAI_chats", JSON.stringify(state.chats));
    }

    state.currentChatId = null;
    elements.messages.innerHTML = "";

    if (elements.welcome) {
        elements.welcome.style.display = "";
    }

    elements.messageInput.value = "";
    autoResize();
    renderHistory();
    showTemporaryMessage("Current chat cleared.");
}

function saveCurrentChat() {
    if (state.messages.length === 0) return;

    const firstUserMessage = state.messages.find(function (message) {
        return message.role === "user";
    });

    const title = firstUserMessage
        ? firstUserMessage.content.slice(0, 40)
        : "New Chat";

    const existingChat = state.chats.find(function (chat) {
        return chat.id === state.currentChatId;
    });

    if (existingChat) {
        existingChat.messages = [...state.messages];
        existingChat.title = title;
        existingChat.updatedAt = Date.now();
    } else {
        const chat = {
            id: Date.now().toString(),
            title: title,
            messages: [...state.messages],
            updatedAt: Date.now()
        };

        state.currentChatId = chat.id;
        state.chats.unshift(chat);
    }

    localStorage.setItem("customAI_chats", JSON.stringify(state.chats));
    renderHistory();
}

function loadChats() {
    try {
        const saved = localStorage.getItem("customAI_chats");
        state.chats = saved ? JSON.parse(saved) : [];
    } catch (error) {
        state.chats = [];
    }
}

function renderHistory() {
    if (!elements.chatHistory) return;

    elements.chatHistory.innerHTML = "";

    state.chats.forEach(function (chat) {
        const item = document.createElement("button");
        item.className = "history-item";
        item.textContent = chat.title || "New Chat";

        item.addEventListener("click", function () {
            loadChat(chat.id);
        });

        elements.chatHistory.appendChild(item);
    });
}

function loadChat(id) {
    const chat = state.chats.find(function (item) {
        return item.id === id;
    });

    if (!chat) return;

    state.currentChatId = id;
    state.messages = [...chat.messages];
    elements.messages.innerHTML = "";

    if (elements.welcome) {
        elements.welcome.style.display = "none";
    }

    state.messages.forEach(function (message) {
        renderMessage(message.role, message.content);
    });

    closeSidebar();
}

function clearHistory() {
    state.chats = [];
    state.messages = [];
    state.currentChatId = null;

    localStorage.removeItem("customAI_chats");
    elements.messages.innerHTML = "";

    if (elements.welcome) {
        elements.welcome.style.display = "";
    }

    renderHistory();
    showTemporaryMessage("Chat history cleared.");
}

function toggleSidebar() {
    if (!elements.sidebar) return;
    elements.sidebar.classList.toggle("open");
}

function closeSidebar() {
    if (!elements.sidebar) return;
    elements.sidebar.classList.remove("open");
}

function showTemporaryMessage(text) {
    const notification = document.createElement("div");
    notification.className = "temporary-notification";
    notification.textContent = text;

    document.body.appendChild(notification);

    setTimeout(function () {
        notification.classList.add("show");
    }, 10);

    setTimeout(function () {
        notification.classList.remove("show");

        setTimeout(function () {
            notification.remove();
        }, 300);
    }, 2500);
}

function getReadableError(error) {
    const message = error && error.message ? error.message : "";
    const lowerMessage = message.toLowerCase();
    const code = error && error.code ? String(error.code) : "";

    if (
        code === "401" ||
        lowerMessage.includes("invalid api key") ||
        lowerMessage.includes("unauthorized")
    ) {
        return "Your OpenRouter API key is invalid or unauthorized. Check it in Settings.";
    }

    if (code === "429" || lowerMessage.includes("rate limit")) {
        return "OpenRouter rate limit reached. Wait a little and try again.";
    }

    if (
        lowerMessage.includes("free model") &&
        lowerMessage.includes("limit")
    ) {
        return "The selected free OpenRouter model has reached its current usage limit. Try another available free model.";
    }

    if (
        lowerMessage.includes("credits") ||
        lowerMessage.includes("insufficient")
    ) {
        return "This OpenRouter request requires credits, or the selected model is not currently available for free use. Select an available free model.";
    }

    if (lowerMessage.includes("failed to fetch")) {
        return "Could not connect to OpenRouter. Check your internet connection and try again.";
    }

    return "OpenRouter error: " + message;
}