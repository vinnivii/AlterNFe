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
    
    // Find ALL valid 4-decimal vUnCom that round to vProdRounded
    let validUnComs = [];
    let baseRaw = vProdRounded / qCom;
    let base = Math.round(baseRaw * 10000) / 10000;
    for (let d = -20; d <= 20; d++) {
        let candidate = Math.round((base + d * 0.0001) * 10000) / 10000;
        if (simpleCalc(qCom, candidate) === vProdRounded) {
            validUnComs.push({
                u: candidate,
                exact: qCom * candidate
            });
        }
    }
    
    arr.push({ nItem: d.nItem, qCom, vProdReal: vProdRounded, options: validUnComs });
});

// We want sum(selected exact) to be in [362364.505, 362364.5149...]
// Since it's continuous, we just want to get as close to 362364.51 as possible.
// Wait, if we can't find a combination, maybe we need to change vProdRounded for some items.
// Let's first see the min and max possible exact sum for this fixed vProdRounded distribution.

let minExact = 0;
let maxExact = 0;
let defaultExact = 0;

arr.forEach(item => {
    if (item.options.length === 0) {
        console.log(`NO OPTIONS FOR ITEM ${item.nItem}`);
        return;
    }
    // Sort options by exact product
    item.options.sort((a, b) => a.exact - b.exact);
    minExact += item.options[0].exact;
    maxExact += item.options[item.options.length - 1].exact;
    
    // Pick the one that gives exact product closest to vProdRounded
    let best = item.options[0];
    for (let o of item.options) {
        if (Math.abs(o.exact - item.vProdReal) < Math.abs(best.exact - item.vProdReal)) best = o;
    }
    defaultExact += best.exact;
});

console.log(`Fixed vProd Sum: ${novoTotal}`);
console.log(`Min possible Exact Sum: ${minExact} -> rounded: ${Math.round(minExact*100)/100}`);
console.log(`Max possible Exact Sum: ${maxExact} -> rounded: ${Math.round(maxExact*100)/100}`);
console.log(`Default Exact Sum: ${defaultExact} -> rounded: ${Math.round(defaultExact*100)/100}`);

// Se o target 362364.505 <= target <= 362364.5149 não está entre [min, max],
// ENTÃO É MATEMATICAMENTE IMPOSSÍVEL com essa distribuição de vProdReal!
