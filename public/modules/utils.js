// ===========================================
// UTILS MODULE - Funções utilitárias
// ===========================================

/**
 * Formata um número como moeda
 */
export function formatCurrency(amount, currency = 'CMA') {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount) + ' ' + currency;
}

/**
 * Formata um número grande (como poder de mineração)
 */
export function formatNumber(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

/**
 * Formata tempo restante
 */
export function formatTimeRemaining(ms) {
    if (ms <= 0) return '00:00:00';
    
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Anima um valor numericamente
 */
export function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        
        if (element) {
            element.textContent = formatNumber(value);
        }
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    
    window.requestAnimationFrame(step);
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Gera um ID único
 */
export function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Valida um nome de usuário
 */
export function validateUsername(username) {
    if (!username) return 'Nome de usuário é obrigatório';
    if (username.length < 3) return 'Nome de usuário muito curto (mínimo 3 caracteres)';
    if (username.length > 20) return 'Nome de usuário muito longo (máximo 20 caracteres)';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Use apenas letras, números e underscore (_)';
    return null;
}

/**
 * Valida uma senha
 */
export function validatePassword(password) {
    if (!password) return 'Senha é obrigatória';
    if (password.length < 8) return 'Senha muito curta (mínimo 8 caracteres)';
    
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    
    const requirements = [];
    if (!hasUpper) requirements.push('uma letra maiúscula');
    if (!hasLower) requirements.push('uma letra minúscula');
    if (!hasNumber) requirements.push('um número');
    if (!hasSpecial) requirements.push('um caractere especial');
    
    if (requirements.length > 0) {
        return `Senha precisa ter ${requirements.join(', ')}`;
    }
    
    return null;
}

/**
 * Salva dados no localStorage com expiração
 */
export function setWithExpiry(key, value, ttl) {
    const item = {
        value: value,
        expiry: Date.now() + ttl
    };
    localStorage.setItem(key, JSON.stringify(item));
}

/**
 * Recupera dados do localStorage com expiração
 */
export function getWithExpiry(key) {
    const itemStr = localStorage.getItem(key);
    
    if (!itemStr) return null;
    
    const item = JSON.parse(itemStr);
    
    if (Date.now() > item.expiry) {
        localStorage.removeItem(key);
        return null;
    }
    
    return item.value;
}

/**
 * Copia texto para a área de transferência
 */
export function copyToClipboard(text) {
    return navigator.clipboard.writeText(text)
        .then(() => true)
        .catch(err => {
            console.error('Erro ao copiar:', err);
            return false;
        });
}

/**
 * Converte timestamp para data legível
 */
export function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Exportar para uso global
window.utils = {
    formatCurrency,
    formatNumber,
    formatTimeRemaining,
    animateValue,
    debounce,
    throttle,
    generateId,
    validateUsername,
    validatePassword,
    setWithExpiry,
    getWithExpiry,
    copyToClipboard,
    formatDate
};

console.log('✅ utils.js carregado');