// modules/mining.js - Sistema de mineração
import { apiCall, fetchStatus } from './api.js';

export async function updateData() {
    const status = await fetchStatus();
    if (status.error) {
        console.error('Erro ao buscar status');
        return;
    }
    
    window.USER_DATA = status;
    
    // Atualizar UI
    if (window.updateUI) {
        window.updateUI(status);
    }
}

export async function mine() {
    const response = await apiCall('mine');
    if (response.success) {
        await updateData();
    }
}