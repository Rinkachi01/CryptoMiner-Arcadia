// modules/game-engines/crypto-2048.js
import { COIN_IMAGES, getCoinHTML } from '../image-manager.js';

class Crypto2048 {
    constructor(gameId) {
        this.gameId = gameId;
        this.score = 0;
        this.timeLeft = 90;
        this.board = [];
        this.gameActive = false;
        this.targetScore = 128;
        this.coinValues = {
            2: 'BTC',
            4: 'ETH',
            8: 'DOGE',
            16: 'SOL',
            32: 'BNB',
            64: 'XRP',
            128: 'USDT',
            256: 'ADA',
            512: 'MATIC',
            1024: 'LTC',
            2048: 'CMA'
        };
    }
    
    init() {
        this.createBoard();
        this.addRandomTile();
        this.addRandomTile();
        this.render();
        this.startTimer();
        this.gameActive = true;
    }
    
    createBoard() {
        this.board = Array(4).fill().map(() => Array(4).fill(0));
    }
    
    addRandomTile() {
        const empty = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (this.board[r][c] === 0) empty.push([r, c]);
            }
        }
        
        if (empty.length > 0) {
            const [r, c] = empty[Math.floor(Math.random() * empty.length)];
            this.board[r][c] = Math.random() < 0.9 ? 2 : 4;
        }
    }
    
    render() {
        const container = document.getElementById('crypto2048-board');
        if (!container) return;
        
        container.innerHTML = '';
        
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const tile = document.createElement('div');
                tile.className = 'game-tile';
                
                if (this.board[r][c] !== 0) {
                    const value = this.board[r][c];
                    const coin = this.coinValues[value];
                    
                    tile.innerHTML = getCoinHTML(coin, 'medium');
                    tile.classList.add(`tile-${value}`);
                }
                
                container.appendChild(tile);
            }
        }
        
        // Atualizar UI
        document.getElementById('crypto2048-score').textContent = this.score;
        document.getElementById('crypto2048-time').textContent = this.timeLeft;
        
        // Verificar vitória
        if (this.score >= this.targetScore) {
            this.winGame();
        }
    }
    
    // ... resto da implementação do 2048

    
    moveUp() {
        for (let c = 0; c < this.gridSize; c++) {
            const column = [];
            
            // Coletar valores não-zero
            for (let r = 0; r < this.gridSize; r++) {
                if (this.grid[r][c] !== 0) {
                    column.push(this.grid[r][c]);
                }
            }
                   
            // Combinar valores iguais adjacentes
            for (let i = 0; i < column.length - 1; i++) {
                if (column[i] === column[i + 1]) {
                    column[i] *= 2;
                    column.splice(i + 1, 1);
                    this.score += column[i];
                    this.moved = true;
                }
            }
            
            // Preencher com zeros no final
            while (column.length < this.gridSize) {
                column.push(0);
            }
            
            // Atualizar coluna
            for (let r = 0; r < this.gridSize; r++) {
                if (this.grid[r][c] !== column[r]) {
                    this.moved = true;
                }
                this.grid[r][c] = column[r];
            }
        }
    }
    
    moveDown() {
        for (let c = 0; c < this.gridSize; c++) {
            const column = [];
            
            // Coletar valores não-zero (de baixo para cima)
            for (let r = this.gridSize - 1; r >= 0; r--) {
                if (this.grid[r][c] !== 0) {
                    column.push(this.grid[r][c]);
                }
            }
            
            // Combinar valores iguais adjacentes
            for (let i = 0; i < column.length - 1; i++) {
                if (column[i] === column[i + 1]) {
                    column[i] *= 2;
                    column.splice(i + 1, 1);
                    this.score += column[i];
                    this.moved = true;
                }
            }
            
            // Preencher com zeros no início
            while (column.length < this.gridSize) {
                column.push(0);
            }
            
            // Atualizar coluna (de baixo para cima)
            for (let r = this.gridSize - 1; r >= 0; r--) {
                const value = column[this.gridSize - 1 - r];
                if (this.grid[r][c] !== value) {
                    this.moved = true;
                }
                this.grid[r][c] = value;
            }
        }
    }
    
    moveLeft() {
        for (let r = 0; r < this.gridSize; r++) {
            const row = [];
            
            // Coletar valores não-zero
            for (let c = 0; c < this.gridSize; c++) {
                if (this.grid[r][c] !== 0) {
                    row.push(this.grid[r][c]);
                }
            }
            
            // Combinar valores iguais adjacentes
            for (let i = 0; i < row.length - 1; i++) {
                if (row[i] === row[i + 1]) {
                    row[i] *= 2;
                    row.splice(i + 1, 1);
                    this.score += row[i];
                    this.moved = true;
                }
            }
            
            // Preencher com zeros no final
            while (row.length < this.gridSize) {
                row.push(0);
            }
            
            // Atualizar linha
            for (let c = 0; c < this.gridSize; c++) {
                if (this.grid[r][c] !== row[c]) {
                    this.moved = true;
                }
                this.grid[r][c] = row[c];
            }
        }
    }
    
    moveRight() {
        for (let r = 0; r < this.gridSize; r++) {
            const row = [];
            
            // Coletar valores não-zero (da direita para esquerda)
            for (let c = this.gridSize - 1; c >= 0; c--) {
                if (this.grid[r][c] !== 0) {
                    row.push(this.grid[r][c]);
                }
            }
            
            // Combinar valores iguais adjacentes
            for (let i = 0; i < row.length - 1; i++) {
                if (row[i] === row[i + 1]) {
                    row[i] *= 2;
                    row.splice(i + 1, 1);
                    this.score += row[i];
                    this.moved = true;
                }
            }
            
            // Preencher com zeros no início
            while (row.length < this.gridSize) {
                row.push(0);
            }
            
            // Atualizar linha (da direita para esquerda)
            for (let c = this.gridSize - 1; c >= 0; c--) {
                const value = row[this.gridSize - 1 - c];
                if (this.grid[r][c] !== value) {
                    this.moved = true;
                }
                this.grid[r][c] = value;
            }
        }
    }
    
    renderGrid() {
        const board = document.getElementById('crypto2048-board');
        if (!board) return;
        
        board.innerHTML = '';
        
        // Criar grade 4x4
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const tile = document.createElement('div');
                tile.className = 'game-tile';
                
                const value = this.grid[r][c];
                
                if (value > 0) {
                    const crypto = this.cryptoMap[value] || this.cryptoMap[2];
                    tile.className = `game-tile tile-${value}`;
                    tile.style.backgroundColor = crypto.color;
                    
                    tile.innerHTML = `
                        <div class="tile-content">
                            <div class="tile-icon" style="font-size: 24px; font-weight: bold;">
                                ${crypto.icon}
                            </div>
                            <div class="tile-value">${value}</div>
                            <div class="tile-name">${crypto.name}</div>
                        </div>
                    `;
                }
                
                board.appendChild(tile);
            }
        }
    }
    
    updateUI() {
        // Atualizar pontuação
        const scoreElement = document.getElementById('crypto2048-score');
        if (scoreElement) scoreElement.textContent = this.score;
        
        // Atualizar tempo
        const timeElement = document.getElementById('crypto2048-time');
        if (timeElement) {
            timeElement.textContent = this.timeLeft;
            if (this.timeLeft <= 10) {
                timeElement.classList.add('timer-warning');
            } else {
                timeElement.classList.remove('timer-warning');
            }
        }
        
        // Atualizar high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('crypto2048_highscore', this.highScore);
            this.updateHighScore();
        }
        
        // Atualizar progresso
        this.updateProgress();
    }
    
    updateHighScore() {
        const highScoreElement = document.getElementById('crypto2048-highscore');
        if (highScoreElement) {
            highScoreElement.textContent = this.highScore;
        }
    }
    
    updateProgress() {
        // Calcular progresso em direção ao target (2048)
        const progress = Math.min(100, (this.score / 2048) * 100);
        
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.floor(progress)}%`;
        }
    }
    
    hasWon() {
        // Verificar se alcançou 2048
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.grid[r][c] >= 2048) {
                    return true;
                }
            }
        }
        return false;
    }
    
    isGameOver() {
        // Verificar se há movimentos possíveis
        if (this.hasEmptyCell()) return false;
        
        // Verificar se há combinações possíveis
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const value = this.grid[r][c];
                
                // Verificar vizinho à direita
                if (c < this.gridSize - 1 && this.grid[r][c + 1] === value) {
                    return false;
                }
                
                // Verificar vizinho abaixo
                if (r < this.gridSize - 1 && this.grid[r + 1][c] === value) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    hasEmptyCell() {
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.grid[r][c] === 0) {
                    return true;
                }
            }
        }
        return false;
    }
    
    endGame(won) {
        this.gameActive = false;
        
        if (this.timer) clearInterval(this.timer);
        
        // Enviar resultado
        if (typeof finishGame === 'function') {
            finishGame('crypto-2048', this.score, won || this.score >= this.target);
        }
        
        // Mostrar mensagem
        setTimeout(() => {
            alert(won ? 'Você venceu!' : 'Game Over!');
            this.exit();
        }, 500);
    }
    
    exit() {
        const modal = document.getElementById('crypto2048-modal');
        if (modal) modal.classList.add('hidden');
    }
}

// Exportar para uso global
window.Crypto2048Game = Crypto2048Game;