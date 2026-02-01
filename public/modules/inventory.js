// modules/inventory.js - Sistema de inventário
import { apiCall } from './api.js';

let currentInvTab = 'miner';

export function initInventory() {
    // Configurar tabs do inventário
    document.getElementById('tab-miner')?.addEventListener('click', () => setInvTab('miner'));
    document.getElementById('tab-rack')?.addEventListener('click', () => setInvTab('rack'));
}

export function setInvTab(tab) {
    currentInvTab = tab;
    renderInventory();
}

export function renderInventory() {
    const list = document.getElementById('inventory-list');
    if (!list || !window.USER_DATA) return;

    list.innerHTML = '';

    if (currentInvTab === 'miner') {
        const miners = window.USER_DATA.machines.filter(m => !m.rack_id);
        
        if (miners.length === 0) {
            list.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No miners in inventory</div>';
            return;
        }

        miners.forEach(machine => {
            const minerType = window.CATALOG.miners.find(m => m.id === machine.type_id);
            if (!minerType) return;

            const item = document.createElement('div');
            item.className = 'inv-item';
            item.dataset.id = machine.id;
            
            item.innerHTML = `
                <div class="inv-icon" style="
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 8px;
                    margin: 0 auto 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                ">
                    <i class="fa-solid fa-microchip"></i>
                </div>
                <div class="inv-name">${minerType.name}</div>
                <div class="inv-stats">
                    <small>${minerType.power} GH/s</small>
                    <small>${minerType.size} slot(s)</small>
                </div>
                <button class="btn-equip" data-id="${machine.id}" style="
                    margin-top: 5px;
                    padding: 3px 8px;
                    font-size: 8px;
                    background: var(--cyan);
                    color: #000;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                ">
                    EQUIPAR
                </button>
            `;

            list.appendChild(item);
        });
    } else {
        const racks = window.USER_DATA.racks.filter(r => r.room_idx === null);
        
        if (racks.length === 0) {
            list.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No racks in inventory</div>';
            return;
        }

        racks.forEach(rack => {
            const rackType = window.CATALOG.racks.find(r => r.id === rack.type_id);
            if (!rackType) return;

            const item = document.createElement('div');
            item.className = 'inv-item';
            item.dataset.id = rack.id;
            
            item.innerHTML = `
                <div class="inv-icon" style="
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    border-radius: 8px;
                    margin: 0 auto 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                ">
                    <i class="fa-solid fa-server"></i>
                </div>
                <div class="inv-name">${rackType.name}</div>
                <div class="inv-stats">
                    <small>${rackType.slots} slots</small>
                </div>
                <button class="btn-place" data-id="${rack.id}" style="
                    margin-top: 5px;
                    padding: 3px 8px;
                    font-size: 8px;
                    background: var(--neon-green);
                    color: #000;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                ">
                    COLOCAR
                </button>
            `;

            list.appendChild(item);
        });
    }

    // Adicionar event listeners
    document.querySelectorAll('.btn-equip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const machineId = e.target.dataset.id;
            equipMachine(machineId);
        });
    });

    document.querySelectorAll('.btn-place').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const rackId = e.target.dataset.id;
            placeRack(rackId);
        });
    });
}

async function equipMachine(machineId) {
    // Aqui você implementaria a lógica para equipar a máquina em um rack
    alert(`Equipar máquina ${machineId}`);
    // Implementar a seleção de rack e slot
}

async function placeRack(rackId) {
    // Aqui você implementaria a lógica para colocar o rack em uma sala
    alert(`Colocar rack ${rackId}`);
    // Implementar a seleção de sala
}

// Exportar para uso global
window.setInvTab = setInvTab;
window.renderInventory = renderInventory;