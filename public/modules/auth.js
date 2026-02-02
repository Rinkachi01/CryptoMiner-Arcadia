// modules/auth.js - Sistema de autenticação corrigido
const API_URL = '/api';

export async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    console.log('Tentando login:', username);
    
    if (!username || !password) {
        showAuthMessage('Preencha todos os campos', 'error', 'login-msg');
        return;
    }
    
    try {
        showAuthMessage('🔐 Autenticando...', 'loading', 'login-msg');
        
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAuthMessage('✅ Login bem-sucedido!', 'success', 'login-msg');
            
            // Salvar dados de autenticação
            localStorage.setItem('username', username);
            localStorage.setItem('loggedIn', 'true');
            localStorage.setItem('auth-token', Date.now().toString());
            
            // Atualizar display do usuário
            document.getElementById('user-display').textContent = username;
            
            // Esconder modal e iniciar sistema
            setTimeout(() => {
                document.getElementById('login-modal').classList.add('hidden');
                if (window.initSystem) {
                    window.initSystem();
                }
            }, 1000);
            
        } else {
            showAuthMessage(`❌ ${data.message || 'Credenciais inválidas'}`, 'error', 'login-msg');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showAuthMessage('❌ Erro de conexão com o servidor', 'error', 'login-msg');
    }
}

export async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;

    console.log('Tentando registro:', username);

    if (!username || !password) {
        showAuthMessage('Preencha todos os campos', 'error', 'register-msg');
        return;
    }

    if (username.length < 3) {
        showAuthMessage('Nome de usuário muito curto (mínimo 3 caracteres)', 'error', 'register-msg');
        return;
    }

    if (password.length < 8) {
        showAuthMessage('Senha deve ter no mínimo 8 caracteres', 'error', 'register-msg');
        return;
    }

    try {
        showAuthMessage('📝 Criando sua conta...', 'loading', 'register-msg');

        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            showAuthMessage('✅ Conta criada com sucesso!', 'success', 'register-msg');
            
            // Limpar campos
            document.getElementById('register-username').value = '';
            document.getElementById('register-password').value = '';
            
            // Mostrar mensagem de bônus
            setTimeout(() => {
                showAuthMessage('🎁 Bônus concedido! Faça login para começar.', 'success', 'register-msg');
                showLoginTab();
            }, 1500);
            
        } else {
            showAuthMessage(`❌ ${data.message || 'Erro ao criar conta'}`, 'error', 'register-msg');
        }
    } catch (error) {
        console.error('Erro no registro:', error);
        showAuthMessage('❌ Erro de conexão com o servidor', 'error', 'register-msg');
    }
}

export function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.clear();
        location.reload();
    }
}

function showAuthMessage(text, type, elementId) {
    const msgElement = document.getElementById(elementId);
    if (!msgElement) return;

    msgElement.textContent = text;
    msgElement.style.color =
        type === 'error' ? '#ff4444' :
        type === 'success' ? '#00ff00' :
        type === 'loading' ? '#00ffff' : '#ffffff';

    // Auto-remover após alguns segundos
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            msgElement.textContent = '';
        }, 5000);
    }
}

// Funções de tab (para uso global)
export function showLoginTab() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('login-msg').textContent = '';
    document.getElementById('register-msg').textContent = '';
}

export function showRegisterTab() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('login-msg').textContent = '';
    document.getElementById('register-msg').textContent = '';
}