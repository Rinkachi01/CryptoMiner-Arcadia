// modules/store.js - Sistema da loja
import { apiCall } from './api.js';

let currentStoreTab = 'miner';

export function initStore() {
    // Configurar tabs da loja
    document.querySelectorAll('.store-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            if (tabName) setStoreTab(tabName);
        });
    });
}

export function setStoreTab(tab) {
    currentStoreTab = tab;
    renderStore();
}

export function renderStore() {
    const storeList = document.getElementById('store-list');
    if (!storeList || !window.CATALOG) return;

    storeList.innerHTML = '';

    const items = currentStoreTab === 'miner' ? window.CATALOG.miners : window.CATALOG.racks;

    items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'store-item';
        
        itemElement.innerHTML = `
            <div class="store-icon">
                <i class="fa-solid ${currentStoreTab === 'miner' ? 'fa-microchip' : 'fa-server'}"></i>
            </div>
            <div class="store-name">${item.name}</div>
            <div class="store-stats">
                ${currentStoreTab === 'miner' ? 
                    `<div><small>Power: ${item.power} GH/s</small></div>
                     <div><small>Size: ${item.size} slot(s)</small></div>
                     <div><small>Watts: ${item.watts}</small></div>` :
                    `<div><small>Slots: ${item.slots}</small></div>`
                }
            </div>
            <div class="store-price">${item.cost.toFixed(2)} RCT</div>
            <button class="buy-btn" data-id="${item.id}" data-type="${currentStoreTab}">
                COMPRAR
            </button>
        `;

        storeList.appendChild(itemElement);
    });

    // Adicionar event listeners aos botões de compra
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const type = e.target.dataset.type;
            
            if (id && type) {
                await buyItem(id, type);
            }
        });
    });
}

async function buyItem(itemId, itemType) {
    const response = await apiCall('buy', {
        item_id: itemId,
        type: itemType
    });

    if (response.success) {
        alert('Compra realizada com sucesso!');
        // Atualizar dados do usuário
        window.updateData && await window.updateData();
    } else {
        alert(response.message || 'Erro ao comprar item');
    }
}

// Exportar para uso global
window.renderStore = renderStore;
window.setStoreTab = setStoreTab;