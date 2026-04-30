const fs = require('fs');
const xml = fs.readFileSync('NotaErro.xml', 'utf8');

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
    
    // Inicia com a estimativa base
    let vUnCom = Math.round((vProdRounded / qCom) * 10000) / 10000;
    arr.push({ nItem: d.nItem, qCom, vUnCom });
});

function getSums() {
    let exactRaw = 0;
    let vprod = 0;
    for (let i of arr) {
        exactRaw += (i.qCom * i.vUnCom);
        vprod += simpleCalc(i.qCom, i.vUnCom);
    }
    return {
        exactRaw: exactRaw,
        exact: Math.round(exactRaw * 100) / 100,
        vprod: Math.round(vprod * 100) / 100
    };
}

// Optimization Loop
let iter = 0;
let maxIters = 20000;

while (iter < maxIters) {
    iter++;
    let sums = getSums();
    let diffExact = Math.round((novoTotal - sums.exact) * 100);
    let diffVProd = Math.round((novoTotal - sums.vprod) * 100);
    
    if (diffExact === 0 && diffVProd === 0) {
        console.log(`Converged at iter ${iter}!`);
        break;
    }
    
    let bestItem = null;
    let bestMove = 0;
    let bestScore = -999999;
    
    let distExactBefore = Math.abs(novoTotal - sums.exactRaw);
    let distVProdBefore = Math.abs(diffVProd);
    
    for (let item of arr) {
        for (let sign of [1, -1]) {
            for (let mult = 1; mult <= 5; mult++) { // Try small jumps
                let move = sign * mult * 0.0001;
                let newU = Math.round((item.vUnCom + move) * 10000) / 10000;
                
                let oldE = item.qCom * item.vUnCom;
                let newE = item.qCom * newU;
                
                let oldV = simpleCalc(item.qCom, item.vUnCom);
                let newV = simpleCalc(item.qCom, newU);
                
                let dE = newE - oldE;
                let dV = Math.round((newV - oldV) * 100); // delta in cents
                
                let newExactRaw = sums.exactRaw + dE;
                let newExactRounded = Math.round(newExactRaw * 100) / 100;
                let newVProdSum = Math.round((sums.vprod * 100 + dV)) / 100;
                
                let distExactAfter = Math.abs(novoTotal - newExactRaw);
                let distVProdAfter = Math.abs(Math.round((novoTotal - newVProdSum) * 100));
                
                let exactImprovement = distExactBefore - distExactAfter;
                let vprodImprovement = distVProdBefore - distVProdAfter;
                
                // Score function
                let score = 0;
                
                // Se um deles já está resolvido, não podemos piorar muito
                if (diffExact === 0 && Math.abs(novoTotal - newExactRounded) > 0) score -= 10000;
                if (diffVProd === 0 && Math.abs(novoTotal - newVProdSum) > 0) score -= 10000;
                
                // Prioriza resolver o que tem diferença
                if (diffExact !== 0 && diffVProd === 0) {
                    score += exactImprovement * 1000 + vprodImprovement * 10;
                } else if (diffVProd !== 0 && diffExact === 0) {
                    score += vprodImprovement * 1000 + exactImprovement * 10;
                } else {
                    score += exactImprovement * 100 + vprodImprovement * 100;
                }
                
                // Add a small random jitter to break ties
                score += Math.random() * 0.001;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestItem = item;
                    bestMove = move;
                }
            }
        }
    }
    
    if (bestItem && bestScore > -5000) {
        bestItem.vUnCom = Math.round((bestItem.vUnCom + bestMove) * 10000) / 10000;
    } else {
        // Stuck! Try a random valid move that doesn't worsen things too much
        let item = arr[Math.floor(Math.random() * arr.length)];
        let move = (Math.random() > 0.5 ? 1 : -1) * 0.0001;
        item.vUnCom = Math.round((item.vUnCom + move) * 10000) / 10000;
    }
}

let finalSums = getSums();
console.log(`Final Iters: ${iter}`);
console.log(`Exact Sum Raw: ${finalSums.exactRaw}`);
console.log(`Exact Sum Rounded: ${finalSums.exact}`);
console.log(`vProd Sum: ${finalSums.vprod}`);

if (finalSums.exact === novoTotal && finalSums.vprod === novoTotal) {
    console.log("SUCESSO!!!");
    
    // Write out the result to a JSON file to use in index.html
    let res = {};
    arr.forEach(i => res[i.nItem] = i.vUnCom);
    fs.writeFileSync('vUnCom_sol.json', JSON.stringify(res));
}
