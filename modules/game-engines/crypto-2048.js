// modules/game-engines/crypto-2048.js
import { getCoinHTML, loadCoinImage } from '../image-manager.js';

export class Crypto2048Game {
    constructor(level, duration, target) {
        this.level = level;
        this.duration = 60;
        this.target = 1024;
        
        this.grid = [];
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('crypto2048_highscore')) || 0;
        this.timeLeft = this.duration;
        this.gameActive = false;
        this.timer = null;
        this.gridSize = 4;
        
        this.coinsEarned = {
            'DOGE': 0,
            'SOL': 0,
            'ETH': 0,
            'BTC': 0,
            'RLT': 0
        };
        
        // Mapeamento de valores para moedas
        this.valueToCoin = {
            2: 'ROLLER',
            4: 'ADA',
            8: 'LTC',
            16: 'MATIC',
            32: 'DOGE',
            64: 'SOL',
            128: 'BNB',
            256: 'XRP',
            512: 'ETH',
            1024: 'ETH',
            2048: 'BTC'
        };
        
        this.init();
    }
    
    init() {
        this.createGrid();
        this.setupEventListeners();
        this.updateProgressionLegend();
        this.updateHighScore();
    }
    
    createGrid() {
        const board = document.getElementById('crypto2048-board');
        if (!board) return;
        
        board.innerHTML = '';
        
        for (let i = 0; i < this.gridSize * this.gridSize; i++) {
            const tile = document.createElement('div');
            tile.className = 'game-tile';
            tile.dataset.index = i;
            board.appendChild(tile);
        }
        
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(0));
    }
    
    updateGridUI() {
        const tiles = document.querySelectorAll('#crypto2048-board .game-tile');
        
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const index = r * this.gridSize + c;
                const tile = tiles[index];
                const value = this.grid[r][c];
                
                if (tile) {
                    tile.className = 'game-tile';
                    if (value > 0) {
                        const coinSymbol = this.valueToCoin[value] || 'ROLLER';
                        tile.className = `game-tile tile-${value}`;
                        
                        // Usar HTML com imagem da moeda
                        tile.innerHTML = getCoinHTML(coinSymbol, 'medium');
                        
                        // Adicionar valor como tooltip
                        tile.title = `${value} - ${this.getCoinName(coinSymbol)}`;
                    }
                }
            }
        }
        
        this.updateProgressionLegend();
    }
    
    getCoinName(symbol) {
        const coinNames = {
            'ROLLER': 'Roller Token',
            'ADA': 'Cardano',
            'LTC': 'Litecoin',
            'MATIC': 'Polygon',
            'DOGE': 'Dogecoin',
            'SOL': 'Solana',
            'BNB': 'Binance Coin',
            'XRP': 'Ripple',
            'ETH': 'Ethereum',
            'BTC': 'Bitcoin'
        };
        return coinNames[symbol] || symbol;
    }
    
    updateProgressionLegend() {
        const progressionList = document.getElementById('progression-list');
        if (!progressionList) return;
        
        progressionList.innerHTML = '';
        
        const currentValues = new Set();
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.grid[r][c] > 0) {
                    currentValues.add(this.grid[r][c]);
                }
            }
        }
        
        // Ordenar valores
        const sortedValues = Object.keys(this.valueToCoin).map(Number).sort((a, b) => a - b);
        
        sortedValues.forEach(value => {
            const coinSymbol = this.valueToCoin[value];
            const item = document.createElement('div');
            item.className = 'progression-item';
            if (currentValues.has(value)) {
                item.classList.add('active');
            }
            
            item.innerHTML = `
                <div class="progression-icon" style="background: ${this.getCoinColor(coinSymbol)}">
                    ${getCoinHTML(coinSymbol, 'small')}
                </div>
                <div class="progression-info">
                    <div class="progression-name">${this.getCoinName(coinSymbol)}</div>
                    <div class="progression-value">${value}</div>
                </div>
            `;
            
            progressionList.appendChild(item);
        });
    }
    
    getCoinColor(symbol) {
        const coinColors = {
            'ROLLER': '#6c5ce7',
            'ADA': '#0033AD',
            'LTC': '#BFBBBB',
            'MATIC': '#8247E5',
            'DOGE': '#C2A633',
            'SOL': '#00FFA3',
            'BNB': '#F0B90B',
            'XRP': '#23292F',
            'ETH': '#627EEA',
            'BTC': '#F7931A'
        };
        return coinColors[symbol] || '#666666';
    }
    
    // ... resto do código permanece similar
}