export class CoinClickerGame {
    constructor(level, duration, target) {
        this.level = level;
        this.duration = duration;
        this.target = target;
        
        this.score = 0;
        this.timeLeft = this.duration;
        this.gameActive = false;
        this.timer = null;
        this.coins = [];
        this.bombs = [];
        this.clickPower = 1;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.startGame();
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        if (!this.canvas || !this.ctx) {
            console.error('Canvas não encontrado');
            return;
        }
        
        // Ajustar tamanho do canvas
        this.canvas.width = 600;
        this.canvas.height = 450;
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        // Controles de teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.exit();
        });
    }
    
    startGame() {
        this.gameActive = true;
        this.score = 0;
        this.timeLeft = this.duration;
        this.coins = [];
        this.bombs = [];
        this.clickPower = 1 + (this.level * 0.5);
        
        // Iniciar temporizador
        this.timer = setInterval(() => {
            this.timeLeft--;
            
            if (this.timeLeft <= 0) {
                this.endGame(false);
            }
            
            this.updateUI();
        }, 1000);
        
        // Iniciar spawn de objetos
        this.spawnInterval = setInterval(() => {
            this.spawnObjects();
        }, 1000);
        
        // Iniciar loop do jogo
        this.gameLoop();
    }
    
    spawnObjects() {
        // Spawn de moedas
        if (this.coins.length < 10) {
            this.coins.push({
                x: Math.random() * (this.canvas.width - 40) + 20,
                y: -20,
                value: 1,
                speed: 1 + Math.random() * 2,
                size: 20 + Math.random() * 20
            });
        }
        
        // Spawn de bombas (níveis mais altos)
        if (this.level > 3 && this.bombs.length < 3) {
            this.bombs.push({
                x: Math.random() * (this.canvas.width - 30) + 15,
                y: -15,
                speed: 1.5 + Math.random() * 1.5,
                size: 15 + Math.random() * 15
            });
        }
    }
    
    gameLoop() {
        if (!this.gameActive) return;
        
        // Limpar canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Atualizar posições
        this.updateObjects();
        
        // Desenhar objetos
        this.drawObjects();
        
        // Continuar loop
        requestAnimationFrame(() => this.gameLoop());
    }
    
    updateObjects() {
        // Atualizar moedas
        this.coins = this.coins.filter(coin => {
            coin.y += coin.speed;
            return coin.y < this.canvas.height;
        });
        
        // Atualizar bombas
        this.bombs = this.bombs.filter(bomb => {
            bomb.y += bomb.speed;
            return bomb.y < this.canvas.height;
        });
    }
    
    drawObjects() {
        // Desenhar moedas
        this.coins.forEach(coin => {
            this.ctx.save();
            this.ctx.translate(coin.x, coin.y);
            
            // Corpo da moeda
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, coin.size / 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Detalhe da moeda
            this.ctx.fillStyle = '#FFA500';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, coin.size / 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Valor
            this.ctx.fillStyle = '#000';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(coin.value, 0, 0);
            
            this.ctx.restore();
        });
        
        // Desenhar bombas
        this.bombs.forEach(bomb => {
            this.ctx.save();
            this.ctx.translate(bomb.x, bomb.y);
            
            // Corpo da bomba
            this.ctx.fillStyle = '#333';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, bomb.size / 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Pavio
            this.ctx.fillStyle = '#FF4444';
            this.ctx.fillRect(-2, -bomb.size/2 - 5, 4, 10);
            
            // Risco
            this.ctx.strokeStyle = '#FF4444';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(-bomb.size/3, 0);
            this.ctx.lineTo(bomb.size/3, 0);
            this.ctx.stroke();
            
            this.ctx.restore();
        });
    }
    
    handleClick(event) {
        if (!this.gameActive) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Verificar clique em moedas
        let coinClicked = false;
        this.coins = this.coins.filter(coin => {
            const distance = Math.sqrt((x - coin.x) ** 2 + (y - coin.y) ** 2);
            
            if (distance < coin.size / 2) {
                this.score += coin.value * this.clickPower;
                coinClicked = true;
                return false;
            }
            return true;
        });
        
        // Verificar clique em bombas
        this.bombs = this.bombs.filter(bomb => {
            const distance = Math.sqrt((x - bomb.x) ** 2 + (y - bomb.y) ** 2);
            
            if (distance < bomb.size / 2) {
                this.score = Math.max(0, this.score - 50);
                return false;
            }
            return true;
        });
        
        // Efeito visual ao clicar
        if (coinClicked) {
            this.createClickEffect(x, y);
        }
        
        this.updateUI();
    }
    
    createClickEffect(x, y) {
        // Criar partículas
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const particle = {
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10,
                    life: 1.0
                };
                
                // Animar partícula
                const animateParticle = () => {
                    particle.x += particle.vx;
                    particle.y += particle.vy;
                    particle.life -= 0.05;
                    
                    if (particle.life > 0) {
                        this.ctx.save();
                        this.ctx.globalAlpha = particle.life;
                        this.ctx.fillStyle = '#FFD700';
                        this.ctx.beginPath();
                        this.ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
                        this.ctx.fill();
                        this.ctx.restore();
                        
                        requestAnimationFrame(animateParticle);
                    }
                };
                
                animateParticle();
            }, i * 50);
        }
    }
    
    updateUI() {
        // Atualizar HUD
        const scoreElement = document.getElementById('game-score');
        const timerElement = document.getElementById('game-timer');
        
        if (scoreElement) scoreElement.textContent = Math.floor(this.score);
        if (timerElement) timerElement.textContent = this.timeLeft;
        
        // Verificar vitória
        if (this.score >= this.target) {
            this.endGame(true);
        }
    }
    
    endGame(won) {
        this.gameActive = false;
        
        if (this.timer) clearInterval(this.timer);
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        
        // Enviar resultado
        if (typeof finishGame === 'function') {
            finishGame('coin-clicker', Math.floor(this.score), won);
        }
        
        // Fechar canvas
        setTimeout(() => {
            const modal = document.getElementById('game-canvas-modal');
            if (modal) modal.classList.add('hidden');
        }, 1000);
    }
    
    exit() {
        this.endGame(false);
    }
}

// Exportar para uso global
window.CoinClickerGame = CoinClickerGame;