// Teste de arredondamento tardio (late rounding) no Access
const fs = require('fs');
const xml = fs.readFileSync('NotaErro.xml', 'utf8');

// Primeiro, vamos gerar a lista exata de (qCom, vUnCom, vProdReal) que o nosso
// index.html atual geraria para a nota de teste e o novo total 362364.51
const novoTotal = 362364.51;

const matchTotal = xml.match(/<ICMSTot[\s\S]*?<vProd>([\d.]+)<\/vProd>/);
const valorAtual = parseFloat(matchTotal[1]);
const fator = novoTotal / valorAtual;

const regexDet = /<det\b[^>]*nItem="(\d+)"[^>]*>[\s\S]*?<\/det>/g;
let match;
let dets = [];
while ((match = regexDet.exec(xml)) !== null) {
    dets.push({ nItem: match[1], det: match[0] });
}

function simpleCalc(q, u) {
    return Math.round(q * u * 100) / 100;
}

function findBestVUnCom(vProdTarget, q) {
    let baseRaw = vProdTarget / q;
    let base = Math.round(baseRaw * 10000) / 10000;
    let candidates = new Set();
    candidates.add(Math.round(baseRaw * 10000) / 10000);
    candidates.add(Math.ceil(baseRaw * 10000) / 10000);
    candidates.add(Math.floor(baseRaw * 10000) / 10000);
    for (let d = -10; d <= 10; d++) {
        candidates.add(Math.round((base + d * 0.0001) * 10000) / 10000);
    }
    for (let c of candidates) {
        if (simpleCalc(q, c) === vProdTarget) return c;
    }
    return null;
}

let arr = [];
let somaProporcional = 0;

dets.forEach((d, index) => {
    let vProdAntigo = parseFloat(d.det.match(/<vProd>([\d.]+)<\/vProd>/)[1]);
    let qCom = parseFloat(d.det.match(/<qCom>([\d.]+)<\/qCom>/)[1]);
    
    let vProdIdeal = vProdAntigo * fator;
    let vProdRounded;
    if (index === dets.length - 1) {
        vProdRounded = Math.round((novoTotal - somaProporcional) * 100) / 100;
    } else {
        vProdRounded = Math.round(vProdIdeal * 100) / 100;
        somaProporcional += vProdRounded;
    }
    
    let vUnCom = findBestVUnCom(vProdRounded, qCom);
    let vProdReal;
    if (vUnCom !== null) {
        vProdReal = vProdRounded;
    } else {
        vUnCom = Math.round((vProdRounded / qCom) * 10000) / 10000;
        vProdReal = simpleCalc(qCom, vUnCom);
    }
    
    arr.push({ nItem: d.nItem, qCom, vUnCom, vProdReal });
});

// Ajuste por centavo
let totalReal = 0;
arr.forEach(item => totalReal += item.vProdReal);
totalReal = Math.round(totalReal * 100) / 100;
let diffCents = Math.round((novoTotal - totalReal) * 100);

function findOneCentStep(item, sign) {
    for (let mult = 1; mult <= 200; mult++) {
        let step = sign * mult * 0.0001;
        let newUnCom = Math.round((item.vUnCom + step) * 10000) / 10000;
        let newProd = simpleCalc(item.qCom, newUnCom);
        let delta = Math.round((newProd - item.vProdReal) * 100);
        if (delta === sign) return { newUnCom, newProd, delta };
        if (Math.abs(delta) > 1) break;
    }
    return null;
}

let iterCount = 0;
while (diffCents !== 0 && iterCount < Math.abs(diffCents) + 100) {
    iterCount++;
    let sign = Math.sign(diffCents);
    let applied = false;
    let candidates = arr.map((item, idx) => ({ item, idx })).sort((a, b) => a.item.qCom - b.item.qCom);
    
    for (let { item } of candidates) {
        let result = findOneCentStep(item, sign);
        if (result) {
            item.vUnCom = result.newUnCom;
            item.vProdReal = result.newProd;
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
                let newProd = simpleCalc(item.qCom, newUnCom);
                let delta = Math.round((newProd - item.vProdReal) * 100);
                if (delta !== 0 && Math.sign(delta) === sign && Math.abs(delta) <= Math.abs(diffCents)) {
                    item.vUnCom = newUnCom;
                    item.vProdReal = newProd;
                    diffCents -= delta;
                    applied = true;
                    break;
                }
            }
            if (applied) break;
        }
    }
}

// AGORA VAMOS TESTAR COMO O ACCESS PODE ESTAR SOMANDO
console.log('Testando hipóteses de soma do Access para o array recém-gerado:');

// Hipótese 1: Access soma os qCom * vUnCom SEM ARREDONDAR, mantendo a precisão, e só arredonda no final.
let somaPura = 0;
arr.forEach(item => {
    somaPura += (item.qCom * item.vUnCom);
});
console.log(`Soma de (qCom * vUnCom) sem arredondamento em cada item: ${somaPura}`);
console.log(`  Arredondado para 2 dec: ${(Math.round(somaPura * 100) / 100).toFixed(2)}`);

// Hipótese 2: Access soma os qCom * vUnCom arredondando para 4 casas a cada passo
let soma4dec = 0;
arr.forEach(item => {
    soma4dec += Math.round(item.qCom * item.vUnCom * 10000) / 10000;
});
console.log(`Soma de round(qCom * vUnCom, 4) por item: ${soma4dec}`);
console.log(`  Arredondado para 2 dec: ${(Math.round(soma4dec * 100) / 100).toFixed(2)}`);

// Hipótese 3: Access soma os qCom * vUnCom truncando para 4 casas a cada passo
let soma4decTrunc = 0;
arr.forEach(item => {
    soma4decTrunc += Math.floor(item.qCom * item.vUnCom * 10000) / 10000;
});
console.log(`Soma de trunc(qCom * vUnCom, 4) por item: ${soma4decTrunc}`);
console.log(`  Arredondado para 2 dec: ${(Math.round(soma4decTrunc * 100) / 100).toFixed(2)}`);

// Hipótese 4: Banker's rounding na soma total
function bankersRound(val) {
    let rounded = Math.round(val * 100);
    let remainder = val * 100 - Math.floor(val * 100);
    if (Math.abs(remainder - 0.5) < 1e-10) {
        let floor = Math.floor(val * 100);
        if (floor % 2 === 0) return floor / 100;
        return (floor + 1) / 100;
    }
    return rounded / 100;
}
console.log(`Banker's round da soma sem arredondar: ${bankersRound(somaPura).toFixed(2)}`);

// Soma dos vProdReal (que nós gravamos no XML)
let somaXML = 0;
arr.forEach(item => {
    somaXML += item.vProdReal;
});
console.log(`Soma exata dos vProd (o que vai no XML e o q pedimos): ${(Math.round(somaXML * 100) / 100).toFixed(2)}`);

