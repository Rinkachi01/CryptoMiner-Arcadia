// organize-images.js - Script para organizar imagens
const fs = require('fs');
const path = require('path');

// Criar diretório de assets se não existir
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// Lista de arquivos que você tem (ajuste conforme necessário)
const imageFiles = [
    'binance.png',
    'btc.svg',
    'cma-coin.png',
    'doge.svg',
    'ethereum.png',
    'ltc.svg',
    'matic.svg',
    'solana.png',
    'trx.png',
    'usdt.png',
    'xmr.svg',
    'xrp.svg'
];

// Mover arquivos para a pasta assets (se estiverem na raiz)
imageFiles.forEach(file => {
    const sourcePath = path.join(__dirname, file);
    const destPath = path.join(assetsDir, file);
    
    if (fs.existsSync(sourcePath)) {
        fs.renameSync(sourcePath, destPath);
        console.log(`Movido: ${file} -> assets/${file}`);
    }
});

console.log('Imagens organizadas com sucesso!');