import { CoinClickerGame } from '../games/coin-clicker.js';
import { FlappyRocketGame } from '../games/flappy-rocket.js';
import { Crypto2048Game } from '../games/crypto-2048.js';
import { apiCall } from './api.js';

export let currentGame = null;

export function initGameManager() {
    // Event listeners para botões de jogo
    document.querySelectorAll('[data-game-start]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gameId = e.target.dataset.gameStart;
            startGameSession(gameId);
        });
    });
}

export async function startGameSession(gameId) {
    const user = localStorage.getItem('username');
    if (!user) return;
    
    const response = await apiCall('game/start', { game_id: gameId });
    
    if (response.success) {
        // Inicializar o jogo correspondente
        switch(gameId) {
            case 'coin-clicker':
                currentGame = new CoinClickerGame();
                break;
            case 'flappy-rocket':
                currentGame = new FlappyRocketGame();
                break;
            case 'crypto-2048':
                currentGame = new Crypto2048Game();
                break;
        }
        
        if (currentGame) {
            currentGame.start();
        }
    } else {
        alert(response.message || 'Failed to start game');
    }
}

export function finishGame(gameId, score, won, coinsEarned = {}) {
    // Enviar resultado para o servidor
    apiCall('game/claim', {
        game_id: gameId,
        score: score,
        won: won,
        coins_earned: coinsEarned
    }).then(response => {
        if (response.success) {
            showVictoryModal(response.reward, response.battery, coinsEarned);
        }
    });
}

function showVictoryModal(reward, battery, coinsEarned) {
    // Mostrar modal de vitória
}