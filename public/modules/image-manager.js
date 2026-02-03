// modules/image-manager.js - Gerenciador de imagens das moedas

export const COIN_IMAGES = {
    // Mapeamento das moedas para os arquivos
    'BTC': { 
        name: 'Bitcoin',
        image: 'assets/btc.svg',
        fallback: '₿',
        color: '#F7931A'
    },
    'ETH': { 
        name: 'Ethereum',
        image: 'assets/ethereum.png',
        fallback: '🔷',
        color: '#627EEA'
    },
    'DOGE': { 
        name: 'Dogecoin',
        image: 'assets/doge.svg',
        fallback: '🐕',
        color: '#C2A633'
    },
    'SOL': { 
        name: 'Solana',
        image: 'assets/solana.png',
        fallback: '🔹',
        color: '#00FFA3'
    },
    'BNB': { 
        name: 'Binance Coin',
        image: 'assets/binance.png',
        fallback: '🟡',
        color: '#F0B90B'
    },
    'XRP': { 
        name: 'Ripple',
        image: 'assets/xrp.svg',
        fallback: '✖️',
        color: '#23292F'
    },
    'USDT': { 
        name: 'Tether',
        image: 'assets/usdt.png',
        fallback: '💲',
        color: '#26A69A'
    },
    'ADA': { 
        name: 'Cardano',
        image: 'assets/cma-coin.png',
        fallback: '🔷',
        color: '#0033AD'
    },
    'MATIC': { 
        name: 'Polygon',
        image: 'assets/matic.svg',
        fallback: '🔶',
        color: '#8247E5'
    },
    'LTC': { 
        name: 'Litecoin',
        image: 'assets/ltc.svg',
        fallback: '⛓️',
        color: '#BFBBBB'
    },
    'TRX': { 
        name: 'TRON',
        image: 'assets/trx.png',
        fallback: '🔶',
        color: '#FF0015'
    },
    'XMR': { 
        name: 'Monero',
        image: 'assets/xmr.svg',
        fallback: '🟣',
        color: '#FF6600'
    },
    'CMA': { 
        name: 'CMA Coin',
        image: 'assets/cma-coin.png',
        fallback: '💰',
        color: '#6c5ce7'
    }
};

// Cache de imagens carregadas
const imageCache = new Map();

// Verificar se o arquivo existe
async function checkImageExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

export async function loadCoinImage(coinSymbol) {
    const coinData = COIN_IMAGES[coinSymbol];
    if (!coinData) return null;
    
    // Se já estiver em cache, retornar
    if (imageCache.has(coinSymbol)) {
        return imageCache.get(coinSymbol);
    }
    
    // Verificar se a imagem existe
    const exists = await checkImageExists(coinData.image);
    
    if (!exists) {
        console.warn(`Imagem não encontrada: ${coinData.image}, usando fallback`);
        return null;
    }
    
    // Tentar carregar a imagem
    return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = () => {
            imageCache.set(coinSymbol, img);
            resolve(img);
        };
        
        img.onerror = () => {
            console.warn(`Falha ao carregar imagem para ${coinSymbol}, usando fallback`);
            resolve(null);
        };
        
        img.src = coinData.image;
    });
}

export function getCoinHTML(coinSymbol, size = 'medium') {
    const coinData = COIN_IMAGES[coinSymbol];
    if (!coinData) {
        return `<div class="coin-fallback" style="
            background: #333; 
            color: #fff; 
            border-radius: 50%; 
            width: ${getSize(size)}; 
            height: ${getSize(size)}; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            font-weight: bold;
        ">?</div>`;
    }
    
    const sizes = {
        small: '24px',
        medium: '40px',
        large: '60px',
        xlarge: '80px'
    };
    
    const sizePx = sizes[size] || sizes.medium;
    
    return `
        <div class="coin-display" style="
            width: ${sizePx}; 
            height: ${sizePx}; 
            background: ${coinData.color}20;
            border: 2px solid ${coinData.color};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        ">
            <div class="coin-fallback" style="
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
                font-size: ${size === 'small' ? '16px' : size === 'medium' ? '24px' : '32px'};
                color: ${coinData.color};
            ">
                ${coinData.fallback}
            </div>
            <img src="${coinData.image}" 
                 alt="${coinData.name}"
                 style="
                    width: 70%;
                    height: 70%;
                    object-fit: contain;
                    display: none;
                 "
                 onload="this.style.display='block'; this.previousElementSibling.style.display='none'"
                 onerror="this.style.display='none'"
            >
        </div>
    `;
}

function getSize(size) {
    const sizes = {
        small: '24px',
        medium: '40px',
        large: '60px',
        xlarge: '80px'
    };
    return sizes[size] || sizes.medium;
}