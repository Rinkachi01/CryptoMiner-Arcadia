// ===========================================
// INVENTORY MODULE - Sistema de inventário
// ===========================================

import { apiCall, placeRack, equipMiner } from './api.js';

let currentInvTab = 'machines';

/**
 * Inicializa o inventário
 */
export function initInventory() {
    console.log('🎒 Inicializando inventário...');
    
    // Configurar event listeners
    setupInventoryEventListeners();
    
    console.log('✅ Inventário inicializado');
}

/**
 * Renderiza o inventário
 */
export function renderInventory() {
    if (!window.USER_DATA) return;
    
    const machinesList = document.getElementById('inventory-machines');
    const racksList = document.getElementById('inventory-racks');
    
    if (!machinesList || !racksList) return;
    
    // Renderizar mineradores
    const unequippedMiners = window.USER_DATA.machines?.filter(m => !m.rack_id) || [];
    renderMinersList(machinesList, unequippedMiners);
    
    // Renderizar racks
    const unequippedRacks = window.USER_DATA.racks?.filter(r => r.room_idx === null) || [];
    renderRacksList(racksList, unequippedRacks);
}

/**
 * Renderiza lista de mineradores
 */
function renderMinersList(container, miners) {
    container.innerHTML = '';
    
    if (miners.length === 0) {
        container.innerHTML = `
            <div class="empty-inventory">
                <i class="fa-solid fa-microchip"></i>
                <p>Nenhum minerador no inventário</p>
            </div>
        `;
        return;
    }
    
    miners.forEach(miner => {
        const minerType = window.CATALOG?.miners?.find(m => m.id === miner.type_id);
        if (!minerType) return;
        
        const item = document.createElement('div');
        item.className = 'inv-item';
        item.dataset.id = miner.id;
        item.dataset.type = 'miner';
        
        item.innerHTML = `
            <div class="inv-icon" style="background: ${getMinerColor(minerType.style)}">
                <i class="${getMinerIcon(minerType.style)}"></i>
            </div>
            <div class="inv-info">
                <div class="inv-name">${minerType.name}</div>
                <div class="inv-stats">
                    <span><i class="fa-solid fa-bolt"></i> ${minerType.power} GH/s</span>
                    <span><i class="fa-solid fa-plug"></i> ${minerType.watts}W</span>
                </div>
            </div>
            <button class="btn-equip" data-id="${miner.id}">
                <i class="fa-solid fa-plus"></i> Equipar
            </button>
        `;
        
        container.appendChild(item);
    });
    
    // Adicionar event listeners aos botões
    container.querySelectorAll('.btn-equip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const minerId = e.target.closest('.btn-equip').dataset.id;
            openMinerPlacement(minerId);
        });
    });
}

/**
 * Renderiza lista de racks
 */
function renderRacksList(container, racks) {
    container.innerHTML = '';
    
    if (racks.length === 0) {
        container.innerHTML = `
            <div class="empty-inventory">
                <i class="fa-solid fa-server"></i>
                <p>Nenhum rack no inventário</p>
            </div>
        `;
        return;
    }
    
    racks.forEach(rack => {
        const rackType = window.CATALOG?.racks?.find(r => r.id === rack.type_id);
        if (!rackType) return;
        
        const item = document.createElement('div');
        item.className = 'inv-item';
        item.dataset.id = rack.id;
        item.dataset.type = 'rack';
        
        item.innerHTML = `
            <div class="inv-icon" style="background: ${getRackColor(rackType.style)}">
                <i class="fa-solid fa-server"></i>
            </div>
            <div class="inv-info">
                <div class="inv-name">${rackType.name}</div>
                <div class="inv-stats">
                    <span><i class="fa-solid fa-layer-group"></i> ${rackType.slots} slots</span>
                    <span><i class="fa-solid fa-cube"></i> ${rackType.size || 'Médio'}</span>
                </div>
            </div>
            <button class="btn-place" data-id="${rack.id}">
                <i class="fa-solid fa-plus"></i> Colocar
            </button>
        `;
        
        container.appendChild(item);
    });
    
    // Adicionar event listeners aos botões
    container.querySelectorAll('.btn-place').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const rackId = e.target.closest('.btn-place').dataset.id;
            openRackPlacementModal(rackId);
        });
    });
}

