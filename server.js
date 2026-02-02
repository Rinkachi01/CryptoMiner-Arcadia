const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Arquivo para armazenar usuários
const USERS_FILE = path.join(__dirname, 'users.json');

// Inicializar arquivo de usuários se não existir
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}));
}

// Helper para ler usuários
function readUsers() {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
}

// Helper para escrever usuários
function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Hash de senha simples (em produção use bcrypt)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Rota de registro
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;

    console.log('Tentativa de registro:', { username });

    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Preencha todos os campos' 
        });
    }

    if (username.length < 3) {
        return res.status(400).json({ 
            success: false, 
            message: 'Nome de usuário deve ter no mínimo 3 caracteres' 
        });
    }

    if (password.length < 8) {
        return res.status(400).json({ 
            success: false, 
            message: 'Senha deve ter no mínimo 8 caracteres' 
        });
    }

    const users = readUsers();
    
    if (users[username]) {
        return res.status(400).json({ 
            success: false, 
            message: 'Nome de usuário já está em uso' 
        });
    }

    // Criar novo usuário com dados iniciais
    const newUser = {
        username,
        password: hashPassword(password),
        balance: 100.00,
        batteries: 5,
        total_power: 0,
        network_power: 1000000000,
        estimated_reward: 0.0001,
        electricity_expires_at: Date.now() + (24 * 60 * 60 * 1000),
        server_time: Date.now(),
        rooms_unlocked: 1,
        racks: [
            {
                id: 'rack_1',
                type_id: 'r_small',
                room_idx: 0,
                position: 0
            }
        ],
        machines: [
            {
                id: 'miner_1',
                type_id: 'miner_starter',
                rack_id: 'rack_1',
                position: 0,
                power: 100
            }
        ],
        created_at: Date.now(),
        last_login: Date.now()
    };

    users[username] = newUser;
    writeUsers(users);

    console.log('Usuário registrado com sucesso:', username);

    res.json({ 
        success: true, 
        message: 'Conta criada com sucesso!',
        user: {
            username: newUser.username,
            balance: newUser.balance,
            batteries: newUser.batteries
        }
    });
});

// Rota de login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    console.log('Tentativa de login:', { username });

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

    if (user.password !== hashPassword(password)) {
        return res.status(401).json({ 
            success: false, 
            message: 'Senha incorreta' 
        });
    }

    // Atualizar último login
    user.last_login = Date.now();
    writeUsers(users);

    res.json({ 
        success: true, 
        message: 'Login bem-sucedido!',
        user: {
            username: user.username,
            balance: user.balance,
            batteries: user.batteries
        }
    });
});

// Rota para obter status do usuário
app.get('/api/status', (req, res) => {
    const username = req.query.username || req.headers['x-username'];
    
    console.log('Buscando status para:', username);

    if (!username) {
        return res.status(401).json({ 
            error: 'Não autorizado' 
        });
    }

    const users = readUsers();
    const user = users[username];

    if (!user) {
        return res.status(404).json({ 
            error: 'Usuário não encontrado' 
        });
    }

    // Atualizar tempo do servidor
    user.server_time = Date.now();
    
    res.json({
        username: user.username,
        balance: user.balance,
        batteries: user.batteries,
        total_power: user.total_power || 100,
        network_power: user.network_power || 1000000000,
        estimated_reward: user.estimated_reward || 0.0001,
        electricity_expires_at: user.electricity_expires_at,
        server_time: user.server_time,
        rooms_unlocked: user.rooms_unlocked || 1,
        racks: user.racks || [],
        machines: user.machines || []
    });
});

// Rota para obter catálogo
app.get('/api/catalog', (req, res) => {
    console.log('Fornecendo catálogo');
    
    const catalog = {
        miners: [
            { 
                id: 'miner_starter', 
                name: 'Starter Miner', 
                power: 100, 
                size: 1, 
                watts: 100, 
                cost: 100.00,
                style: 'STARTER'
            },
            { 
                id: 'miner_gpu', 
                name: 'GPU Miner', 
                power: 500, 
                size: 2, 
                watts: 300, 
                cost: 500.00,
                style: 'GT730'
            },
            { 
                id: 'miner_asic', 
                name: 'ASIC Miner', 
                power: 1000, 
                size: 3, 
                watts: 1000, 
                cost: 1000.00,
                style: 'ASIC'
            },
            { 
                id: 'miner_quantum', 
                name: 'Quantum Miner', 
                power: 5000, 
                size: 4, 
                watts: 5000, 
                cost: 5000.00,
                style: 'QUANTUM'
            }
        ],
        racks: [
            { 
                id: 'r_small', 
                name: 'Small Rack', 
                slots: 4, 
                cost: 50.00,
                style: 'wood'
            },
            { 
                id: 'r_large', 
                name: 'Large Rack', 
                slots: 8, 
                cost: 100.00,
                style: 'metal'
            }
        ],
        games: {
            'coin-clicker': { 
                name: 'Coin Clicker', 
                reward: 100, 
                time: 60, 
                base_target: 100, 
                target_step: 20, 
                diff_mult: 1.2 
            },
            'flappy-rocket': { 
                name: 'Flappy Rocket', 
                reward: 150, 
                time: 60, 
                base_target: 10, 
                target_step: 2, 
                diff_mult: 1.3 
            },
            'crypto-2048': { 
                name: 'Crypto 2048', 
                reward: 200, 
                time: 120, 
                base_target: 256, 
                target_step: 128, 
                diff_mult: 1.5 
            }
        }
    };

    res.json({ catalog: catalog });
});

