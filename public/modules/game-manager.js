// modules/game-manager.js - Gerenciador de jogos
import { apiCall } from './api.js';

let currentGame = null;
let gameInterval = null;

export function initGameManager() {
    renderGames();
}

export function renderGames() {
    const gamesList = document.getElementById('games-list');
    if (!gamesList || !window.GAMES_BASE) return;

    gamesList.innerHTML = '';

    Object.entries(window.GAMES_BASE).forEach(([id, game]) => {
        const gameElement = document.createElement('div');
        gameElement.className = 'game-card';
        gameElement.dataset.gameId = id;
        
        const level = window.USER_LEVELS_DATA?.[id]?.level || 1;
        const lastPlayed = window.USER_LEVELS_DATA?.[id]?.last_played || 0;
        const cooldown = 30 + (level * 15);
        const timePassed = Date.now() - lastPlayed;
        const canPlay = timePassed >= (cooldown * 1000);
        
        gameElement.innerHTML = `
            <div class="g-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <i class="fa-solid ${getGameIcon(id)}"></i>
            </div>
            <div class="game-title">${game.name}</div>
            <div class="diff-dots">
                ${Array.from({length: 5}, (_, i) => 
                    `<div class="dot ${i < level ? 'on' : ''}"></div>`
                ).join('')}
            </div>
            <div class="game-reward">Reward: ${calculateReward(id, level)} GH/s</div>
            <div class="game-time">Time: ${game.time}s</div>
            <div class="game-target">Target: ${calculateTarget(id, level)}</div>
            <button class="btn-neon-green" 
                    data-game-start="${id}"
                    ${!canPlay ? 'disabled' : ''}>
                ${canPlay ? 'PLAY' : `COOLDOWN: ${Math.ceil((cooldown * 1000 - timePassed) / 1000)}s`}
            </button>
        `;

        gamesList.appendChild(gameElement);
    });

    // Adicionar event listeners
    document.querySelectorAll('[data-game-start]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gameId = e.target.dataset.gameStart;
            startGame(gameId);
        });
    });
}

function getGameIcon(gameId) {
    switch(gameId) {
        case 'coin-clicker': return 'fa-coins';
        case 'flappy-rocket': return 'fa-rocket';
        case 'crypto-2048': return 'fa-th';
        default: return 'fa-gamepad';
    }
}

function calculateReward(gameId, level) {
    const game = window.GAMES_BASE[gameId];
    if (!game) return 0;
    return Math.floor(game.reward * Math.pow(game.diff_mult, level - 1));
}

function calculateTarget(gameId, level) {
    const game = window.GAMES_BASE[gameId];
    if (!game) return 0;
    
    // Ajustar a meta para ser mais alcançável
    let target = game.base_target + ((level - 1) * game.target_step);
    
    // Ajustes específicos por jogo
    switch(gameId) {
        case 'coin-clicker':
            // Reduzir a meta para níveis mais altos
            target = Math.min(target, 500);
            break;
        case 'flappy-rocket':
            // Aumentar a meta gradualmente
            target = Math.min(target, 20);
            break;
        case 'crypto-2048':
            // Meta mais suave
            target = Math.min(target, 2048);
            break;
    }
    
    return target;
}

export async function startGame(gameId) {
    const response = await apiCall('game/start', { game_id: gameId });
    
    if (response.success) {
        // Iniciar o jogo
        switch(gameId) {
            case 'coin-clicker':
                startCoinClicker(gameId);
                break;
            case 'flappy-rocket':
                startFlappyRocket(gameId);
                break;
            case 'crypto-2048':
                startCrypto2048(gameId);
                break;
        }
    } else {
        alert(response.message || 'Erro ao iniciar jogo');
    }
}

function startCoinClicker(gameId) {
    // Implementar o jogo Coin Clicker
    alert('Coin Clicker iniciado!');
    // Aqui você integraria o jogo real
}

function startFlappyRocket(gameId) {
    // Implementar o jogo Flappy Rocket
    alert('Flappy Rocket iniciado!');
}

function startCrypto2048(gameId) {
    // Implementar o jogo Crypto 2048
    alert('Crypto 2048 iniciado!');
}

export function finishGame(gameId, score, won) {
    // Enviar resultado para o servidor
    apiCall('game/claim', {
        game_id: gameId,
        score: score,
        won: won
    }).then(response => {
        if (response.success) {
            showVictoryModal(response.reward, response.battery, response.level);
            // Atualizar dados do usuário
            window.updateData && window.updateData();
            // Atualizar lista de jogos
            renderGames();
        } else {
            alert(response.message || 'Erro ao finalizar jogo');
        }
    });
}

function showVictoryModal(reward, battery, level) {
    const modal = document.getElementById('victory-modal');
    if (!modal) return;

    document.getElementById('vic-power').textContent = `+ ${reward} GH/s`;
    document.getElementById('vic-drop').style.display = battery ? 'flex' : 'none';
    
    modal.classList.remove('hidden');
}

// Exportar para uso global
window.closeVictory = function() {
    document.getElementById('victory-modal').classList.add('hidden');
};

window.closeVictoryAndPlay = function() {
    document.getElementById('victory-modal').classList.add('hidden');
    navigateTo('games');
};