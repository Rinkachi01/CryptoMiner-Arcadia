// organize-images.js - Script para organizar imagens
const fs = require('fs');
const path = require('path');

// Criar diretórios necessários
const assetsDir = path.join(__dirname, 'public', 'assets');
const imagesDir = path.join(assetsDir, 'images');
const coinsDir = path.join(assetsDir, 'coins');
const minersDir = path.join(assetsDir, 'miners');

[assetsDir, imagesDir, coinsDir, minersDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Mover imagens existentes
const imageFiles = fs.readdirSync(__dirname).filter(file => 
    /\.(png|svg|jpg|jpeg|gif)$/i.test(file)
);

imageFiles.forEach(file => {
    const source = path.join(__dirname, file);
    let destination;
    
    if (file.includes('coin') || file.includes('cma')) {
        destination = path.join(coinsDir, file);
    } else if (file.includes('miner') || file.includes('gpu') || file.includes('asic')) {
        destination = path.join(minersDir, file);
    } else {
        destination = path.join(imagesDir, file);
    }
    
    if (fs.existsSync(source)) {
        fs.renameSync(source, destination);
        console.log(`Movido: ${file} -> ${destination.replace(__dirname, '')}`);
    }
});

console.log('✅ Imagens organizadas com sucesso!');