// modules/ui-manager.js - Gerenciador de UI
import { COIN_IMAGES, getCoinHTML } from './image-manager.js';

e// modules/ui-manager.js - Sistema de Sala de Mineração
export function initUI() {
    setupRoomNavigation();
    setupDragAndDrop();
    updateUserDisplay();
}

export function updateUI(data) {
    if (!data) return;
    
    // Atualizar dados do usuário
    document.getElementById('balance').textContent = data.balance.toFixed(2) + ' CMA';
    document.getElementById('total-power').textContent = formatPower(data.total_power);
    document.getElementById('network-power').textContent = formatPower(data.network_power);
    document.getElementById('estimated-reward').textContent = data.estimated_reward.toFixed(4) + ' CMA';
    document.getElementById('battery-count').textContent = data.batteries;
    document.getElementById('rooms-unlocked').textContent = data.rooms_unlocked;
    
    // Atualizar energia
    updateEnergyBars(data.electricity_expires_at, data.server_time);
    
    // Renderizar sala atual
    renderRoom(window.CURRENT_ROOM_IDX, data.racks, data.machines);
    
    // Atualizar inventário
    updateInventory(data.machines.filter(m => !m.rack_id), 
                   data.racks.filter(r => r.room_idx === null));
}

function formatPower(power) {
    if (power >= 1000000) return (power / 1000000).toFixed(1) + ' MH/s';
    if (power >= 1000) return (power / 1000).toFixed(1) + ' kH/s';
    return power + ' H/s';
}

function setupRoomNavigation() {
    document.getElementById('room-prev').addEventListener('click', () => {
        if (window.CURRENT_ROOM_IDX > 0) {
            window.CURRENT_ROOM_IDX--;
            updateData();
        }
    });
    
    document.getElementById('room-next').addEventListener('click', () => {
        const maxRooms = window.USER_DATA?.rooms_unlocked || 1;
        if (window.CURRENT_ROOM_IDX < maxRooms - 1) {
            window.CURRENT_ROOM_IDX++;
            updateData();
        } else {
            alert('Sala bloqueada. Compre uma expansão na loja!');
        }
    });
}

function renderRoom(roomIdx, racks, machines) {
    const roomContainer = document.getElementById('room-container');
    if (!roomContainer) return;
    
    roomContainer.innerHTML = '';
    
    // Racks nesta sala
    const roomRacks = racks.filter(r => r.room_idx === roomIdx);
    
    // Criar grid 4x3
    for (let i = 0; i < 12; i++) {
        const slot = document.createElement('div');
        slot.className = 'room-slot';
        slot.dataset.slotIndex = i;
        
        // Verificar se tem rack neste slot
        const rack = roomRacks[i];
        if (rack) {
            const rackElement = createRackElement(rack, machines);
            slot.appendChild(rackElement);
        } else {
            slot.innerHTML = '<div class="slot-placeholder">+</div>';
            slot.addEventListener('click', () => openRackPlacement(i));
        }
        
        roomContainer.appendChild(slot);
    }
}

function createRackElement(rack, machines) {
    const rackElement = document.createElement('div');
    rackElement.className = `rack rack-${rack.type_id === 'r_small' ? 'small' : 'large'} ${rack.type_id === 'r_small' ? 'rack-wood' : 'rack-metal'}`;
    rackElement.dataset.rackId = rack.id;
    
    // Slots do rack
    const slots = rack.type_id === 'r_small' ? 4 : 8;
    for (let i = 0; i < slots; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.slotIndex = i;
        slot.dataset.rackId = rack.id;
        
        // Verificar máquina
        const machine = machines.find(m => m.rack_id === rack.id && m.position === i);
        if (machine) {
            const miner = window.CATALOG?.miners?.find(m => m.id === machine.type_id);
            if (miner) {
                slot.innerHTML = createMinerHTML(miner);
                slot.dataset.machineId = machine.id;
            }
        }
        
        slot.addEventListener('click', (e) => {
            e.stopPropagation();
            if (machine) {
                openMachineMenu(machine.id, rack.id, i);
            } else {
                openMachinePlacement(rack.id, i);
            }
        });
        
        rackElement.appendChild(slot);
    }
    
    return rackElement;
}

function createMinerHTML(miner) {
    let icon = 'fa-microchip';
    let animation = 'miner-gpu';
    
    switch(miner.style) {
        case 'STARTER': icon = 'fa-fan'; animation = 'miner-fan'; break;
        case 'GT730': icon = 'fa-desktop'; animation = 'miner-gpu'; break;
        case 'GTX1060': icon = 'fa-tachometer-alt'; animation = 'miner-gpu'; break;
        case 'RTX3060': icon = 'fa-bolt'; animation = 'miner-gpu'; break;
        case 'DUAL': icon = 'fa-server'; animation = 'miner-gpu'; break;
        case 'ASIC': icon = 'fa-cogs'; animation = 'miner-asic'; break;
        case 'QUANTUM': icon = 'fa-atom'; animation = 'miner-quantum'; break;
    }
    
    return `
        <div class="miner ${animation}">
            <div class="miner-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="miner-name">${miner.name}</div>
        </div>
    `;
}

