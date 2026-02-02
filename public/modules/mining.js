// ===========================================
// MINING MODULE - Sistema de mineração
// ===========================================

import { apiCall, fetchStatus } from './api.js';

/**
 * Atualiza os dados do usuário
 */
export async function updateData() {
    try {
        const status = await fetchStatus();
        
        if (status.error) {
            console.error('Erro ao buscar status:', status.error);
            return;
        }
        
        // Atualizar variáveis globais
        window.USER_DATA = status;
        
        // Atualizar UI
        if (window.updateUI) {
            window.updateUI(status);
        }
        
    } catch (error) {
        console.error('Erro em updateData:', error);
    }
}

/**
 * Realiza uma mineração
 */
export async function mine() {
    try {
        const response = await apiCall('mine');
        
        if (response.success) {
            console.log('⛏️ Mineração realizada:', response.reward);
            
            // Atualizar dados locais
            if (window.USER_DATA) {
                window.USER_DATA.balance += response.reward;
                window.USER_DATA.total_mining = response.total_mining || 0;
                
                // Atualizar UI
                if (window.updateUI) {
                    window.updateUI(window.USER_DATA);
                }
            }
            
            return response;
        }
        
        return { success: false, message: response.message };
        
    } catch (error) {
        console.error('Erro na mineração:', error);
        return { success: false, message: 'Erro de conexão' };
    }
}

/**
 * Calcula recompensa estimada
 */
export function calculateEstimatedReward(power, networkPower) {
    if (!power || !networkPower) return 0;
    
    // Fórmula simplificada: reward = (user_power / network_power) * block_reward
    const blockReward = 6.25; // BTC block reward (simulado)
    const userShare = power / networkPower;
    
    return (userShare * blockReward * 1000).toFixed(6); // Convertido para CMA
}

/**
 * Formata poder de mineração
 */
export function formatPower(power) {
    if (power >= 1e15) return (power / 1e15).toFixed(2) + ' PH/s';
    if (power >= 1e12) return (power / 1e12).toFixed(2) + ' TH/s';
    if (power >= 1e9) return (power / 1e9).toFixed(2) + ' GH/s';
    if (power >= 1e6) return (power / 1e6).toFixed(2) + ' MH/s';
    if (power >= 1e3) return (power / 1e3).toFixed(2) + ' kH/s';
    return power.toFixed(2) + ' H/s';
}

/**
 * Atualiza timer de energia
 */
export function updateEnergyTimer(expiresAt) {
    if (!expiresAt) return '--:--:--';
    
    const now = Date.now();
    const timeLeft = expiresAt - now;
    
    if (timeLeft <= 0) return '00:00:00';
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Exportar para uso global
window.updateData = updateData;
window.mine = mine;
window.formatPower = formatPower;

console.log('✅ mining.js carregado');