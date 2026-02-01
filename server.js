const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// server.js - Ajustes iniciais
// ... (código anterior até a definição de ECO)

const ECO = {
    BLOCK_REWARD: 20.00,
    GAME_POWER_DURATION: 24 * 60 * 60 * 1000,
    INITIAL_NETWORK_POWER: 0,  // Começa com zero, pois só o jogador contribui
    NETWORK_GROWTH_RATE: 1500,
    BATTERY_DROP_CHANCE: 0.35,
    ROOM_COSTS: [0, 20.00, 50.00, 100.00, 200.00],
    ONE_BAR_DURATION: 6 * 60 * 60 * 1000,
    MAX_BARS: 4,
    MAX_GAME_LEVEL: 10,
    MIN_GAME_DURATION_TOLERANCE: 5,
    COOLDOWN_BASE: 30,
    COOLDOWN_PER_LEVEL: 15
};

// ... (o resto do código)

// Na função calculateUserData, ajustar o cálculo do poder total
async function calculateUserData(userId) {
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) return null;

    const now = Date.now();
    const hasPower = user.electricity_expires_at > now;
    let machinePower = 0;

    const equipped = await dbAll(`
        SELECT m.type_id
        FROM machines m
        JOIN racks r ON m.rack_id = r.id
        WHERE m.user_id = ? AND r.room_idx IS NOT NULL
    `, [userId]);

    if (hasPower && equipped.length > 0) {
        equipped.forEach(m => {
            const stats = CATALOG.miners.find(x => x.id === m.type_id);
            if (stats) machinePower += stats.power;
        });
    }

    let gamePower = 0;
    const activeGames = await dbAll("SELECT amount FROM game_power WHERE user_id = ? AND expires_at > ?", [userId, now]);
    activeGames.forEach(g => gamePower += g.amount);

    return {
        total: machinePower + gamePower,
        user,
        hasPower
    };
}

// Na rota /api/status, ajustar o cálculo da rede
app.post('/api/status', async (req, res) => {
    try {
        const { username } = req.body;
        const uRaw = await dbGet("SELECT id FROM users WHERE username = ?", [username]);

        if (!uRaw) return res.json({ error: true });

        const data = await calculateUserData(uRaw.id);
        const global = await dbGet("SELECT network_power FROM global WHERE id = 1");
        
        // A rede total é a soma do poder de todos os usuários (neste caso, só um)
        // Mas como temos apenas um jogador, a rede é o poder dele mais o crescimento global
        const realNet = global.network_power + data.total;
        const share = realNet > 0 ? (data.total / realNet) : 0;

        const racks = await dbAll("SELECT * FROM racks WHERE user_id = ?", [uRaw.id]);
        const machines = await dbAll("SELECT * FROM machines WHERE user_id = ?", [uRaw.id]);

        res.json({
            balance: data.user.balance,
            total_power: data.total,
            network_power: realNet,
            estimated_reward: ECO.BLOCK_REWARD * share,
            electricity_expires_at: data.user.electricity_expires_at,
            server_time: Date.now(),
            machines: machines,
            racks: racks,
            batteries: data.user.inventory_batteries,
            rooms_unlocked: data.user.rooms_unlocked,
            free_recharge_available: (Date.now() - data.user.last_free_recharge > 86400000)
        });
    } catch (e) {
        console.error(e);
        res.json({ error: true });
    }
});

// ... (resto do código)

// server.js - Ajustes nos jogos
const GAMES_BASE = {
    'coin-clicker': {
        name: 'Coin Clicker',
        reward: 300,
        diff_mult: 1.1,  // Reduzido de 1.2
        time: 40,
        base_target: 50,  // Reduzido de 80
        target_step: 30   // Reduzido de 50
    },
    'flappy-rocket': {
        name: 'Flappy Rocket',
        reward: 400,
        diff_mult: 1.15, // Reduzido de 1.25
        time: 60,
        base_target: 5,  // Reduzido de 8
        target_step: 2   // Reduzido de 3
    },
    'crypto-2048': {
        name: 'Crypto 2048',
        reward: 500,
        diff_mult: 1.2,  // Reduzido de 1.3
        time: 90,        // Aumentado de 60
        base_target: 256, // Reduzido de 512
        target_step: 128  // Reduzido de 256
    }
};

