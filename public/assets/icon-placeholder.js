// Gera um ícone placeholder em base64
export function generatePlaceholderIcon() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Fundo
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, 512, 512);
    
    // Círculo
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(256, 256, 200, 0, Math.PI * 2);
    ctx.fill();
    
    // Texto
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 180px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CMA', 256, 256);
    
    return canvas.toDataURL('image/png');
}