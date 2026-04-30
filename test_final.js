const fs = require('fs');
let xml = fs.readFileSync('NotaOrigem.xml', 'utf8');

const novoTotal = 266858.07;
const matchTotalAtual = xml.match(/<ICMSTot>[\s\S]*?<vProd>([\d\.]+)<\/vProd>/);
const valorAtual = parseFloat(matchTotalAtual[1]);
const fator = novoTotal / valorAtual;

const regexDet = /<det nItem="\d+">[\s\S]*?<\/det>/g;
const dets = xml.match(regexDet);

let arr = [];
let somaProporcional = 0;

dets.forEach((det, index) => {
    let vProdAntigo = parseFloat(det.match(/<vProd>([\d\.]+)<\/vProd>/)[1]);
    let qCom = parseFloat(det.match(/<qCom>([\d\.]+)<\/qCom>/)[1]);
    let qTrib = parseFloat(det.match(/<qTrib>([\d\.]+)<\/qTrib>/)[1]);

    let vProdIdeal = vProdAntigo * fator;
    let vProdRounded;
    if (index === dets.length - 1) {
        vProdRounded = Math.round((novoTotal - somaProporcional) * 100) / 100;
    } else {
        vProdRounded = Math.round(vProdIdeal * 100) / 100;
        somaProporcional += vProdRounded;
    }

    let vUnCom = Math.round((vProdRounded / qCom) * 10000) / 10000;
    let vProdReal = Math.round(qCom * vUnCom * 100) / 100;
    
    if (vProdReal !== vProdRounded) {
        let tentativas = [0.0001, -0.0001, 0.0002, -0.0002, 0.0003, -0.0003];
        for (let d of tentativas) {
            let t = Math.round((vUnCom + d) * 10000) / 10000;
            let check = Math.round(qCom * t * 100) / 100;
            if (check === vProdRounded) { vUnCom = t; vProdReal = check; break; }
        }
    }
    
    let vUnTrib = Math.round((vProdReal / qTrib) * 10000) / 10000;
    arr.push({ qCom, qTrib, vUnCom, vUnTrib, vProdReal });
});

let totalReal = 0;
arr.forEach(item => totalReal += item.vProdReal);
totalReal = Math.round(totalReal * 100) / 100;
let diffCents = Math.round((novoTotal - totalReal) * 100);

console.log(`Total real ANTES do ajuste: ${totalReal}`);
console.log(`Diferença: ${diffCents} centavos`);

function findOneCentStep(item, sign) {
    for (let mult = 1; mult <= 200; mult++) {
        let step = sign * mult * 0.0001;
        let newUnCom = Math.round((item.vUnCom + step) * 10000) / 10000;
        let newProd = Math.round(item.qCom * newUnCom * 100) / 100;
        let delta = Math.round((newProd - item.vProdReal) * 100);
        if (delta === sign) return { newUnCom, newProd, delta };
        if (Math.abs(delta) > 1) break;
    }
    return null;
}

let maxIters = Math.abs(diffCents) + 100;
let iterCount = 0;
while (diffCents !== 0 && iterCount < maxIters) {
    iterCount++;
    let sign = Math.sign(diffCents);
    let applied = false;
    let candidates = arr.map((item, idx) => ({ item, idx })).sort((a, b) => a.item.qCom - b.item.qCom);

    for (let { item } of candidates) {
        let result = findOneCentStep(item, sign);
        if (result) {
            item.vUnCom = result.newUnCom;
            item.vProdReal = result.newProd;
            item.vUnTrib = Math.round((item.vProdReal / item.qTrib) * 10000) / 10000;
            diffCents -= result.delta;
            applied = true;
            break;
        }
    }

    if (!applied) {
        for (let { item } of candidates) {
            for (let mult = 1; mult <= 100; mult++) {
                let step = sign * mult * 0.0001;
                let newUnCom = Math.round((item.vUnCom + step) * 10000) / 10000;
                let newProd = Math.round(item.qCom * newUnCom * 100) / 100;
                let delta = Math.round((newProd - item.vProdReal) * 100);
                if (delta !== 0 && Math.sign(delta) === sign && Math.abs(delta) <= Math.abs(diffCents)) {
                    item.vUnCom = newUnCom;
                    item.vProdReal = newProd;
                    item.vUnTrib = Math.round((item.vProdReal / item.qTrib) * 10000) / 10000;
                    diffCents -= delta;
                    applied = true;
                    break;
                }
            }
            if (applied) break;
        }
    }
    if (!applied) { console.log('NAO CONSEGUIU AJUSTAR MAIS! diffCents restante: ' + diffCents); break; }
}

let totalFinal = 0;
arr.forEach(item => totalFinal += item.vProdReal);
totalFinal = Math.round(totalFinal * 100) / 100;

// Verificar se qCom * vUnCom bate para cada item
let erros = 0;
arr.forEach((item, i) => {
    let check = Math.round(item.qCom * item.vUnCom * 100) / 100;
    if (check !== item.vProdReal) {
        console.log(`ERRO Item ${i}: qCom=${item.qCom} * vUnCom=${item.vUnCom.toFixed(4)} = ${check} != vProdReal=${item.vProdReal}`);
        erros++;
    }
    // Validar max 4 casas decimais
    let decStr = item.vUnCom.toFixed(10).split('.')[1];
    let significantDecimals = decStr.replace(/0+$/, '').length;
    if (significantDecimals > 4) {
        console.log(`ERRO Item ${i}: vUnCom=${item.vUnCom} tem mais de 4 casas decimais`);
        erros++;
    }
});

console.log(`\nTotal final: ${totalFinal}`);
console.log(`Target: ${novoTotal}`);
console.log(`Match: ${totalFinal === novoTotal ? 'SIM!' : 'NAO - diff=' + (novoTotal - totalFinal).toFixed(2)}`);
console.log(`Iterações: ${iterCount}`);
console.log(`Erros de validação: ${erros}`);
