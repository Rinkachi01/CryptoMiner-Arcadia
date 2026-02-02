// ===========================================
// API MODULE - Comunicação com o servidor
// ===========================================

const API_URL = '/api';

/**
 * Função genérica para chamadas à API
 */
export async function apiCall(endpoint, data = null) {
    const username = localStorage.getItem('username');
    const token = localStorage.getItem('token');
    
    const options = {
        method: data ? 'POST' : 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Username': username || '',
            'Authorization': token ? `Bearer ${token}` : ''
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        console.log(`📡 API Call: ${endpoint}`, data || '');
        const response = await fetch(`${API_URL}/${endpoint}`, options);
        const result = await response.json();
        console.log(`📡 API Response: ${endpoint}`, result);
        return result;
    } catch (error) {
        console.error(`❌ API Error (${endpoint}):`, error);
        return { 
            success: false, 
            message: 'Erro de conexão com o servidor' 
        };
    }
}

/**
 * Obtém status do usuário
 */
export async function fetchStatus() {
    const username = localStorage.getItem('username');
    if (!username) return { error: 'Não autenticado' };
    
    return await apiCall(`status?username=${username}`);
}

/**
 * Obtém catálogo de itens
 */
export async function fetchCatalog() {
    return await apiCall('catalog');
}

/**
 * Obtém níveis de jogo do usuário
 */
export async function fetchGameLevels() {
    const username = localStorage.getItem('username');
    if (!username) return {};
    
    return await apiCall(`game-levels?username=${username}`);
}

/**
 * Realiza uma compra
 */
export async function buyItem(itemId, itemType) {
    return await apiCall('buy', { item_id: itemId, type: itemType });
}

/**
 * Inicia um jogo
 */
export async function startGame(gameId) {
    return await apiCall('game/start', { game_id: gameId });
}

/**
 * Reivindica recompensa de jogo
 */
export async function claimGameReward(gameId, score, won) {
    return await apiCall('game/claim', { 
        game_id: gameId, 
        score: score, 
        won: won 
    });
}

/**
 * Recarrega energia
 */
export async function rechargeEnergy(type) {
    return await apiCall('recharge', { type: type });
}

/**
 * Realiza mineração
 */
export async function mine() {
    return await apiCall('mine', {});
}

/**
 * Coloca um rack na sala
 */
export async function placeRack(rackId, roomIdx, position) {
    return await apiCall('rack/place', { rack_id: rackId, room_idx: roomIdx, position });
}

/**
 * Equipa um minerador
 */
export async function equipMiner(minerId, rackId, position) {
    return await apiCall('miner/equip', { miner_id: minerId, rack_id: rackId, position });
}

/**
 * Obtém o leaderboard
 */
export async function getLeaderboard() {
    return await apiCall('leaderboard');
}

/**
 * Obtém estatísticas globais
 */
export async function getGlobalStats() {
    return await apiCall('stats');
}

// Exportar para uso global
window.apiCall = apiCall;
window.fetchStatus = fetchStatus;
window.fetchCatalog = fetchCatalog;

console.log('✅ api.js carregado');