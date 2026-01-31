// modules/auth.js - Sistema de autenticação
const API_URL = '/api';

export async function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showMessage('Preencha todos os campos', 'error');
        return;
    }
    
    try {
        showMessage('Entrando...', 'loading');
        
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('username', username);
            showMessage('Login bem-sucedido!', 'success');
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            showMessage(data.message || 'Erro no login', 'error');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showMessage('Erro de conexão com o servidor', 'error');
    }
}

export async function handleRegister() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showMessage('Preencha todos os campos', 'error');
        return;
    }
    
    if (password.length < 4) {
        showMessage('Senha muito curta (mínimo 4 caracteres)', 'error');
        return;
    }
    
    try {
        showMessage('Criando conta...', 'loading');
        
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Conta criada com sucesso! Faça login.', 'success');
            // Limpar campos
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
        } else {
            showMessage(data.message || 'Erro ao criar conta', 'error');
        }
    } catch (error) {
        console.error('Erro no registro:', error);
        showMessage('Erro de conexão com o servidor', 'error');
    }
}

export function logout() {
    localStorage.clear();
    location.reload();
}

function showMessage(text, type) {
    const msgElement = document.getElementById('login-msg');
    if (!msgElement) return;
    
    msgElement.textContent = text;
    msgElement.style.color = 
        type === 'error' ? '#ff4444' : 
        type === 'success' ? '#00ff00' : 
        type === 'loading' ? '#00ffff' : '#ffffff';
    
    // Auto-remover após 3 segundos se for sucesso
    if (type === 'success') {
        setTimeout(() => {
            msgElement.textContent = '';
        }, 3000);
    }
}