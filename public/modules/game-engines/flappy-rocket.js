export class FlappyRocketGame {
    constructor(level, duration, target) {
        this.level = level;
        this.duration = duration;
        this.target = target;
        
        this.score = 0;
        this.timeLeft = this.duration;
        this.gameActive = false;
        this.timer = null;
        this.rocket = null;
        this.obstacles = [];
        this.gravity = 0.5;
        this.jumpForce = -10;
        this.velocity = 0;
        this.obstacleSpeed = 3 + (level * 0.5);
        
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
        // Controles
        this.canvas.addEventListener('click', () => this.jump());
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.jump();
            }
            if (e.key === 'Escape') this.exit();
        });
    }
    
    startGame() {
        this.gameActive = true;
        this.score = 0;
        this.timeLeft = this.duration;
        this.obstacles = [];
        
        // Inicializar foguete
        this.rocket = {
            x: 100,
            y: this.canvas.height / 2,
            width: 40,
            height: 60,
            velocity: 0
        };
        
        // Iniciar temporizador
        this.timer = setInterval(() => {
            this.timeLeft--;
            
            if (this.timeLeft <= 0) {
                this.endGame(false);
            }
            
            this.updateUI();
        }, 1000);
        
        // Iniciar spawn de obstáculos
        this.spawnInterval = setInterval(() => {
            this.spawnObstacle();
        }, 2000);
        
        // Iniciar loop do jogo
        this.gameLoop();
    }
    
    spawnObstacle() {
        const gap = 150 - (this.level * 10);
        const topHeight = Math.random() * (this.canvas.height - gap - 100) + 50;
        
        this.obstacles.push({
            x: this.canvas.width,
            topHeight: topHeight,
            gap: gap,
            width: 60,
            passed: false
        });
    }
    
    gameLoop() {
        if (!this.gameActive) return;
        
        // Limpar canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Atualizar física
        this.updatePhysics();
        
        // Atualizar obstáculos
        this.updateObstacles();
        
        // Verificar colisões
        this.checkCollisions();
        
        // Desenhar
        this.drawBackground();
        this.drawRocket();
        this.drawObstacles();
        this.drawUI();
        
        // Continuar loop
        requestAnimationFrame(() => this.gameLoop());
    }
    
    updatePhysics() {
        // Aplicar gravidade
        this.rocket.velocity += this.gravity;
        this.rocket.y += this.rocket.velocity;
        
        // Limitar ao canvas
        this.rocket.y = Math.max(0, Math.min(this.canvas.height - this.rocket.height, this.rocket.y));
    }
    
    updateObstacles() {
        // Mover obstáculos
        this.obstacles = this.obstacles.filter(obstacle => {
            obstacle.x -= this.obstacleSpeed;
            
            // Verificar se passou
            if (!obstacle.passed && obstacle.x + obstacle.width < this.rocket.x) {
                obstacle.passed = true;
                this.score++;
            }
            
            // Remover se sair da tela
            return obstacle.x > -obstacle.width;
        });
    }
    
    checkCollisions() {
        // Colisão com o chão ou teto
        if (this.rocket.y <= 0 || this.rocket.y >= this.canvas.height - this.rocket.height) {
            this.endGame(false);
            return;
        }
        
        // Colisão com obstáculos
        for (const obstacle of this.obstacles) {
            // Tubo superior
            if (this.rocket.x < obstacle.x + obstacle.width &&
                this.rocket.x + this.rocket.width > obstacle.x &&
                this.rocket.y < obstacle.topHeight) {
                this.endGame(false);
                return;
            }
            
            // Tubo inferior
            const bottomY = obstacle.topHeight + obstacle.gap;
            if (this.rocket.x < obstacle.x + obstacle.width &&
                this.rocket.x + this.rocket.width > obstacle.x &&
                this.rocket.y + this.rocket.height > bottomY) {
                this.endGame(false);
                return;
            }
        }
    }
    
    drawBackground() {
        // Céu
        this.ctx.fillStyle = '#0a0e17';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Estrelas
        this.ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 50; i++) {
            const x = (i * 37) % this.canvas.width;
            const y = (i * 23) % this.canvas.height;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 1, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    drawRocket() {
        this.ctx.save();
        this.ctx.translate(this.rocket.x, this.rocket.y);
        
        // Corpo do foguete
        this.ctx.fillStyle = '#00ffff';
        this.ctx.fillRect(0, 0, this.rocket.width, this.rocket.height);
        
        // Cabine
        this.ctx.fillStyle = '#0088ff';
        this.ctx.fillRect(10, 10, 20, 20);
        
        // Asas
        this.ctx.fillStyle = '#ff4444';
        this.ctx.fillRect(-10, 10, 10, 40);
        this.ctx.fillRect(this.rocket.width, 10, 10, 40);
        
        // Chamas
        this.ctx.fillStyle = '#ffaa00';
        this.ctx.beginPath();
        this.ctx.moveTo(10, this.rocket.height);
        this.ctx.lineTo(this.rocket.width - 10, this.rocket.height);
        this.ctx.lineTo(this.rocket.width / 2, this.rocket.height + 20);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawObstacles() {
        this.obstacles.forEach(obstacle => {
            // Tubo superior
            this.ctx.fillStyle = '#00ff9d';
            this.ctx.fillRect(obstacle.x, 0, obstacle.width, obstacle.topHeight);
            
            // Tubo inferior
            const bottomY = obstacle.topHeight + obstacle.gap;
            this.ctx.fillStyle = '#00ff9d';
            this.ctx.fillRect(obstacle.x, bottomY, obstacle.width, this.canvas.height - bottomY);
            
            // Bordas
            this.ctx.fillStyle = '#009970';
            this.ctx.fillRect(obstacle.x - 5, obstacle.topHeight - 20, obstacle.width + 10, 20);
            this.ctx.fillRect(obstacle.x - 5, bottomY, obstacle.width + 10, 20);
        });
    }
    
    drawUI() {
        // Pontuação
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 10, 30);
        
        // Tempo
        this.ctx.fillText(`Time: ${this.timeLeft}`, 10, 60);
        
        // Meta
        this.ctx.fillText(`Target: ${this.target}`, 10, 90);
    }
    
    jump() {
        if (!this.gameActive) return;
        this.rocket.velocity = this.jumpForce;
    }
    
    updateUI() {
        // Atualizar HUD HTML
        const scoreElement = document.getElementById('game-score');
        const timerElement = document.getElementById('game-timer');
        const targetElement = document.getElementById('game-target');
        
        if (scoreElement) scoreElement.textContent = this.score;
        if (timerElement) timerElement.textContent = this.timeLeft;
        if (targetElement) targetElement.textContent = `Target: ${this.target}`;
        
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
            finishGame('flappy-rocket', this.score, won);
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
window.FlappyRocketGame = FlappyRocketGame;