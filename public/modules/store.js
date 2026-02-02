// ===========================================
// STORE MODULE - Sistema da loja
// ===========================================

import { apiCall, buyItem } from './api.js';

let currentStoreTab = 'miners';

/**
 * Inicializa a loja
 */
export function initStore() {
    console.log('🏪 Inicializando loja...');
    
    // Configurar event listeners
    setupStoreEventListeners();
    
    console.log('✅ Loja inicializada');
}

/**
 * Renderiza a loja
 */
export function renderStore(category = 'miners') {
    currentStoreTab = category;
    
    const storeProducts = document.getElementById('store-products');
    if (!storeProducts || !window.CATALOG) return;
    
    storeProducts.innerHTML = '';
    
    let items = [];
    let title = '';
    
    switch(category) {
        case 'miners':
            items = window.CATALOG.miners || [];
            title = 'Mineradores';
            break;
        case 'racks':
            items = window.CATALOG.racks || [];
            title = 'Racks';
            break;
        case 'upgrades':
            items = window.CATALOG.upgrades || [];
            title = 'Upgrades';
            break;
        case 'energy':
            items = []; // Seriam itens de energia
            title = 'Energia';
            break;
        case 'skins':
            items = []; // Seriam skins
            title = 'Skins';
            break;
    }
    
    if (items.length === 0) {
        storeProducts.innerHTML = `
            <div class="empty-store">
                <i class="fa-solid fa-box-open"></i>
                <h3>Em breve!</h3>
                <p>Mais ${title.toLowerCase()} serão adicionados em breve.</p>
            </div>
        `;
        return;
    }
    
    items.forEach(item => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        
        let statsHTML = '';
        let icon = 'fa-box';
        
        if (category === 'miners') {
            statsHTML = `
                <div class="product-stat">
                    <i class="fa-solid fa-bolt"></i>
                    <span>${item.power} GH/s</span>
                </div>
                <div class="product-stat">
                    <i class="fa-solid fa-plug"></i>
                    <span>${item.watts} W</span>
                </div>
                <div class="product-stat">
                    <i class="fa-solid fa-expand"></i>
                    <span>${item.size} slot(s)</span>
                </div>
            `;
            icon = 'fa-microchip';
            
        } else if (category === 'racks') {
            statsHTML = `
                <div class="product-stat">
                    <i class="fa-solid fa-server"></i>
                    <span>${item.slots} slots</span>
                </div>
                <div class="product-stat">
                    <i class="fa-solid fa-layer-group"></i>
                    <span>${item.size || 'Médio'}</span>
                </div>
            `;
            icon = 'fa-server';
            
        } else if (category === 'upgrades') {
            statsHTML = `
                <div class="product-stat">
                    <i class="fa-solid fa-arrow-up"></i>
                    <span>${item.description}</span>
                </div>
            `;
            icon = 'fa-arrow-up';
        }
        
        productCard.innerHTML = `
            <div class="product-icon">
                <i class="fa-solid ${icon}"></i>
            </div>
            
            <h3>${item.name}</h3>
            
            <div class="product-stats">
                ${statsHTML}
            </div>
            
            <div class="product-price">
                ${item.cost.toFixed(2)} CMA
            </div>
            
            <button class="btn-neon-green buy-btn" 
                    data-id="${item.id}" 
                    data-type="${category}"
                    ${window.USER_DATA?.balance >= item.cost ? '' : 'disabled'}>
                ${window.USER_DATA?.balance >= item.cost ? 'COMPRAR' : 'SALDO INSUFICIENTE'}
            </button>
        `;
        
        storeProducts.appendChild(productCard);
    });
    
    // Re-configurar event listeners
    setupStoreEventListeners();
}

/**
 * Configura event listeners da loja
 */
function setupStoreEventListeners() {
    // Botões de compra
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const itemId = e.target.dataset.id;
            const itemType = e.target.dataset.type;
            
            if (itemId && itemType) {
                await purchaseItem(itemId, itemType);
            }
        });
    });
}

/**
 * Realiza uma compra
 */
async function purchaseItem(itemId, itemType) {
    if (!window.USER_DATA) {
        alert('Você precisa estar logado para comprar itens.');
        return;
    }
    
    // Confirmar compra
    if (!confirm('Deseja realmente comprar este item?')) {
        return;
    }
    
    try {
        const response = await buyItem(itemId, itemType);
        
        if (response.success) {
            // Atualizar dados do usuário
            if (window.updateData) {
                await window.updateData();
            }
            
            // Atualizar interface da loja
            renderStore(currentStoreTab);
            
            // Mostrar notificação
            if (window.showNotification) {
                window.showNotification(
                    '✅ Compra Realizada',
                    `Você comprou ${response.item?.name || 'o item'}!`,
                    'success'
                );
            }
            
        } else {
            alert(response.message || 'Erro ao comprar item');
        }
        
    } catch (error) {
        console.error('Erro na compra:', error);
        alert('Erro de conexão com o servidor');
    }
}

// Exportar para uso global
window.initStore = initStore;
window.renderStore = renderStore;

console.log('✅ store.js carregado');