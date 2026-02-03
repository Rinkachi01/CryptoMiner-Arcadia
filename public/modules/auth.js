// ===========================================
// AUTHENTICATION MODULE - CORRIGIDO
// ===========================================

const API_URL = '/api';

/**
 * Lida com o processo de login
 */
export async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    console.log('🔐 Tentando login para:', username);
    
    // Validação básica
    if (!username || !password) {
        showAuthMessage('❌ Preencha todos os campos', 'error', 'login-msg');
        return;
    }
    
    try {
        showAuthMessage('⏳ Autenticando...', 'loading', 'login-msg');
        
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showAuthMessage('✅ Login bem-sucedido!', 'success', 'login-msg');
            
            // Salvar credenciais
            localStorage.setItem('username', username);
            localStorage.setItem('loggedIn', 'true');
            localStorage.setItem('userData', JSON.stringify(data.user));
            if (data.token) {
                localStorage.setItem('token', data.token);
            }
            
            // Atualizar UI
            document.getElementById('user-display').textContent = username;
            
            // Esconder modal e iniciar sistema
            setTimeout(() => {
                document.getElementById('login-modal').classList.add('hidden');
                document.getElementById('game-interface').classList.remove('hidden');
                
                // Mostrar tela de loading
                const loadingScreen = document.getElementById('loading-screen');
                if (loadingScreen) {
                    loadingScreen.classList.remove('hidden');
                }
                
                if (window.initSystem) {
                    window.initSystem();
                }
            }, 1000);
            
        } else {
            showAuthMessage(`❌ ${data.message || 'Falha no login'}`, 'error', 'login-msg');
        }
        
    } catch (error) {
        console.error('Erro no login:', error);
        showAuthMessage('❌ Erro de conexão com o servidor', 'error', 'login-msg');
    }
}

/**
 * Lida com o processo de registro - CORRIGIDO
 */
export async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    
    console.log('📝 Tentando registro para:', username);
    
    // Validações
    if (!username || !password) {
        showAuthMessage('❌ Preencha todos os campos', 'error', 'register-msg');
        return;
    }
    
    if (username.length < 3) {
        showAuthMessage('❌ Nome de usuário muito curto (mínimo 3 caracteres)', 'error', 'register-msg');
        return;
    }
    
    if (password.length < 8) {
        showAuthMessage('❌ Senha deve ter no mínimo 8 caracteres', 'error', 'register-msg');
        return;
    }
    
    // Verificar termos
    const termsCheckbox = document.getElementById('terms-checkbox');
    if (!termsCheckbox?.checked) {
        showAuthMessage('❌ Aceite os termos de serviço', 'error', 'register-msg');
        return;
    }
    
    try {
        showAuthMessage('⏳ Criando sua conta...', 'loading', 'register-msg');
        
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        // Verificar se a resposta é OK (status 2xx)
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showAuthMessage('✅ Conta criada com sucesso!', 'success', 'register-msg');
            
            // Limpar campos
            document.getElementById('register-username').value = '';
            document.getElementById('register-password').value = '';
            document.getElementById('terms-checkbox').checked = false;
            document.getElementById('btn-register').disabled = true;
            
            // Mostrar detalhes do bônus
            if (data.bonus) {
                showAuthMessage(
                    `🎁 Bônus recebido: ${data.bonus.coins} CMA + ${data.bonus.batteries} baterias!`,
                    'success',
                    'register-msg'
                );
            }
            
            // IMPORTANTE: Não fazer login automático
            // Apenas mostrar mensagem e trocar para aba de login
            setTimeout(() => {
                showLoginTab();
                showAuthMessage('✅ Agora faça login para começar!', 'success', 'login-msg');
                
                // Pré-preencher o nome de usuário
                document.getElementById('login-username').value = username;
                document.getElementById('login-password').focus();
            }, 2000);
            
        } else {
            showAuthMessage(`❌ ${data.message || 'Erro ao criar conta'}`, 'error', 'register-msg');
        }
        
    } catch (error) {
        console.error('Erro no registro:', error);
        showAuthMessage('❌ Erro de conexão com o servidor. Verifique se o servidor está rodando.', 'error', 'register-msg');
    }
}

/**
 * Realiza logout do usuário
 */
export function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        // Limpar localStorage
        localStorage.clear();
        
        // Parar loops de atualização
        if (window.APP_STATE?.updateInterval) {
            clearInterval(window.APP_STATE.updateInterval);
        }
        if (window.APP_STATE?.miningInterval) {
            clearInterval(window.APP_STATE.miningInterval);
        }
        
        // Recarregar página
        location.reload();
    }
}

/**
 * Mostra mensagens de autenticação
 */
function showAuthMessage(text, type, elementId) {
    const msgElement = document.getElementById(elementId);
    if (!msgElement) return;
    
    msgElement.textContent = text;
    msgElement.style.color = 
        type === 'error' ? 'var(--error)' :
        type === 'success' ? 'var(--success)' :
        type === 'loading' ? 'var(--cyan)' : 'var(--text-main)';
    
    // Limpar mensagem após alguns segundos (exceto loading)
    if (type !== 'loading') {
        setTimeout(() => {
            msgElement.textContent = '';
        }, 5000);
    }
}

/**
 * Mostra aba de login
 */
export function showLoginTab() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    
    // Limpar mensagens
    document.getElementById('login-msg').textContent = '';
    document.getElementById('register-msg').textContent = '';
    
    // Focar no primeiro campo
    setTimeout(() => {
        document.getElementById('login-username').focus();
    }, 100);
}

/**
 * Mostra aba de registro
 */
export function showRegisterTab() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.add('active');
    
    // Limpar mensagens
    document.getElementById('login-msg').textContent = '';
    document.getElementById('register-msg').textContent = '';
    
    // Focar no primeiro campo
    setTimeout(() => {
        document.getElementById('register-username').focus();
    }, 100);
}

/**
 * Mostra modal de recuperação de senha
 */
export function showForgotPassword() {
    const modal = document.getElementById('forgot-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Envia link de recuperação
 */
export function sendResetLink() {
    const email = document.getElementById('forgot-email').value;
    
    if (!email) {
        const msgElement = document.getElementById('forgot-msg');
        if (msgElement) {
            msgElement.textContent = '❌ Digite seu e-mail';
            msgElement.style.color = 'var(--error)';
        }
        return;
    }
    
    // Simulação - em produção faria chamada à API
    const msgElement = document.getElementById('forgot-msg');
    if (msgElement) {
        msgElement.textContent = '✅ Link enviado para ' + email;
        msgElement.style.color = 'var(--success)';
        
        setTimeout(() => {
            document.getElementById('forgot-modal').classList.add('hidden');
            msgElement.textContent = '';
            document.getElementById('forgot-email').value = '';
        }, 3000);
    }
}

/**
 * Mostra termos de serviço
 */
export function showTerms() {
    const modal = document.getElementById('terms-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Mostra política de privacidade
 */
export function showPrivacy() {
    alert('Política de Privacidade será mostrada aqui.');
}

// Exportar funções para uso global
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logout = logout;
window.showLoginTab = showLoginTab;
window.showRegisterTab = showRegisterTab;
window.showForgotPassword = showForgotPassword;
window.sendResetLink = sendResetLink;

console.log('✅ auth.js carregado');