// Rota para obter níveis de jogo do usuário
app.get('/api/game-levels', (req, res) => {
    const username = req.query.username || req.headers['x-username'];
    
    if (!username) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    // Níveis padrão para novos usuários
    const levels = {
        'coin-clicker': { level: 1, last_played: 0 },
        'flappy-rocket': { level: 1, last_played: 0 },
        'crypto-2048': { level: 1, last_played: 0 }
    };

    console.log('Fornecendo níveis para:', username);
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

    // Simular mineração
    const reward = 0.0001;
    user.balance += reward;
    user.estimated_reward = reward;
    writeUsers(users);

    console.log('Mineração para:', username, 'Recompensa:', reward);

    res.json({ 
        success: true, 
        reward: reward,
        balance: user.balance 
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

    // Catálogo de itens
    const catalog = {
        miners: [
            { id: 'miner_starter', name: 'Starter Miner', power: 100, size: 1, watts: 100, cost: 100.00 },
            { id: 'miner_gpu', name: 'GPU Miner', power: 500, size: 2, watts: 300, cost: 500.00 },
            { id: 'miner_asic', name: 'ASIC Miner', power: 1000, size: 3, watts: 1000, cost: 1000.00 }
        ],
        racks: [
            { id: 'r_small', name: 'Small Rack', slots: 4, cost: 50.00 },
            { id: 'r_large', name: 'Large Rack', slots: 8, cost: 100.00 }
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

    if (type === 'miner') {
        user.machines.push({
            id: 'miner_' + Date.now(),
            type_id: item.id,
            rack_id: null,
            position: null,
            power: item.power
        });
    } else if (type === 'rack') {
        user.racks.push({
            id: 'rack_' + Date.now(),
            type_id: item.id,
            room_idx: null,
            position: null
        });
    }

    writeUsers(users);

    console.log('Compra realizada:', { username, item_id, type });

    res.json({ 
        success: true, 
        message: 'Compra realizada com sucesso!',
        balance: user.balance 
    });
});

// Rota para iniciar jogo
app.post('/api/game/start', (req, res) => {
    const username = req.body.username || req.headers['x-username'];
    const { game_id } = req.body;

    if (!username) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    console.log('Iniciando jogo:', { username, game_id });

    // Simular início do jogo
    res.json({ 
        success: true, 
        message: 'Jogo iniciado!',
        game_id: game_id,
        timestamp: Date.now()
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

    // Calcular recompensa base
    let baseReward = 100;
    switch(game_id) {
        case 'coin-clicker': baseReward = 100; break;
        case 'flappy-rocket': baseReward = 150; break;
        case 'crypto-2048': baseReward = 200; break;
    }

    const reward = won ? baseReward * 2 : baseReward;
    const batteryDrop = won && Math.random() > 0.7 ? 1 : 0;

    // Atualizar usuário
    user.total_power += reward;
    if (batteryDrop) user.batteries += 1;
    writeUsers(users);

    console.log('Recompensa de jogo:', { username, game_id, reward, won });

    res.json({ 
        success: true, 
        reward: reward,
        battery: batteryDrop,
        level: 1
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
    }

    // Recarregar energia por 24 horas
    user.electricity_expires_at = Date.now() + (24 * 60 * 60 * 1000);
    writeUsers(users);

    res.json({ 
        success: true, 
        message: 'Energia recarregada!',
        batteries: user.batteries,
        expires_at: user.electricity_expires_at
    });
});

// Rota padrão para servir o index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor Crypto Miner Arcadia rodando na porta ${PORT}`);
    console.log(`📁 Acesse: http://localhost:${PORT}`);
    console.log(`👤 Sistema de autenticação ativo`);
    console.log(`💾 Banco de dados: ${USERS_FILE}`);
})