// modules/auth.js - Sistema de autenticação
const API_URL = '/api';

export async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        showMessage('Preencha todos os campos', 'error', 'login-msg');
        return;
    }

    try {
        showMessage('Entrando...', 'loading', 'login-msg');

        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem('username', username);
            showMessage('Login bem-sucedido!', 'success', 'login-msg');
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            showMessage(data.message || 'Erro no login', 'error', 'login-msg');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showMessage('Erro de conexão com o servidor', 'error', 'login-msg');
    }
}

export async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;

    if (!username || !password) {
        showMessage('Preencha todos os campos', 'error', 'register-msg');
        return;
    }

    if (password.length < 4) {
        showMessage('Senha muito curta (mínimo 4 caracteres)', 'error', 'register-msg');
        return;
    }

    if (username.length < 3) {
        showMessage('Nome de usuário muito curto (mínimo 3 caracteres)', 'error', 'register-msg');
        return;
    }

    try {
        showMessage('Criando conta...', 'loading', 'register-msg');

        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            showMessage('Conta criada com sucesso! Faça login.', 'success', 'register-msg');
            // Limpar campos
            document.getElementById('register-username').value = '';
            document.getElementById('register-password').value = '';
            // Mostrar aba de login
            showLoginTab();
        } else {
            showMessage(data.message || 'Erro ao criar conta', 'error', 'register-msg');
        }
    } catch (error) {
        console.error('Erro no registro:', error);
        showMessage('Erro de conexão com o servidor', 'error', 'register-msg');
    }
}

export function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.clear();
        location.reload();
    }
}

function showMessage(text, type, elementId) {
    const msgElement = document.getElementById(elementId);
    if (!msgElement) return;

    msgElement.textContent = text;
    msgElement.style.color =
        type === 'error' ? '#ff4444' :
        type === 'success' ? '#00ff00' :
        type === 'loading' ? '#00ffff' : '#ffffff';

    // Auto-remover após 3 segundos se for sucesso
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            msgElement.textContent = '';
        }, 3000);
    }
}

// Exportar para uso global
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logout = logout;