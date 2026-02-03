// ===========================================
// NOTIFICATIONS MODULE - Sistema de notificações toast
// ===========================================

class NotificationSystem {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.init();
    }

    init() {
        // Criar container para notificações
        this.container = document.createElement('div');
        this.container.className = 'notifications-container';
        document.body.appendChild(this.container);
        
        // Adicionar estilos
        this.addStyles();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .notifications-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 350px;
            }

            .notification {
                background: var(--bg-card);
                border-left: 4px solid;
                border-radius: var(--border-radius);
                padding: var(--space-md);
                display: flex;
                align-items: flex-start;
                gap: var(--space-md);
                box-shadow: var(--shadow-medium);
                transform: translateX(100%);
                opacity: 0;
                transition: all 0.3s ease;
                animation: slideInRight 0.3s ease forwards;
            }

            .notification.show {
                transform: translateX(0);
                opacity: 1;
            }

            .notification.hide {
                transform: translateX(100%);
                opacity: 0;
            }

            .notification-success {
                border-left-color: var(--success);
            }

            .notification-error {
                border-left-color: var(--error);
            }

            .notification-warning {
                border-left-color: var(--warning);
            }

            .notification-info {
                border-left-color: var(--info);
            }

            .notification-icon {
                font-size: 20px;
                flex-shrink: 0;
            }

            .notification-content {
                flex: 1;
                min-width: 0;
            }

            .notification-title {
                font-weight: bold;
                margin-bottom: 4px;
                color: var(--text-main);
                font-size: var(--font-size-md);
            }

            .notification-message {
                font-size: var(--font-size-sm);
                color: var(--text-dim);
                line-height: 1.4;
            }

            .notification-close {
                background: none;
                border: none;
                color: var(--text-dim);
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
                flex-shrink: 0;
                transition: color 0.3s ease;
            }

            .notification-close:hover {
                color: var(--text-main);
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    show(options) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${options.type || 'info'}`;
        
        const icon = this.getIcon(options.type);
        const title = options.title || '';
        const message = options.message || '';
        const duration = options.duration || 5000;

        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">&times;</button>
        `;

        this.container.appendChild(notification);
        this.notifications.push(notification);

        // Adicionar evento para fechar
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.close(notification));

        // Auto-remover após a duração
        if (duration > 0) {
            setTimeout(() => this.close(notification), duration);
        }

        // Animar entrada
        setTimeout(() => notification.classList.add('show'), 10);
        
        return notification;
    }

    getIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return '📢';
        }
    }

    close(notification) {
        if (!notification || !notification.parentNode) return;
        
        notification.classList.remove('show');
        notification.classList.add('hide');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            this.notifications = this.notifications.filter(n => n !== notification);
        }, 300);
    }

    success(title, message, duration = 5000) {
        return this.show({ type: 'success', title, message, duration });
    }

    error(title, message, duration = 5000) {
        return this.show({ type: 'error', title, message, duration });
    }

    warning(title, message, duration = 5000) {
        return this.show({ type: 'warning', title, message, duration });
    }

    info(title, message, duration = 5000) {
        return this.show({ type: 'info', title, message, duration });
    }

    clearAll() {
        this.notifications.forEach(notification => this.close(notification));
        this.notifications = [];
    }
}

// Criar instância global
const Notifications = new NotificationSystem();

// Exportar para uso global
export { Notifications };
window.Notifications = Notifications;

console.log('✅ notifications.js carregado');