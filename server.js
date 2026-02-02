const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Criar estrutura de diretórios se não existir
const directories = ['public', 'public/assets', 'public/modules'];
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Criada pasta: ${dir}`);
    }
});

// Arquivo de usuários
const USERS_FILE = 'users.json';

// Inicializar arquivo de usuários
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}));
    console.log('✅ Arquivo users.json criado');
}

// Função para ler usuários
function readUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.log('⚠️ Criando novo objeto de usuários');
        return {};
    }
}

// Função para salvar usuários
function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Hash de senha
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// ==================== ROTAS DE AUTENTICAÇÃO ====================

// Rota de teste
app.get('/api/test', (req, res) => {
    res.json({
        status: 'online',
        message: 'Crypto Miner Arcadia Server',
        version: '2.0.0',
        timestamp: Date.now()
    });
});

// Rota de registro
app.post('/api/auth/register', (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('📝 Tentativa de registro:', username);
        
        // Validações
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Preencha todos os campos'
            });
        }
        
        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Nome de usuário deve ter pelo menos 3 caracteres'
            });
        }
        
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Senha deve ter pelo menos 8 caracteres'
            });
        }
        
        // Verificar caracteres válidos
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({
                success: false,
                message: 'Use apenas letras, números e underscore (_)'
            });
        }
        
        const users = readUsers();
        
        // Verificar se usuário já existe
        if (users[username]) {
            return res.status(400).json({
                success: false,
                message: 'Nome de usuário já está em uso'
            });
        }
        
        // Criar novo usuário com bônus de boas-vindas
        const userId = `user_${Date.now()}`;
        const rackId = `rack_${Date.now()}`;
        const minerId = `miner_${Date.now()}`;
        
        const newUser = {
            id: userId,
            username: username,
            password: hashPassword(password),
            balance: 500.00, // Bônus: 500 CMA Coins
            batteries: 10, // Bônus: 10 baterias
            total_power: 100,
            network_power: 1500000000,
            estimated_reward: 0.005,
            electricity_expires_at: Date.now() + (24 * 60 * 60 * 1000), // 24 horas
            server_time: Date.now(),
            rooms_unlocked: 2, // Bônus: 2 salas desbloqueadas
            level: 1,
            experience: 0,
            created_at: Date.now(),
            last_login: Date.now(),
            // Bônus de boas-vindas
            welcome_bonus: true,
            // Inventário inicial
            racks: [
                {
                    id: rackId,
                    type_id: 'r_small',
                    name: 'Rack Pequeno de Boas-Vindas',
                    room_idx: 0,
                    position: 0,
                    slots: 4,
                    style: 'wood',
                    bonus: true
                },
                {
                    id: `rack_${Date.now() + 1}`,
                    type_id: 'r_large',
                    name: 'Rack Grande Premium',
                    room_idx: 1,
                    position: 0,
                    slots: 8,
                    style: 'metal',
                    bonus: true
                }
            ],
            machines: [
                {
                    id: minerId,
                    type_id: 'miner_starter',
                    name: 'Minerador Inicial Pro',
                    rack_id: rackId,
                    position: 0,
                    power: 500, // Bônus: 500 GH/s
                    watts: 100,
                    style: 'STARTER',
                    bonus: true
                },
                {
                    id: `miner_${Date.now() + 1}`,
                    type_id: 'miner_gpu',
                    name: 'GPU Miner Gratuito',
                    rack_id: null,
                    position: null,
                    power: 1000,
                    watts: 300,
                    style: 'GT730',
                    bonus: true
                }
            ],
            // Missões iniciais
            missions: {
                daily: [],
                achievements: [
                    { id: 'welcome', completed: true, reward: 100 }
                ]
            },
            // Estatísticas
            stats: {
                games_played: 0,
                total_mining: 0,
                items_bought: 0,
                total_earned: 500
            }
        };
        
        users[username] = newUser;
        writeUsers(users);
        
        console.log(`✅ Novo usuário registrado: ${username} (ID: ${userId})`);
        
        res.json({
            success: true,
            message: '🎉 Conta criada com sucesso! Bônus de boas-vindas concedidos!',
            user: {
                username: newUser.username,
                balance: newUser.balance,
                batteries: newUser.batteries,
                bonus_items: 4
            },
            bonus: {
                coins: 500,
                batteries: 10,
                miners: 2,
                racks: 2,
                rooms: 2
            }
        });
        
    } catch (error) {
        console.error('❌ Erro no registro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor. Tente novamente.'
        });
    }
});

// Rota de login
app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('🔐 Tentativa de login:', username);
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Preencha todos os campos'
            });
        }
        
        const users = readUsers();
        const user = users[username];
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }
        
        const hashedPassword = hashPassword(password);
        
        if (user.password !== hashedPassword) {
            return res.status(401).json({
                success: false,
                message: 'Senha incorreta'
            });
        }
        
        // Atualizar último login
        user.last_login = Date.now();
        user.server_time = Date.now();
        writeUsers(users);
        
        console.log(`✅ Login bem-sucedido: ${username}`);
        
        // Preparar resposta
        const userResponse = {
            username: user.username,
            balance: user.balance,
            batteries: user.batteries,
            total_power: user.total_power,
            network_power: user.network_power,
            estimated_reward: user.estimated_reward,
            electricity_expires_at: user.electricity_expires_at,
            server_time: user.server_time,
            rooms_unlocked: user.rooms_unlocked,
            level: user.level,
            racks: user.racks,
            machines: user.machines,
            stats: user.stats,
            missions: user.missions
        };
        
        res.json({
            success: true,
            message: 'Login bem-sucedido!',
            user: userResponse
        });
        
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// ==================== ROTAS DE JOGO ====================

// Rota para obter status do usuário
app.get('/api/status', (req, res) => {
    const username = req.query.username || req.headers['x-username'];
    
    if (!username) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const users = readUsers();
    const user = users[username];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Atualizar tempo
    user.server_time = Date.now();
    
    res.json({
        username: user.username,
        balance: user.balance,
        batteries: user.batteries,
        total_power: user.total_power,
        network_power: user.network_power,
        estimated_reward: user.estimated_reward,
        electricity_expires_at: user.electricity_expires_at,
        server_time: user.server_time,
        rooms_unlocked: user.rooms_unlocked,
        level: user.level,
        experience: user.experience,
        racks: user.racks || [],
        machines: user.machines || [],
        stats: user.stats || {},
        missions: user.missions || {}
    });
});

// Rota para obter catálogo
app.get('/api/catalog', (req, res) => {
    const catalog = {
        miners: [
            { id: 'miner_starter', name: 'Starter Miner', power: 100, size: 1, watts: 100, cost: 100.00, style: 'STARTER' },
            { id: 'miner_fan', name: 'Fan Miner', power: 250, size: 1, watts: 150, cost: 250.00, style: 'FAN' },
            { id: 'miner_gpu', name: 'GPU Miner', power: 500, size: 2, watts: 300, cost: 500.00, style: 'GT730' },
            { id: 'miner_gpu_pro', name: 'GPU Pro Miner', power: 1000, size: 2, watts: 500, cost: 1000.00, style: 'GTX1060' },
            { id: 'miner_rtx', name: 'RTX Miner', power: 2000, size: 3, watts: 800, cost: 2000.00, style: 'RTX3060' },
            { id: 'miner_dual', name: 'Dual Miner', power: 3000, size: 3, watts: 1200, cost: 3000.00, style: 'DUAL' },
            { id: 'miner_asic', name: 'ASIC Miner', power: 5000, size: 4, watts: 2000, cost: 5000.00, style: 'ASIC' },
            { id: 'miner_quantum', name: 'Quantum Miner', power: 10000, size: 4, watts: 5000, cost: 10000.00, style: 'QUANTUM' }
        ],
        racks: [
            { id: 'r_small', name: 'Small Wood Rack', slots: 4, cost: 50.00, style: 'wood', size: 'small' },
            { id: 'r_large', name: 'Large Metal Rack', slots: 8, cost: 100.00, style: 'metal', size: 'large' },
            { id: 'r_industrial', name: 'Industrial Rack', slots: 12, cost: 200.00, style: 'industrial', size: 'industrial' },
            { id: 'r_server', name: 'Server Rack', slots: 16, cost: 500.00, style: 'server', size: 'server' }
        ],
        upgrades: [
            { id: 'upg_power', name: 'Power Upgrade', description: '+20% mining power', cost: 500.00, effect: { power_mult: 1.2 } },
            { id: 'upg_efficiency', name: 'Efficiency Upgrade', description: '-15% energy consumption', cost: 300.00, effect: { energy_mult: 0.85 } },
            { id: 'upg_cooling', name: 'Cooling System', description: 'Prevents overheating', cost: 400.00, effect: { cooling: true } }
        ],
        games: {
            'coin-clicker': { name: 'Coin Clicker', reward: 100, time: 60, base_target: 100, target_step: 20, diff_mult: 1.2 },
            'flappy-rocket': { name: 'Flappy Rocket', reward: 150, time: 60, base_target: 10, target_step: 2, diff_mult: 1.3 },
            'crypto-2048': { name: 'Crypto 2048', reward: 200, time: 120, base_target: 256, target_step: 128, diff_mult: 1.5 },
            'crypto-match': { name: 'Crypto Match', reward: 120, time: 90, base_target: 500, target_step: 100, diff_mult: 1.4 },
            'crypto-defender': { name: 'Crypto Defender', reward: 180, time: 75, base_target: 15, target_step: 5, diff_mult: 1.35 }
        }
    };
    
    res.json({ catalog: catalog });
});

// Rota para obter níveis de jogo
app.get('/api/game-levels', (req, res) => {
    const username = req.query.username || req.headers['x-username'];
    
    if (!username) {
        return res.json({});
    }
    
    const users = readUsers();
    const user = users[username];
    
    if (!user) {
        return res.json({});
    }
    
    // Níveis padrão ou do usuário
    const levels = {
        'coin-clicker': { level: user.level || 1, last_played: 0, high_score: 0 },
        'flappy-rocket': { level: user.level || 1, last_played: 0, high_score: 0 },
        'crypto-2048': { level: user.level || 1, last_played: 0, high_score: 0 },
        'crypto-match': { level: user.level || 1, last_played: 0, high_score: 0 },
        'crypto-defender': { level: user.level || 1, last_played: 0, high_score: 0 }
    };
    
    res.json(levels);
});

// Rota para mineração
app.post('/api/mine', (req, res) => {
    const username = req.body.username || req.headers['x-username'];
    
    if (!username) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const users = readUsers();
    const user = users[username];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Calcular mineração baseada no poder total
    const miningRate = user.total_power / 1000;
    const reward = (Math.random() * 0.001 * miningRate) + 0.0001;
    
    user.balance += reward;
    user.estimated_reward = reward;
    user.stats.total_mining += reward;
    
    writeUsers(users);
    
    console.log(`⛏️ Mineração de ${username}: +${reward.toFixed(6)} CMA`);
    
    res.json({
        success: true,
        reward: reward,
        balance: user.balance,
        total_mining: user.stats.total_mining
    });
});

// Rota para comprar item
app.post('/api/buy', (req, res) => {
    const username = req.body.username || req.headers['x-username'];
    const { item_id, type } = req.body;
    
    if (!username) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const users = readUsers();
    const user = users[username];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Obter catálogo
    const catalog = {
        miners: [
            { id: 'miner_starter', name: 'Starter Miner', power: 100, size: 1, watts: 100, cost: 100.00, style: 'STARTER' },
            { id: 'miner_fan', name: 'Fan Miner', power: 250, size: 1, watts: 150, cost: 250.00, style: 'FAN' },
            { id: 'miner_gpu', name: 'GPU Miner', power: 500, size: 2, watts: 300, cost: 500.00, style: 'GT730' },
            { id: 'miner_gpu_pro', name: 'GPU Pro Miner', power: 1000, size: 2, watts: 500, cost: 1000.00, style: 'GTX1060' },
            { id: 'miner_rtx', name: 'RTX Miner', power: 2000, size: 3, watts: 800, cost: 2000.00, style: 'RTX3060' },
            { id: 'miner_dual', name: 'Dual Miner', power: 3000, size: 3, watts: 1200, cost: 3000.00, style: 'DUAL' },
            { id: 'miner_asic', name: 'ASIC Miner', power: 5000, size: 4, watts: 2000, cost: 5000.00, style: 'ASIC' },
            { id: 'miner_quantum', name: 'Quantum Miner', power: 10000, size: 4, watts: 5000, cost: 10000.00, style: 'QUANTUM' }
        ],
        racks: [
            { id: 'r_small', name: 'Small Wood Rack', slots: 4, cost: 50.00, style: 'wood', size: 'small' },
            { id: 'r_large', name: 'Large Metal Rack', slots: 8, cost: 100.00, style: 'metal', size: 'large' }
        ]
    };
    
    let item;
    if (type === 'miner') {
        item = catalog.miners.find(m => m.id === item_id);
    } else if (type === 'rack') {
        item = catalog.racks.find(r => r.id === item_id);
    }
    
    if (!item) {
        return res.json({
            success: false,
            message: 'Item não encontrado'
        });
    }
    
    if (user.balance < item.cost) {
        return res.json({
            success: false,
            message: 'Saldo insuficiente'
        });
    }
    
    // Processar compra
    user.balance -= item.cost;
    user.stats.items_bought += 1;
    
    if (type === 'miner') {
        const newMiner = {
            id: `miner_${Date.now()}`,
            type_id: item.id,
            name: item.name,
            rack_id: null,
            position: null,
            power: item.power,
            watts: item.watts,
            style: item.style,
            purchased_at: Date.now()
        };
        
        user.machines.push(newMiner);
        
    } else if (type === 'rack') {
        const newRack = {
            id: `rack_${Date.now()}`,
            type_id: item.id,
            name: item.name,
            room_idx: null,
            position: null,
            slots: item.slots,
            style: item.style,
            size: item.size,
            purchased_at: Date.now()
        };
        
        user.racks.push(newRack);
    }
    
    writeUsers(users);
    
    console.log(`🛒 Compra de ${username}: ${item.name} por ${item.cost} CMA`);
    
    res.json({
        success: true,
        message: `Compra realizada: ${item.name}!`,
        balance: user.balance,
        item: item
    });
});

// Rota para recarregar energia
app.post('/api/recharge', (req, res) => {
    const username = req.body.username || req.headers['x-username'];
    const { type } = req.body;
    
    if (!username) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const users = readUsers();
    const user = users[username];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    if (type === 'battery') {
        if (user.batteries <= 0) {
            return res.json({
                success: false,
                message: 'Sem baterias disponíveis'
            });
        }
        user.batteries -= 1;
    } else if (type === 'free') {
        // Verificar se já usou a recarga grátis hoje
        const now = Date.now();
        const lastFreeRecharge = user.last_free_recharge || 0;
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (now - lastFreeRecharge < oneDay) {
            return res.json({
                success: false,
                message: 'Recarga grátis já usada hoje'
            });
        }
        
        user.last_free_recharge = now;
    }
    
    // Recarregar por 24 horas
    user.electricity_expires_at = Date.now() + (24 * 60 * 60 * 1000);
    writeUsers(users);
    
    res.json({
        success: true,
        message: 'Energia recarregada!',
        batteries: user.batteries,
        expires_at: user.electricity_expires_at
    });
});

// Rota para iniciar jogo
app.post('/api/game/start', (req, res) => {
    const username = req.body.username || req.headers['x-username'];
    const { game_id } = req.body;
    
    if (!username) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    console.log(`🎮 Iniciando jogo ${game_id} para ${username}`);
    
    res.json({
        success: true,
        message: 'Jogo iniciado!',
        game_id: game_id,
        timestamp: Date.now(),
        cooldown: 60 // segundos
    });
});

// Rota para reivindicar recompensa do jogo
app.post('/api/game/claim', (req, res) => {
    const username = req.body.username || req.headers['x-username'];
    const { game_id, score, won } = req.body;
    
    if (!username) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const users = readUsers();
    const user = users[username];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Calcular recompensa
    let baseReward = 100;
    switch (game_id) {
        case 'coin-clicker': baseReward = 100; break;
        case 'flappy-rocket': baseReward = 150; break;
        case 'crypto-2048': baseReward = 200; break;
        case 'crypto-match': baseReward = 120; break;
        case 'crypto-defender': baseReward = 180; break;
    }
    
    const reward = won ? baseReward * 2 : baseReward;
    const batteryDrop = won && Math.random() > 0.5 ? 1 : 0;
    const experience = Math.floor(score / 10);
    
    // Atualizar usuário
    user.total_power += reward;
    user.balance += reward * 0.1; // 10% do reward em moedas
    if (batteryDrop) user.batteries += 1;
    user.experience += experience;
    user.stats.games_played += 1;
    user.stats.total_earned += reward * 0.1;
    
    // Verificar level up
    const expNeeded = user.level * 1000;
    if (user.experience >= expNeeded) {
        user.level += 1;
        user.experience = 0;
        user.balance += 500; // Bônus de level up
    }
    
    writeUsers(users);
    
    console.log(`🏆 Jogo ${game_id} de ${username}: Reward=${reward}, XP=${experience}`);
    
    res.json({
        success: true,
        reward: reward,
        coins: reward * 0.1,
        battery: batteryDrop,
        experience: experience,
        level: user.level,
        level_up: user.experience === 0 && user.level > 1
    });
});

// Rota para colocar rack
app.post('/api/rack/place', (req, res) => {
    const username = req.body.username || req.headers['x-username'];
    const { rack_id, room_idx, position } = req.body;
    
    if (!username) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const users = readUsers();
    const user = users[username];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const rack = user.racks.find(r => r.id === rack_id);
    if (!rack) {
        return res.json({
            success: false,
            message: 'Rack não encontrado'
        });
    }
    
    // Verificar se a sala está desbloqueada
    if (room_idx >= user.rooms_unlocked) {
        return res.json({
            success: false,
            message: 'Sala não desbloqueada'
        });
    }
    
    // Verificar se posição está disponível
    const racksInRoom = user.racks.filter(r => r.room_idx === room_idx && r.position !== null);
    if (racksInRoom.length >= 12) { // Máximo 12 racks por sala
        return res.json({
            success: false,
            message: 'Sala cheia'
        });
    }
    
    // Colocar rack
    rack.room_idx = room_idx;
    rack.position = position;
    
    writeUsers(users);
    
    res.json({
        success: true,
        message: 'Rack colocado com sucesso!',
        rack: rack
    });
});

// Rota para equipar minerador
app.post('/api/miner/equip', (req, res) => {
    const username = req.body.username || req.headers['x-username'];
    const { miner_id, rack_id, position } = req.body;
    
    if (!username) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const users = readUsers();
    const user = users[username];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const miner = user.machines.find(m => m.id === miner_id);
    const rack = user.racks.find(r => r.id === rack_id);
    
    if (!miner || !rack) {
        return res.json({
            success: false,
            message: 'Minerador ou rack não encontrado'
        });
    }
    
    // Verificar se slot está disponível
    const minersInRack = user.machines.filter(m => m.rack_id === rack_id);
    if (minersInRack.length >= rack.slots) {
        return res.json({
            success: false,
            message: 'Rack cheio'
        });
    }
    
    // Equipar minerador
    miner.rack_id = rack_id;
    miner.position = position;
    
    // Atualizar poder total
    user.total_power = user.machines
        .filter(m => m.rack_id !== null)
        .reduce((total, m) => total + m.power, 0);
    
    writeUsers(users);
    
    res.json({
        success: true,
        message: 'Minerador equipado!',
        total_power: user.total_power
    });
});

// Rota para obter leaderboard
app.get('/api/leaderboard', (req, res) => {
    const users = readUsers();
    
    // Converter objeto em array
    const usersArray = Object.values(users);
    
    // Ordenar por diferentes critérios
    const byPower = [...usersArray].sort((a, b) => b.total_power - a.total_power);
    const byBalance = [...usersArray].sort((a, b) => b.balance - a.balance);
    const byLevel = [...usersArray].sort((a, b) => b.level - a.level);
    
    // Formatar para leaderboard (esconder informações sensíveis)
    const formatForLeaderboard = (usersList, criteria) => {
        return usersList.slice(0, 10).map((user, index) => ({
            rank: index + 1,
            username: user.username,
            value: criteria === 'power' ? user.total_power :
                   criteria === 'balance' ? user.balance :
                   criteria === 'level' ? user.level : 0,
            level: user.level
        }));
    };
    
    res.json({
        power: formatForLeaderboard(byPower, 'power'),
        wealth: formatForLeaderboard(byBalance, 'balance'),
        level: formatForLeaderboard(byLevel, 'level')
    });
});

// Rota para obter estatísticas globais
app.get('/api/stats', (req, res) => {
    const users = readUsers();
    const usersArray = Object.values(users);
    
    const totalUsers = usersArray.length;
    const totalPower = usersArray.reduce((sum, user) => sum + user.total_power, 0);
    const totalBalance = usersArray.reduce((sum, user) => sum + user.balance, 0);
    const avgLevel = usersArray.reduce((sum, user) => sum + user.level, 0) / totalUsers || 0;
    
    res.json({
        total_users: totalUsers,
        total_mining_power: totalPower,
        total_wealth: totalBalance,
        average_level: avgLevel.toFixed(1),
        online_users: Math.floor(totalUsers * 0.3) // Simulação
    });
});

// Rota padrão para servir o index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 CRYPTO MINER ARCADIA - SERVIDOR 2.0');
    console.log('='.repeat(60));
    console.log(`📡 Porta: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📁 Pasta pública: ${path.join(__dirname, 'public')}`);
    console.log(`👤 Sistema de registro: ATIVO (senha mínima: 8 caracteres)`);
    console.log(`🎮 Minigames: 5 disponíveis`);
    console.log(`💎 Bônus de registro: 500 CMA + 2 racks + 2 mineradores`);
    console.log('='.repeat(60));
    console.log('✅ Servidor pronto!');
    console.log('='.repeat(60));
});