import { apiCall } from './api.js';
import { renderItemSprite } from './utils.js';

let CURRENT_INV_TAB = 'miner';

export function initInventory() {
    // Event listeners para tabs
    document.getElementById('tab-miner')?.addEventListener('click', () => setInvTab('miner'));
    document.getElementById('tab-rack')?.addEventListener('click', () => setInvTab('rack'));
}

export function setInvTab(tab) {
    CURRENT_INV_TAB = tab;
    const tabMiner = document.getElementById('tab-miner');
    const tabRack = document.getElementById('tab-rack');
    
    if (tabMiner) tabMiner.className = tab === 'miner' ? 'active' : '';
    if (tabRack) tabRack.className = tab === 'rack' ? 'active' : '';
    
    if (window.USER_DATA) {
        renderInventory(window.USER_DATA.machines, window.USER_DATA.racks);
    }
}

export function renderInventory(machines, racks) {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    
    list.innerHTML = '';

    if (CURRENT_INV_TAB === 'miner') {
        const inventoryMiners = machines.filter(m => m.rack_id === null);
        if (inventoryMiners.length === 0) {
            list.innerHTML = '<span style="color:#444; font-size:10px; padding:10px;">No miners in inventory</span>';
            return;
        }

        inventoryMiners.forEach(m => {
            const item = window.CATALOG.miners?.find(x => x.id === m.type_id);
            if (!item) return;

            const el = document.createElement('div');
            el.className = 'inv-item';
            el.dataset.id = m.id;
            el.dataset.type = 'miner';
            
            el.innerHTML = `
                <div class="inv-item-icon" style="width:40px; height:40px; margin:0 auto 5px;">
                    <canvas width="40" height="40" data-style="${item.style}"></canvas>
                </div>
                <div class="inv-item-name">${item.name}</div>
                <div class="inv-item-stats">
                    <small>${item.power} GH/s</small>
                    <small>${item.size} slot(s)</small>
                </div>
            `;
            
            el.addEventListener('click', () => selectInventoryItem(m.id, 'miner'));
            list.appendChild(el);
        });
    } else {
        const inventoryRacks = racks.filter(r => r.room_idx === null);
        if (inventoryRacks.length === 0) {
            list.innerHTML = '<span style="color:#444; font-size:10px; padding:10px;">No racks in inventory</span>';
            return;
        }

        inventoryRacks.forEach(r => {
            const item = window.CATALOG.racks?.find(x => x.id === r.type_id);
            if (!item) return;

            const el = document.createElement('div');
            el.className = 'inv-item';
            el.dataset.id = r.id;
            el.dataset.type = 'rack';
            
            el.innerHTML = `
                <div class="inv-item-icon" style="width:40px; height:40px; margin:0 auto 5px; border:2px solid #8B4513; background:#3e2723;"></div>
                <div class="inv-item-name">${item.name}</div>
                <div class="inv-item-stats">
                    <small>${item.slots} slots</small>
                </div>
            `;
            
            el.addEventListener('click', () => selectInventoryItem(r.id, 'rack'));
            list.appendChild(el);
        });
    }
}

function selectInventoryItem(id, type) {
    // Implementar seleção de item para equipar
    console.log('Selected:', id, type);
}