const CATALOG = {
    miners: [
        { id: 'm1', name: 'Starter Fan', power: 1000, cost: 0.50, size: 1, watts: 5, style: 'STARTER' },
        { id: 'm2', name: 'GT 730', power: 5000, cost: 2.00, size: 1, watts: 10, style: 'GT730' },
        { id: 'm3', name: 'GTX 1060', power: 15000, cost: 5.00, size: 1, watts: 20, style: 'GTX1060' },
        { id: 'm4', name: 'RTX 3060', power: 45000, cost: 15.00, size: 1, watts: 50, style: 'RTX3060' },
        { id: 'm5', name: 'Dual RX', power: 75000, cost: 25.00, size: 2, watts: 80, style: 'DUAL' },
        { id: 'm6', name: 'ASIC Pro', power: 150000, cost: 60.00, size: 1, watts: 150, style: 'ASIC' },
        { id: 'm7', name: 'Quantum', power: 500000, cost: 200.00, size: 2, watts: 300, style: 'QUANTUM' }
    ],
    racks: [
        { id: 'r_small', name: 'Hack Madeira', slots: 4, cost: 1.50, style: 'wood' },
        { id: 'r_large', name: 'Rack Metal', slots: 8, cost: 10.00, style: 'metal' }
    ]
};

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./game.db');
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// Inicialização do banco de dados
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        balance REAL DEFAULT 0.00,
        inventory_batteries INTEGER DEFAULT 0,
        last_free_recharge INTEGER DEFAULT 0,
        rooms_unlocked INTEGER DEFAULT 1,
        electricity_expires_at INTEGER DEFAULT 0,
        last_mine_time INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS racks (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        type_id TEXT,
        slots INTEGER,
        room_idx INTEGER DEFAULT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS machines (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        type_id TEXT,
        rack_id INTEGER DEFAULT NULL,
        position INTEGER DEFAULT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS game_power (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        amount INTEGER,
        expires_at INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS global (
        id INTEGER PRIMARY KEY,
        network_power INTEGER DEFAULT ${ECO.INITIAL_NETWORK_POWER}
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_game_levels (
        user_id INTEGER,
        game_id TEXT,
        level INTEGER DEFAULT 1,
        last_played INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, game_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS game_sessions (
        user_id INTEGER,
        game_id TEXT,
        start_time INTEGER,
        valid_until INTEGER,
        PRIMARY KEY(user_id)
    )`);

    db.run(`INSERT OR IGNORE INTO global (id, network_power) VALUES (1, ${ECO.INITIAL_NETWORK_POWER})`);
});

async function calculateUserData(userId) {
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) return null;

    const now = Date.now();
    const hasPower = user.electricity_expires_at > now;
    let machinePower = 0;

    const equipped = await dbAll(`
        SELECT m.type_id
        FROM machines m
        JOIN racks r ON m.rack_id = r.id
        WHERE m.user_id = ? AND r.room_idx IS NOT NULL
    `, [userId]);

    if (hasPower && equipped.length > 0) {
        equipped.forEach(m => {
            const stats = CATALOG.miners.find(x => x.id === m.type_id);
            if (stats) machinePower += stats.power;
        });
    }

    let gamePower = 0;
    const activeGames = await dbAll("SELECT amount FROM game_power WHERE user_id = ? AND expires_at > ?", [userId, now]);
    activeGames.forEach(g => gamePower += g.amount);

    return {
        total: machinePower + gamePower,
        user,
        hasPower
    };
}

// Rotas de autenticação
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.json({ success: false, message: "Dados inválidos" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const fullEnergy = Date.now() + (ECO.MAX_BARS * ECO.ONE_BAR_DURATION);

        await dbRun(
            "INSERT INTO users (username, password, balance, inventory_batteries, rooms_unlocked, electricity_expires_at) VALUES (?, ?, 2.00, 1, 1, ?)",
            [username, hashedPassword, fullEnergy]
        );

        const user = await dbGet("SELECT id FROM users WHERE username = ?", [username]);
        await dbRun("INSERT INTO racks (user_id, type_id, slots, room_idx) VALUES (?, 'r_small', 4, NULL)", [user.id]);

        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, message: "Nome de usuário já existe" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await dbGet("SELECT * FROM users WHERE username = ?", [username]);

        if (!user) return res.json({ success: false, message: "Usuário não encontrado" });

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.json({ success: false, message: "Senha inválida" });

        res.json({ success: true, username: user.username });
    } catch (e) {
        res.json({ success: false, message: "Erro no servidor" });
    }
});

app.get('/api/catalog', (req, res) => {
    res.json({
        catalog: CATALOG,
        room_costs: ECO.ROOM_COSTS,
        games: GAMES_BASE
    });
});

app.post('/api/status', async (req, res) => {
    try {
        const { username } = req.body;
        const uRaw = await dbGet("SELECT id FROM users WHERE username = ?", [username]);

        if (!uRaw) return res.json({ error: true });

        const data = await calculateUserData(uRaw.id);
        const global = await dbGet("SELECT network_power FROM global WHERE id = 1");
        const realNet = global.network_power + data.total;
        const share = realNet > 0 ? (data.total / realNet) : 0;

        const racks = await dbAll("SELECT * FROM racks WHERE user_id = ?", [uRaw.id]);
        const machines = await dbAll("SELECT * FROM machines WHERE user_id = ?", [uRaw.id]);

        res.json({
            balance: data.user.balance,
            total_power: data.total,
            network_power: realNet,
            estimated_reward: ECO.BLOCK_REWARD * share,
            electricity_expires_at: data.user.electricity_expires_at,
            server_time: Date.now(),
            machines: machines,
            racks: racks,
            batteries: data.user.inventory_batteries,
            rooms_unlocked: data.user.rooms_unlocked,
            free_recharge_available: (Date.now() - data.user.last_free_recharge > 86400000)
        });
    } catch (e) {
        res.json({ error: true });
    }
});

app.post('/api/game/start', async (req, res) => {
    const { username, game_id } = req.body;
    const user = await dbGet("SELECT id FROM users WHERE username = ?", [username]);

    if (!user || !GAMES_BASE[game_id]) return res.json({ success: false });

    const levelRow = await dbGet(
        "SELECT level, last_played FROM user_game_levels WHERE user_id = ? AND game_id = ?",
        [user.id, game_id]
    );

    if (levelRow) {
        const lvl = levelRow.level;
        const cooldownTime = (ECO.COOLDOWN_BASE + (lvl * ECO.COOLDOWN_PER_LEVEL)) * 1000;
        const timePassed = Date.now() - levelRow.last_played;

        if (timePassed < cooldownTime) {
            const wait = Math.ceil((cooldownTime - timePassed) / 1000);
            return res.json({ success: false, message: `Cooldown! ${wait}s` });
        }
    }

    const now = Date.now();
    const gameConfig = GAMES_BASE[game_id];
    const validUntil = now + (gameConfig.time * 1000) + 30000;

    await dbRun("DELETE FROM game_sessions WHERE user_id = ?", [user.id]);
    await dbRun(
        "INSERT INTO game_sessions (user_id, game_id, start_time, valid_until) VALUES (?, ?, ?, ?)",
        [user.id, game_id, now, validUntil]
    );

    res.json({ success: true, start_time: now });
});

app.post('/api/game/claim', async (req, res) => {
    const { username, score, game_id, won } = req.body;
    const user = await dbGet("SELECT id FROM users WHERE username = ?", [username]);

    if (!user) return res.json({ success: false });

    const session = await dbGet("SELECT * FROM game_sessions WHERE user_id = ?", [user.id]);
    if (!session || session.game_id !== game_id) return res.json({ success: false, message: "Sessão inválida." });

    const now = Date.now();
    const elapsedTime = (now - session.start_time) / 1000;

    if (!won) {
        await dbRun("DELETE FROM game_sessions WHERE user_id = ?", [user.id]);
        return res.json({ success: false, message: "Game Over" });
    }

    if (elapsedTime < ECO.MIN_GAME_DURATION_TOLERANCE) {
        await dbRun("DELETE FROM game_sessions WHERE user_id = ?", [user.id]);
        return res.json({ success: false, message: "Speedhack." });
    }

    const gameConfig = GAMES_BASE[game_id];
    const levelRow = await dbGet(
        "SELECT level FROM user_game_levels WHERE user_id = ? AND game_id = ?",
        [user.id, game_id]
    );

    let lvl = levelRow ? levelRow.level : 1;

    if (gameConfig.base_target) {
        const requiredScore = gameConfig.base_target + ((lvl - 1) * gameConfig.target_step);
        if (score < requiredScore) {
            await dbRun("DELETE FROM game_sessions WHERE user_id = ?", [user.id]);
            return res.json({ success: false, message: `Score insuficiente.` });
        }
    }

    const reward = Math.floor(gameConfig.reward * Math.pow(gameConfig.diff_mult, lvl - 1));

    await dbRun(
        "INSERT INTO game_power (user_id, amount, expires_at) VALUES (?, ?, ?)",
        [user.id, reward, Date.now() + ECO.GAME_POWER_DURATION]
    );

    let drop = Math.random() < ECO.BATTERY_DROP_CHANCE;
    if (drop) await dbRun(
        "UPDATE users SET inventory_batteries = inventory_batteries + 1 WHERE id = ?",
        [user.id]
    );

    let newLvl = Math.min(lvl + 1, ECO.MAX_GAME_LEVEL);
    await dbRun(
        `INSERT INTO user_game_levels (user_id, game_id, level, last_played) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, game_id) DO UPDATE SET level = ?, last_played = ?`,
        [user.id, game_id, newLvl, now, newLvl, now]
    );

    await dbRun("DELETE FROM game_sessions WHERE user_id = ?", [user.id]);

    res.json({
        success: true,
        reward,
        battery: drop,
        level: newLvl
    });
});

app.post('/api/game-levels', async (req, res) => {
    const { username } = req.body;
    const user = await dbGet("SELECT id FROM users WHERE username = ?", [username]);

    if (!user) return res.json({});

    const rows = await dbAll(
        "SELECT game_id, level, last_played FROM user_game_levels WHERE user_id = ?",
        [user.id]
    );

    const data = {};
    rows.forEach(r => {
        data[r.game_id] = {
            level: r.level,
            last_played: r.last_played
        };
    });

    res.json(data);
});

app.post('/api/buy', async (req, res) => {
    const { username, item_id, type } = req.body;
    const user = await dbGet("SELECT * FROM users WHERE username = ?", [username]);

    let item = type === 'miner' ?
        CATALOG.miners.find(x => x.id === item_id) :
        CATALOG.racks.find(x => x.id === item_id);

    if (!item || user.balance < item.cost) return res.json({ success: false, message: "Saldo insuficiente" });

    await dbRun("UPDATE users SET balance = balance - ? WHERE id = ?", [item.cost, user.id]);

    if (type === 'rack')
        await dbRun(
            "INSERT INTO racks (user_id, type_id, slots, room_idx) VALUES (?, ?, ?, NULL)",
            [user.id, item.id, item.slots]
        );
    else
        await dbRun(
            "INSERT INTO machines (user_id, type_id, rack_id, position) VALUES (?, ?, NULL, NULL)",
            [user.id, item.id]
        );

    res.json({ success: true });
});

app.post('/api/buy-room', async (req, res) => {
    const { username } = req.body;
    const user = await dbGet("SELECT * FROM users WHERE username = ?", [username]);

    if (user.rooms_unlocked >= 5) return res.json({ success: false, message: "Máximo de salas alcançado" });

    const nextRoomIdx = user.rooms_unlocked;
    const cost = ECO.ROOM_COSTS[nextRoomIdx];

    if (user.balance < cost) return res.json({ success: false, message: "Saldo insuficiente" });

    await dbRun(
        "UPDATE users SET balance=balance-?, rooms_unlocked=rooms_unlocked+1 WHERE id=?",
        [cost, user.id]
    );

    res.json({ success: true });
});

app.post('/api/place-rack', async (req, res) => {
    const { username, rack_id, room_idx } = req.body;
    const user = await dbGet("SELECT id, rooms_unlocked FROM users WHERE username = ?", [username]);

    if (room_idx >= user.rooms_unlocked) return res.json({ success: false, message: "Sala bloqueada" });

    const row = await dbGet(
        "SELECT COUNT(*) as count FROM racks WHERE user_id = ? AND room_idx = ?",
        [user.id, room_idx]
    );

    if (row.count >= 12) return res.json({ success: false, message: "Sala cheia" });

    await dbRun("UPDATE racks SET room_idx = ? WHERE id = ?", [room_idx, rack_id]);

    res.json({ success: true });
});

app.post('/api/equip', async (req, res) => {
    const { username, machine_id, rack_id, position } = req.body;
    const user = await dbGet("SELECT id FROM users WHERE username = ?", [username]);

    await dbRun(
        "UPDATE machines SET rack_id = ?, position = ? WHERE id = ? AND user_id = ?",
        [rack_id, position, machine_id, user.id]
    );

    res.json({ success: true });
});

app.post('/api/unequip', async (req, res) => {
    const { username, machine_id } = req.body;
    const user = await dbGet("SELECT id FROM users WHERE username = ?", [username]);

    await dbRun(
        "UPDATE machines SET rack_id = NULL, position = NULL WHERE id = ? AND user_id = ?",
        [machine_id, user.id]
    );

    res.json({ success: true });
});

app.post('/api/recharge', async (req, res) => {
    const { username, type } = req.body;
    const user = await dbGet("SELECT * FROM users WHERE username = ?", [username]);

    const now = Date.now();
    let expiry = Math.max(user.electricity_expires_at, now);
    let newExp = Math.min(
        expiry + ECO.ONE_BAR_DURATION,
        now + (ECO.MAX_BARS * ECO.ONE_BAR_DURATION)
    );

    if (type === 'free') {
        if (now - user.last_free_recharge < 86400000) return res.json({ success: false, message: "Aguarde 24h" });
        await dbRun(
            "UPDATE users SET electricity_expires_at=?, last_free_recharge=? WHERE id=?",
            [newExp, now, user.id]
        );
    } else {
        if (user.inventory_batteries < 1) return res.json({ success: false, message: "Sem baterias" });
        await dbRun(
            "UPDATE users SET electricity_expires_at=?, inventory_batteries=inventory_batteries-1 WHERE id=?",
            [newExp, user.id]
        );
    }

    res.json({ success: true });
});

app.post('/api/mine', async (req, res) => {
    const { username } = req.body;
    const user = await dbGet("SELECT id, last_mine_time FROM users WHERE username = ?", [username]);

    if (!user) return res.json({ success: false });

    const now = Date.now();
    if (now - user.last_mine_time < 9000) return res.json({ success: true });

    const data = await calculateUserData(user.id);
    if (data.total <= 0) return res.json({ success: true });

    const global = await dbGet("SELECT network_power FROM global WHERE id = 1");
    const totalNet = global.network_power + data.total;
    const share = data.total / totalNet;
    const reward = ECO.BLOCK_REWARD * share;

    await dbRun(
        "UPDATE users SET balance = balance + ?, last_mine_time = ? WHERE id = ?",
        [reward, now, user.id]
    );

    await dbRun("UPDATE global SET network_power = network_power + ?", [ECO.NETWORK_GROWTH_RATE]);

    res.json({ success: true });
});

// Rota para verificar a saúde do servidor
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));