/**
 * Obtém ícone do minerador baseado no estilo
 */
function getMinerIcon(style) {
    switch(style) {
        case 'STARTER': return 'fa-solid fa-fan';
        case 'FAN': return 'fa-solid fa-wind';
        case 'GT730': return 'fa-solid fa-desktop';
        case 'GTX1060': return 'fa-solid fa-tachometer-alt';
        case 'RTX3060': return 'fa-solid fa-bolt';
        case 'DUAL': return 'fa-solid fa-server';
        case 'ASIC': return 'fa-solid fa-cogs';
        case 'QUANTUM': return 'fa-solid fa-atom';
        default: return 'fa-solid fa-microchip';
    }
}

/**
 * Obtém cor do minerador baseado no estilo
 */
function getMinerColor(style) {
    switch(style) {
        case 'STARTER': return 'linear-gradient(135deg, #667eea, #764ba2)';
        case 'FAN': return 'linear-gradient(135deg, #f093fb, #f5576c)';
        case 'GT730': return 'linear-gradient(135deg, #4facfe, #00f2fe)';
        case 'GTX1060': return 'linear-gradient(135deg, #43e97b, #38f9d7)';
        case 'RTX3060': return 'linear-gradient(135deg, #fa709a, #fee140)';
        case 'DUAL': return 'linear-gradient(135deg, #30cfd0, #330867)';
        case 'ASIC': return 'linear-gradient(135deg, #a3bded, #6991c7)';
        case 'QUANTUM': return 'linear-gradient(135deg, #00ffff, #9d00ff)';
        default: return 'linear-gradient(135deg, #667eea, #764ba2)';
    }
}

/**
 * Obtém cor do rack baseado no estilo
 */
function getRackColor(style) {
    switch(style) {
        case 'wood': return 'linear-gradient(135deg, #8B4513, #A0522D)';
        case 'metal': return 'linear-gradient(135deg, #708090, #2F4F4F)';
        case 'industrial': return 'linear-gradient(135deg, #36454F, #2C3E50)';
        case 'server': return 'linear-gradient(135deg, #1a1a1a, #333333)';
        default: return 'linear-gradient(135deg, #667eea, #764ba2)';
    }
}

/**
 * Abre modal para colocar rack
 */
function openRackPlacementModal(rackId) {
    // Implementar modal de colocação de rack
    console.log('Abrir colocação de rack:', rackId);
    
    // Por enquanto, apenas mostrar mensagem
    if (window.showNotification) {
        window.showNotification(
            '🏗️ Colocar Rack',
            'Selecione uma posição na sala para colocar o rack.',
            'info'
        );
    }
}

/**
 * Abre modal para equipar minerador
 */
function openMinerPlacement(minerId) {
    // Implementar modal de equipamento de minerador
    console.log('Abrir equipamento de minerador:', minerId);
    
    // Por enquanto, apenas mostrar mensagem
    if (window.showNotification) {
        window.showNotification(
            '🔧 Equipar Minerador',
            'Selecione um rack e slot para equipar o minerador.',
            'info'
        );
    }
}

/**
 * Configura event listeners do inventário
 */
function setupInventoryEventListeners() {
    // Tabs do inventário
    document.querySelectorAll('.inv-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabType = e.target.dataset.tab;
            switchInventoryTab(tabType);
        });
    });
}

/**
 * Muda a aba do inventário
 */
function switchInventoryTab(tabType) {
    currentInvTab = tabType;
    
    // Atualizar tabs ativas
    document.querySelectorAll('.inv-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabType);
    });
    
    // Mostrar/ocultar listas
    document.querySelectorAll('.inv-list').forEach(list => {
        list.classList.toggle('active', list.id === `inventory-${tabType}`);
    });
    
    // Atualizar conteúdo
    renderInventory();
}

// Exportar para uso global
window.initInventory = initInventory;
window.renderInventory = renderInventory;

console.log('✅ inventory.js carregado');