function updateEnergyBars(expiresAt, serverTime) {
    const now = serverTime || Date.now();
    const totalDuration = ECO.MAX_BARS * ECO.ONE_BAR_DURATION;
    const timeLeft = expiresAt - now;
    
    // Calcular barras cheias
    const fullBars = Math.floor(timeLeft / ECO.ONE_BAR_DURATION);
    const partialBar = (timeLeft % ECO.ONE_BAR_DURATION) / ECO.ONE_BAR_DURATION;
    
    const barsContainer = document.getElementById('energy-bars');
    if (!barsContainer) return;
    
    barsContainer.innerHTML = '';
    
    for (let i = 0; i < ECO.MAX_BARS; i++) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        
        if (i < fullBars) {
            bar.classList.add('active');
        } else if (i === fullBars && partialBar > 0) {
            bar.classList.add('active');
            bar.style.opacity = partialBar;
        }
        
        barsContainer.appendChild(bar);
    }
    
    // Atualizar contador
    const timerElement = document.getElementById('energy-timer');
    if (timerElement) {
        if (timeLeft > 0) {
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            timerElement.textContent = `${hours}h ${minutes}m`;
        } else {
            timerElement.textContent = 'Sem energia';
        }
    }
}

function updateInventory(machines, racks) {
    // Atualizar lista de máquinas no inventário (não equipadas)
    const invMachines = machines.filter(m => m.rack_id === null);
    const invList = document.getElementById('inventory-machines');
    if (invList) {
        invList.innerHTML = '';
        
        invMachines.forEach(machine => {
            const miner = window.CATALOG.miners.find(m => m.id === machine.type_id);
            if (miner) {
                const item = document.createElement('div');
                item.className = 'inv-item';
                item.dataset.machineId = machine.id;
                item.innerHTML = createMinerHTML(miner);
                invList.appendChild(item);
            }
        });
    }
    
    // Atualizar lista de racks no inventário (não equipados)
    const invRacks = racks.filter(r => r.room_idx === null);
    const rackList = document.getElementById('inventory-racks');
    if (rackList) {
        rackList.innerHTML = '';
        
        invRacks.forEach(rack => {
            const rackType = window.CATALOG.racks.find(r => r.id === rack.type_id);
            if (rackType) {
                const item = document.createElement('div');
                item.className = 'inv-item';
                item.dataset.rackId = rack.id;
                item.innerHTML = `
                    <div class="rack-icon" style="font-size: 30px; color: ${rackType.style === 'wood' ? '#8B4513' : '#808080'};">
                        <i class="fas fa-server"></i>
                    </div>
                    <div style="font-size: 10px;">${rackType.name}</div>
                `;
                rackList.appendChild(item);
            }
        });
    }
}

// Sistema completo de renderização da sala
export function renderRoom(roomIdx, racks, machines) {
    const roomContainer = document.getElementById('room-container');
    if (!roomContainer) return;
    
    roomContainer.innerHTML = '';
    
    // Criar grid 4x3 (12 slots)
    for (let i = 0; i < 12; i++) {
        const slot = document.createElement('div');
        slot.className = 'room-slot';
        slot.dataset.slotIndex = i;
        
        // Verificar se tem rack neste slot
        const rackInSlot = racks.find(r => r.room_idx === roomIdx && r.position === i);
        
        if (rackInSlot) {
            const rackElement = createRackElement(rackInSlot, machines);
            slot.appendChild(rackElement);
        } else {
            // Slot vazio - pode colocar rack
            slot.innerHTML = `
                <div class="empty-slot" onclick="openRackPlacement(${i})">
                    <i class="fas fa-plus"></i>
                    <span>Add Rack</span>
                </div>
            `;
        }
        
        roomContainer.appendChild(slot);
    }
}

function createRackElement(rack, machines) {
    const rackElement = document.createElement('div');
    rackElement.className = `rack ${rack.type_id === 'r_small' ? 'rack-small' : 'rack-large'}`;
    rackElement.dataset.rackId = rack.id;
    
    const slots = rack.type_id === 'r_small' ? 4 : 8;
    
    for (let i = 0; i < slots; i++) {
        const slot = document.createElement('div');
        slot.className = 'rack-slot';
        slot.dataset.slotIndex = i;
        
        // Verificar se tem máquina neste slot
        const machineInSlot = machines.find(m => 
            m.rack_id === rack.id && m.position === i
        );
        
        if (machineInSlot) {
            const miner = window.CATALOG.miners.find(m => m.id === machineInSlot.type_id);
            if (miner) {
                slot.innerHTML = createMinerHTML(miner);
                slot.title = `${miner.name} - ${miner.power} GH/s`;
            }
        } else {
            slot.innerHTML = '<div class="empty-miner-slot">+</div>';
            slot.onclick = () => openMachinePlacement(rack.id, i);
        }
        
        rackElement.appendChild(slot);
    }
    
    return rackElement;
}