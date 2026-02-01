// modules/auth.js - Sistema completo de autenticação
const API_URL = '/api';

let currentTab = 'login';

export function initAuth() {
    // Configurar abas
    document.getElementById('tab-login').addEventListener('click', () => showTab('login'));
    document.getElementById('tab-register').addEventListener('click', () => showTab('register'));
    
    // Configurar formulários
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('btn-register').addEventListener('click', handleRegister);
    
    // Suporte a Enter
    ['login-username', 'login-password', 'register-username', 'register-password']
        .forEach(id => {
            document.getElementById(id)?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (currentTab === 'login') handleLogin();
                    else handleRegister();
                }
            });
        });
    
    // Verificar se já está autenticado
    checkExistingAuth();
}

function showTab(tab) {
    currentTab = tab;
    
    // Atualizar abas
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    
    // Mostrar formulário correto
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    
    // Limpar mensagens
    clearMessages();
}

async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!validateInput(username, password, 'login-msg')) return;
    
    try {
        showMessage('Autenticando...', 'loading', 'login-msg');
        
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('username', username);
            localStorage.setItem('auth-token', Date.now().toString()); // Token simples
            showMessage('✅ Login bem-sucedido!', 'success', 'login-msg');
            
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            showMessage(`❌ ${data.message || 'Credenciais inválidas'}`, 'error', 'login-msg');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showMessage('❌ Erro de conexão com o servidor', 'error', 'login-msg');
    }
}

async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    
    if (!validateInput(username, password, 'register-msg', true)) return;
    
    try {
        showMessage('Criando conta...', 'loading', 'register-msg');
        
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('✅ Conta criada com sucesso! Faça login.', 'success', 'register-msg');
            
            // Limpar e voltar para login
            document.getElementById('register-username').value = '';
            document.getElementById('register-password').value = '';
            
            setTimeout(() => showTab('login'), 1500);
        } else {
            showMessage(`❌ ${data.message || 'Erro ao criar conta'}`, 'error', 'register-msg');
        }
    } catch (error) {
        console.error('Erro no registro:', error);
        showMessage('❌ Erro de conexão com o servidor', 'error', 'register-msg');
    }
}

function validateInput(username, password, msgId, isRegister = false) {
    clearMessages();
    
    if (!username || !password) {
        showMessage('❌ Preencha todos os campos', 'error', msgId);
        return false;
    }
    
    if (isRegister) {
        if (username.length < 3) {
            showMessage('❌ Nome deve ter pelo menos 3 caracteres', 'error', msgId);
            return false;
        }
        
        if (password.length < 4) {
            showMessage('❌ Senha deve ter pelo menos 4 caracteres', 'error', msgId);
            return false;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            showMessage('❌ Use apenas letras, números e underscore', 'error', msgId);
            return false;
        }
    }
    
    return true;
}

function checkExistingAuth() {
    const username = localStorage.getItem('username');
    const authToken = localStorage.getItem('auth-token');
    
    if (username && authToken) {
        // Verificar se o token é recente (últimas 24h)
        const tokenTime = parseInt(authToken);
        if (Date.now() - tokenTime < 24 * 60 * 60 * 1000) {
            document.getElementById('login-modal').classList.add('hidden');
            return true;
        } else {
            // Token expirado
            localStorage.clear();
        }
    }
    
    return false;
}

export function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.clear();
        location.reload();
    }
}

// Funções auxiliares
function showMessage(text, type, elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = text;
    element.className = `auth-message ${type}`;
}

function clearMessages() {
    ['login-msg', 'register-msg'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '';
            element.className = 'auth-message';
        }
    });
}