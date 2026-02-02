// ===========================================
// UI MANAGER - Gerenciador de interface
// ===========================================

import { formatPower, updateEnergyTimer, calculateEstimatedReward } from './mining.js';

/**
 * Inicializa a UI
 */
export function initUI() {
    console.log('🎨 Inicializando UI...');
    
    // Configurar atualização periódica do timer de energia
    setInterval(updateEnergyDisplay, 1000);
    
    // Inicializar componentes
    initRoomGrid();
    initInventoryTabs();
    initStoreTabs();
    
    console.log('✅ UI inicializada');
}

/**
 * Atualiza a UI com os dados do usuário
 */
export function updateUI(data) {
    if (!data) return;
    
    // Atualizar informações básicas
    updateBasicInfo(data);
    
    // Atualizar sala de mineração
    updateMiningRoom(data);
    
    // Atualizar inventário
    updateInventoryDisplay(data);
    
    // Atualizar estatísticas
    updateStats(data);
}

/**
 * Atualiza informações básicas
 */
function updateBasicInfo(data) {
    // Saldo
    const balanceElement = document.getElementById('balance');
    if (balanceElement) {
        balanceElement.textContent = `${data.balance.toFixed(2)} CMA`;
    }
    
    // Poder total
    const powerElement = document.getElementById('power');
    if (powerElement) {
        powerElement.textContent = formatPower(data.total_power || 0);
    }
    
    // Poder da rede
    const networkPowerElement = document.getElementById('network-power');
    if (networkPowerElement) {
        networkPowerElement.textContent = formatPower(data.network_power || 0);
    }
    
    // Baterias
    const batteryElement = document.getElementById('battery-count');
    if (batteryElement) {
        batteryElement.textContent = data.batteries || 0;
    }
    
    // Nível do usuário
    const levelElement = document.getElementById('user-level');
    if (levelElement) {
        levelElement.textContent = data.level || 1;
    }
    
    // Nome da sala
    const roomNameElement = document.getElementById('room-name');
    if (roomNameElement) {
        roomNameElement.textContent = `SALA ${window.CURRENT_ROOM_IDX + 1}`;
    }
}

/**
 * Atualiza display de energia
 */
function updateEnergyDisplay() {
    if (!window.USER_DATA?.electricity_expires_at) return;
    
    const timerElement = document.getElementById('energy-timer');
    if (timerElement) {
        timerElement.textContent = updateEnergyTimer(window.USER_DATA.electricity_expires_at);
    }
    
    // Atualizar barras de energia
    updateEnergyBars();
}

/**
 * Atualiza barras de energia
 */
function updateEnergyBars() {
    if (!window.USER_DATA?.electricity_expires_at) return;
    
    const now = Date.now();
    const expiresAt = window.USER_DATA.electricity_expires_at;
    const totalDuration = 24 * 60 * 60 * 1000; // 24 horas em ms
    const timeLeft = expiresAt - now;
    
    // Calcular porcentagem
    let percentage = (timeLeft / totalDuration) * 100;
    percentage = Math.max(0, Math.min(100, percentage));
    
    // Atualizar elementos visuais (simplificado)
    // Em uma implementação completa, atualizaria as 4 barras individuais
}

/**
 * Inicializa a grade da sala
 */
function initRoomGrid() {
    const roomContainer = document.getElementById('room-container');
    if (!roomContainer) return;
    
    // Criar 12 slots (4x3 grid)
    roomContainer.innerHTML = '';
    
    for (let i = 0; i < 12; i++) {
        const slot = document.createElement('div');
        slot.className = 'room-slot';
        slot.dataset.slotIndex = i;
        slot.innerHTML = `
            <div class="slot-placeholder">
                <i class="fa-solid fa-plus"></i>
            </div>
        `;
        
        slot.addEventListener('click', () => {
            openRackPlacement(i);
        });
        
        roomContainer.appendChild(slot);
    }
}

/**
 * Abre modal para colocar rack
 */
function openRackPlacement(slotIndex) {
    console.log('Abrir placement para slot:', slotIndex);
    // Implementar modal de colocação de rack
}

/**
 * Atualiza a sala de mineração
 */
function updateMiningRoom(data) {
    if (!data.racks || !data.machines) return;
    
    // Filtrar racks da sala atual
    const roomRacks = data.racks.filter(rack => 
        rack.room_idx === window.CURRENT_ROOM_IDX
    );
    
    // Atualizar contadores
    const installedRacks = document.getElementById('installed-racks');
    const freeSlots = document.getElementById('free-slots');
    
    if (installedRacks) {
        installedRacks.textContent = `${roomRacks.length}/12`;
    }
    
    if (freeSlots) {
        const occupiedSlots = roomRacks.reduce((total, rack) => {
            return total + (rack.slots || 0);
        }, 0);
        const totalSlots = 12 * 4; // 12 racks com 4 slots cada (máximo)
        freeSlots.textContent = `${totalSlots - occupiedSlots} slots`;
    }
    
    // Em uma implementação completa, renderizaria os racks e mineradores
}

