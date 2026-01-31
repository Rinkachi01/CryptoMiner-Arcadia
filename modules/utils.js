// Funções utilitárias gerais
export function formatPower(v) {
    if (!v) return "0 GH/s";
    if (v >= 1000000) return (v / 1000000).toFixed(2) + " PH/s";
    if (v >= 1000) return (v / 1000).toFixed(2) + " TH/s";
    return v.toFixed(2) + " GH/s";
}

export function formatCurrency(amount) {
    return '$' + amount.toFixed(2);
}

export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function animateValue(element, start, end, duration) {
    // Animação de contagem
}

// Imagens das moedas (substituir emojis por imagens)
export const COIN_IMAGES = {
    'BTC': '/assets/images/coins/bitcoin.png',
    'ETH': '/assets/images/coins/ethereum.png',
    'DOGE': '/assets/images/coins/dogecoin.png',
    'SOL': '/assets/images/coins/solana.png',
    'BNB': '/assets/images/coins/binance.png',
    'RLT': '/assets/images/coins/roller-token.png'
};

// Função para carregar imagem
export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}