const fs = require('fs');
let xml = fs.readFileSync('NotaOrigem.xml', 'utf8');

const novoTotal = 266858.07;
const matchTotalAtual = xml.match(/<ICMSTot>[\s\S]*?<vProd>([\d\.]+)<\/vProd>/);
const valorAtual = parseFloat(matchTotalAtual[1]);
const fator = novoTotal / valorAtual;

console.log(`Valor atual: ${valorAtual}, Novo total: ${novoTotal}, Fator: ${fator}`);

const regexDet = /<det nItem="\d+">[\s\S]*?<\/det>/g;
const dets = xml.match(regexDet);

console.log(`Total de itens: ${dets.length}`);

// Fase 1: Calcular vProd proporcional para cada item
let arr = [];
let somaProporcional = 0;

dets.forEach((det, index) => {
    let vProdAntigo = parseFloat(det.match(/<vProd>([\d\.]+)<\/vProd>/)[1]);
    let qCom = parseFloat(det.match(/<qCom>([\d\.]+)<\/qCom>/)[1]);
    let qTrib = parseFloat(det.match(/<qTrib>([\d\.]+)<\/qTrib>/)[1]);

    let vProdIdeal = vProdAntigo * fator;
    // Arredondar vProd para 2 casas
    let vProdRounded;
    if (index === dets.length - 1) {
        // Último item: ajustar para fechar o total
        vProdRounded = Math.round((novoTotal - somaProporcional) * 100) / 100;
    } else {
        vProdRounded = Math.round(vProdIdeal * 100) / 100;
        somaProporcional += vProdRounded;
    }

    // Calcular vUnCom com 4 casas
    let vUnCom = Math.round((vProdRounded / qCom) * 10000) / 10000;
    let vUnTrib = Math.round((vProdRounded / qTrib) * 10000) / 10000;

    // Verificar: qCom * vUnCom arredondado para 2 casas == vProdRounded?
    let vProdCheck = Math.round(qCom * vUnCom * 100) / 100;
    let diff = Math.round((vProdCheck - vProdRounded) * 100);

    arr.push({
        index,
        qCom,
        qTrib,
        vUnCom,
        vUnTrib,
        vProdDesejado: vProdRounded,
        vProdReal: vProdCheck,
        diffCents: diff,
        det
    });
});

// Fase 2: Identificar itens com divergência
let totalReal = 0;
let totalDesejado = 0;
let divergentes = [];

arr.forEach(item => {
    totalReal += item.vProdReal;
    totalDesejado += item.vProdDesejado;
    if (item.diffCents !== 0) {
        divergentes.push(item);
    }
});

totalReal = Math.round(totalReal * 100) / 100;
totalDesejado = Math.round(totalDesejado * 100) / 100;

console.log(`\nTotal desejado (soma vProdDesejado): ${totalDesejado}`);
console.log(`Total real (soma qCom*vUnCom arredondado): ${totalReal}`);
console.log(`Diferença: ${(totalReal - totalDesejado).toFixed(2)} (${Math.round((totalReal - totalDesejado)*100)} centavos)`);
console.log(`Itens divergentes: ${divergentes.length}`);

divergentes.forEach(d => {
    console.log(`  Item ${d.index}: qCom=${d.qCom}, vUnCom=${d.vUnCom.toFixed(4)}, vProdDesejado=${d.vProdDesejado}, vProdReal=${d.vProdReal}, diff=${d.diffCents} centavos`);
});

// Fase 3: Para cada item divergente, tentar encontrar vUnCom alternativo
console.log('\n--- Tentando corrigir divergentes ---');
divergentes.forEach(d => {
    let found = false;
    // Tentar vUnCom ligeiramente diferente
    for (let delta = -10; delta <= 10; delta++) {
        let candidato = Math.round((d.vUnCom + delta * 0.0001) * 10000) / 10000;
        let vProdCheck = Math.round(d.qCom * candidato * 100) / 100;
        if (vProdCheck === d.vProdDesejado) {
            console.log(`  Item ${d.index}: ACHOU! vUnCom=${candidato.toFixed(4)} → qCom*vUnCom=${vProdCheck} == ${d.vProdDesejado}`);
            d.vUnCom = candidato;
            d.vProdReal = vProdCheck;
            d.diffCents = 0;
            found = true;
            break;
        }
    }
    if (!found) {
        console.log(`  Item ${d.index}: NAO ENCONTROU vUnCom compatível. qCom=${d.qCom}, vProdDesejado=${d.vProdDesejado}`);
        // Listar as opções mais próximas
        for (let delta = -3; delta <= 3; delta++) {
            let c = Math.round((d.vUnCom + delta * 0.0001) * 10000) / 10000;
            let vprod = Math.round(d.qCom * c * 100) / 100;
            console.log(`    vUnCom=${c.toFixed(4)} → vProd=${vprod}`);
        }
    }
});

// Fase 4: Ver o resultado final
let totalRealCorrigido = 0;
arr.forEach(item => totalRealCorrigido += item.vProdReal);
totalRealCorrigido = Math.round(totalRealCorrigido * 100) / 100;
console.log(`\nTotal real corrigido: ${totalRealCorrigido}`);
console.log(`Diferença final: ${Math.round((novoTotal - totalRealCorrigido)*100)} centavos`);

// Fase 5: Se ainda há diferença, ver quais itens permitem ajuste de 1 centavo
let diffFinal = Math.round((novoTotal - totalRealCorrigido) * 100);
if (diffFinal !== 0) {
    console.log(`\n--- Procurando itens para ajuste fino de ${diffFinal} centavos ---`);
    let sign = Math.sign(diffFinal);
    
    // Encontrar itens onde um step no vUnCom produz exatamente 1 centavo de mudança
    let candidates = [];
    arr.forEach(item => {
        // Calcular o step exato para 1 centavo
        let exactStep = 0.01 / item.qCom;
        // Arredondar para 4 casas decimais (para cima)
        let step4dec = Math.ceil(exactStep * 10000) / 10000;
        if (step4dec < 0.0001) step4dec = 0.0001;
        
        let newUnCom = Math.round((item.vUnCom + sign * step4dec) * 10000) / 10000;
        let newProd = Math.round(item.qCom * newUnCom * 100) / 100;
        let delta = Math.round((newProd - item.vProdReal) * 100);
        
        if (delta === sign) {
            candidates.push({
                index: item.index,
                qCom: item.qCom,
                currentVUnCom: item.vUnCom,
                newVUnCom: newUnCom,
                currentProd: item.vProdReal,
                newProd: newProd,
                step: step4dec
            });
        }
    });
    
    console.log(`Candidatos para ajuste de 1 centavo: ${candidates.length}`);
    candidates.slice(0, 10).forEach(c => {
        console.log(`  Item ${c.index}: qCom=${c.qCom}, vUnCom ${c.currentVUnCom.toFixed(4)} → ${c.newVUnCom.toFixed(4)}, vProd ${c.currentProd} → ${c.newProd}`);
    });
}
