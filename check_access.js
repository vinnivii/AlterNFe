// Verificação do XML GERADO ANTERIORMENTE pelo usuário
// Foco: verificar se qTrib × vUnTrib também bate com vProd
const fs = require('fs');
const xml = fs.readFileSync('Recalculado_assinado_27260448031200000308550010000000161270430206 (1).xml', 'utf8');

const detRegex = /<det\b[^>]*nItem="(\d+)"[^>]*>[\s\S]*?<\/det>/g;
let match;
let somaVProd = 0;
let somaQxU = 0;
let somaQTxUT = 0;
let errosU = 0;
let errosUT = 0;

while ((match = detRegex.exec(xml)) !== null) {
    const det = match[0];
    const nItem = det.match(/nItem="(\d+)"/)[1];
    
    const qCom = parseFloat(det.match(/<qCom>([\d.]+)<\/qCom>/)[1]);
    const vUnCom = det.match(/<vUnCom>([\d.]+)<\/vUnCom>/)[1];
    const vProd = parseFloat(det.match(/<vProd>([\d.]+)<\/vProd>/)[1]);
    const qTrib = parseFloat(det.match(/<qTrib>([\d.]+)<\/qTrib>/)[1]);
    const vUnTrib = det.match(/<vUnTrib>([\d.]+)<\/vUnTrib>/)[1];
    
    somaVProd += vProd;
    
    let calcU = Math.round(qCom * parseFloat(vUnCom) * 100) / 100;
    let calcUT = Math.round(qTrib * parseFloat(vUnTrib) * 100) / 100;
    somaQxU += calcU;
    somaQTxUT += calcUT;
    
    if (Math.abs(calcU - vProd) > 0.001) {
        errosU++;
        console.log(`ERRO vUnCom Item ${nItem}: ${qCom} × ${vUnCom} = ${calcU} ≠ ${vProd} (diff=${(vProd-calcU).toFixed(2)})`);
    }
    if (Math.abs(calcUT - vProd) > 0.001) {
        errosUT++;
        if (errosUT <= 10) console.log(`ERRO vUnTrib Item ${nItem}: ${qTrib} × ${vUnTrib} = ${calcUT} ≠ ${vProd} (diff=${(vProd-calcUT).toFixed(2)})`);
    }
}

console.log('\n=== RESUMO XML ANTERIOR ===');
console.log('Soma vProd:', Math.round(somaVProd*100)/100);
console.log('Soma qCom×vUnCom:', Math.round(somaQxU*100)/100);
console.log('Soma qTrib×vUnTrib:', Math.round(somaQTxUT*100)/100);
console.log('Erros vUnCom:', errosU);
console.log('Erros vUnTrib:', errosUT);
console.log('Diff qTrib×vUnTrib vs 362364.51:', (362364.51 - Math.round(somaQTxUT*100)/100).toFixed(2));
