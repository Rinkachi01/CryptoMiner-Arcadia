// modules/api.js - Funções para chamadas à API
const API_URL = '/api';

export async function apiCall(endpoint, data = null) {
    const username = localStorage.getItem('username');
    
    const options = {
        method: data ? 'POST' : 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Username': username || ''
        }
    };

    if (data) {
        options.body = JSON.stringify({ ...data, username });
    }

    try {
        console.log(`API Call: ${endpoint}`, data || '');
        const response = await fetch(`${API_URL}/${endpoint}`, options);
        const result = await response.json();
        console.log(`API Response: ${endpoint}`, result);
        return result;
    } catch (error) {
        console.error(`Erro na API ${endpoint}:`, error);
        return { 
            success: false, 
            message: 'Erro de conexão com o servidor' 
        };
    }
}

export async function fetchStatus() {
    const username = localStorage.getItem('username');
    if (!username) {
        console.log('Usuário não autenticado para fetchStatus');
        return { error: 'Não autenticado' };
    }
    
    const result = await apiCall(`status?username=${username}`);
    return result;
}

export async function fetchCatalog() {
    return await apiCall('catalog');
}

export async function fetchGameLevels() {
    const username = localStorage.getItem('username');
    if (!username) {
        console.log('Usuário não autenticado para fetchGameLevels');
        return {};
    }
    
    const result = await apiCall(`game-levels?username=${username}`);
    return result;
}

// Funções específicas
export async function buyItem(itemId, itemType) {
    return await apiCall('buy', { item_id: itemId, type: itemType });
}

export async function startGame(gameId) {
    return await apiCall('game/start', { game_id: gameId });
}

export async function claimGameReward(gameId, score, won) {
    return await apiCall('game/claim', { 
        game_id: gameId, 
        score: score, 
        won: won 
    });
}

export async function rechargeEnergy(type) {
    return await apiCall('recharge', { type: type });
}

export async function mine() {
    return await apiCall('mine', {});
}