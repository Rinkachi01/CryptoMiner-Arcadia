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
        image: 'assets/cma-coin.png', // Usando a imagem da CMA para ADA por enquanto
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

export async function loadCoinImage(coinSymbol) {
    const coinData = COIN_IMAGES[coinSymbol];
    if (!coinData) return null;
    
    // Se já estiver em cache, retornar
    if (imageCache.has(coinSymbol)) {
        return imageCache.get(coinSymbol);
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
            resolve(null); // Retornar null para usar fallback
        };
        
        img.src = coinData.image;
    });
}

export function getCoinHTML(coinSymbol, size = 'medium') {
    const coinData = COIN_IMAGES[coinSymbol];
    if (!coinData) {
        return `<div style="color: #fff; background: #333; border-radius: 50%; width: ${getSize(size)}; height: ${getSize(size)}; display: flex; align-items: center; justify-content: center;">?</div>`;
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
            <img src="${coinData.image}" 
                 alt="${coinData.name}"
                 style="
                    width: 70%;
                    height: 70%;
                    object-fit: contain;
                 "
                 onerror="this.style.display='none'; this.parentElement.innerHTML='${coinData.fallback}'; this.parentElement.style.fontSize='${size === 'small' ? '16px' : size === 'medium' ? '24px' : '32px'}'"
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