/**
 * Inicializa abas do inventário
 */
function initInventoryTabs() {
    const tabs = document.querySelectorAll('.inv-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabType = tab.dataset.tab;
            switchInventoryTab(tabType);
        });
    });
}

/**
 * Muda aba do inventário
 */
function switchInventoryTab(tabType) {
    // Remover active de todas as abas
    document.querySelectorAll('.inv-tab').forEach(t => {
        t.classList.remove('active');
    });
    
    // Adicionar active na aba clicada
    const activeTab = document.querySelector(`.inv-tab[data-tab="${tabType}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Atualizar conteúdo do inventário
    updateInventoryDisplay(window.USER_DATA, tabType);
}

/**
 * Atualiza display do inventário
 */
function updateInventoryDisplay(data, tabType = 'miners') {
    if (!data) return;
    
    const invList = document.getElementById('quick-inventory');
    if (!invList) return;
    
    invList.innerHTML = '';
    
    if (tabType === 'miners') {
        // Mostrar mineradores não equipados
        const unequippedMiners = data.machines?.filter(m => !m.rack_id) || [];
        
        if (unequippedMiners.length === 0) {
            invList.innerHTML = '<div class="empty-inventory">Nenhum minerador no inventário</div>';
            return;
        }
        
        unequippedMiners.forEach(miner => {
            const minerType = window.CATALOG?.miners?.find(m => m.id === miner.type_id);
            if (!minerType) return;
            
            const item = document.createElement('div');
            item.className = 'inv-item';
            item.innerHTML = `
                <div class="inv-icon">
                    <i class="fa-solid fa-microchip"></i>
                </div>
                <div class="inv-name">${minerType.name}</div>
                <div class="inv-power">${formatPower(minerType.power)}</div>
            `;
            
            invList.appendChild(item);
        });
        
    } else if (tabType === 'racks') {
        // Mostrar racks não colocados
        const unequippedRacks = data.racks?.filter(r => r.room_idx === null) || [];
        
        if (unequippedRacks.length === 0) {
            invList.innerHTML = '<div class="empty-inventory">Nenhum rack no inventário</div>';
            return;
        }
        
        unequippedRacks.forEach(rack => {
            const rackType = window.CATALOG?.racks?.find(r => r.id === rack.type_id);
            if (!rackType) return;
            
            const item = document.createElement('div');
            item.className = 'inv-item';
            item.innerHTML = `
                <div class="inv-icon">
                    <i class="fa-solid fa-server"></i>
                </div>
                <div class="inv-name">${rackType.name}</div>
                <div class="inv-slots">${rackType.slots} slots</div>
            `;
            
            invList.appendChild(item);
        });
    }
}

/**
 * Inicializa abas da loja
 */
function initStoreTabs() {
    const categories = document.querySelectorAll('.store-category');
    categories.forEach(cat => {
        cat.addEventListener('click', () => {
            const category = cat.dataset.category;
            switchStoreCategory(category);
        });
    });
}

/**
 * Muda categoria da loja
 */
function switchStoreCategory(category) {
    // Remover active de todas as categorias
    document.querySelectorAll('.store-category').forEach(c => {
        c.classList.remove('active');
    });
    
    // Adicionar active na categoria clicada
    const activeCat = document.querySelector(`.store-category[data-category="${category}"]`);
    if (activeCat) {
        activeCat.classList.add('active');
    }
    
    // Notificar o store.js para renderizar a categoria
    if (window.renderStore) {
        window.renderStore(category);
    }
}

/**
 * Atualiza estatísticas
 */
function updateStats(data) {
    // Atualizar recompensa estimada
    const rewardElement = document.getElementById('estimated-reward');
    if (rewardElement) {
        const estimated = calculateEstimatedReward(data.total_power, data.network_power);
        rewardElement.textContent = `${estimated} CMA/h`;
    }
    
    // Atualizar eficiência da sala
    const efficiencyElement = document.getElementById('room-efficiency');
    if (efficiencyElement) {
        // Cálculo simplificado da eficiência
        const roomRacks = data.racks?.filter(r => r.room_idx === window.CURRENT_ROOM_IDX) || [];
        const totalSlots = roomRacks.reduce((sum, rack) => sum + (rack.slots || 0), 0);
        const usedSlots = data.machines?.filter(m => {
            const rack = roomRacks.find(r => r.id === m.rack_id);
            return rack !== undefined;
        }).length || 0;
        
        const efficiency = totalSlots > 0 ? (usedSlots / totalSlots) * 100 : 0;
        efficiencyElement.textContent = `${efficiency.toFixed(0)}%`;
    }
}

// Exportar para uso global
window.initUI = initUI;
window.updateUI = updateUI;

console.log('✅ ui-manager.js carregado');