// Nova lógica de recálculo baseada no comportamento real do Access 2003
// O Access soma qCom * vUnCom de todos os itens e só depois arredonda o total
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

// 1. Distribui o valor proporcionalmente e acha o melhor vUnCom base
let arr = [];
let somaProporcional = 0;

dets.forEach((d, index) => {
    let vProdAntigo = parseFloat(d.det.match(/<vProd>([\d.]+)<\/vProd>/)[1]);
    let qCom = parseFloat(d.det.match(/<qCom>([\d.]+)<\/qCom>/)[1]);
    let qTrib = parseFloat(d.det.match(/<qTrib>([\d.]+)<\/qTrib>/)[1]);
    
    let vProdIdeal = vProdAntigo * fator;
    let vProdRounded;
    if (index === dets.length - 1) {
        vProdRounded = Math.round((novoTotal - somaProporcional) * 100) / 100;
    } else {
        vProdRounded = Math.round(vProdIdeal * 100) / 100;
        somaProporcional += vProdRounded;
    }
    
    let baseRaw = vProdRounded / qCom;
    let vUnCom = Math.round(baseRaw * 10000) / 10000;
    let vProdReal = simpleCalc(qCom, vUnCom);
    
    arr.push({ nItem: d.nItem, qCom, qTrib, vUnCom, vProdReal });
});

// 2. O Access soma qCom * vUnCom exatamente e arredonda no final
// Vamos calcular a soma exata atual
function calcSomaExata() {
    let soma = 0;
    for (let item of arr) {
        soma += (item.qCom * item.vUnCom);
    }
    return soma;
}

let iterMax = 5000;
let iters = 0;

while (iters < iterMax) {
    iters++;
    let somaExata = calcSomaExata();
    let diffCentsExato = Math.round((novoTotal - somaExata) * 100);
    
    // Calcula também a soma dos vProdReal (arredondados)
    let somaVProd = 0;
    for (let item of arr) {
        item.vProdReal = simpleCalc(item.qCom, item.vUnCom);
        somaVProd += item.vProdReal;
    }
    let diffCentsVProd = Math.round((novoTotal - somaVProd) * 100);
    
    // Se ambos os totais baterem com o desejado, paramos
    if (diffCentsExato === 0 && diffCentsVProd === 0) {
        break;
    }
    
    // Precisamos ajustar. Qual a prioridade?
    // A soma exata (Access) dita o que o sistema vai gerar no final.
    // A soma arredondada (vProd) deve ser igual a ela para o XML ser válido.
    
    // Vamos escolher o item para ajustar baseado na diferença que queremos corrigir
    // Se diffCentsExato != 0, ajustamos em favor do diffCentsExato.
    // Se diffCentsExato == 0 mas diffCentsVProd != 0, ajustamos sutilmente para não quebrar o exato.
    
    let targetDiff = (diffCentsExato !== 0) ? diffCentsExato : diffCentsVProd;
    let sign = Math.sign(targetDiff);
    
    let applied = false;
    
    // Tentamos encontrar um item onde um incremento/decremento de 0.0001 em vUnCom
    // mova a soma exata e/ou a soma vProd na direção correta.
    // Vamos iterar por todos os itens
    for (let item of arr) {
        let step = sign * 0.0001;
        let newUnCom = Math.round((item.vUnCom + step) * 10000) / 10000;
        
        let oldExact = item.qCom * item.vUnCom;
        let newExact = item.qCom * newUnCom;
        let diffExact = newExact - oldExact; // quanto muda na soma exata
        
        let oldVProd = simpleCalc(item.qCom, item.vUnCom);
        let newVProd = simpleCalc(item.qCom, newUnCom);
        let diffVProd = newVProd - oldVProd; // quanto muda na soma vProd
        
        // Regra de aplicação:
        // 1. Se queremos arrumar diffCentsExato, aceitamos a mudança se diffExact ajuda e não estraga o vProd de forma irrecuperável.
        if (diffCentsExato !== 0) {
            // Queremos que diffExact mova a somaExata em direção ao target
            // diffExact * sign deve ser > 0
            if (diffExact * sign > 0) {
                item.vUnCom = newUnCom;
                applied = true;
                break;
            }
        } else {
            // diffCentsExato == 0, mas diffCentsVProd != 0
            // Queremos mudar vProd sem mudar muito a somaExata (que ela continue arredondando para o target)
            if (diffVProd * sign > 0) {
                // Será que a nova soma exata ainda arredonda para o target?
                let tempSomaExata = calcSomaExata() - oldExact + newExact;
                if (Math.round(tempSomaExata * 100) / 100 === novoTotal) {
                    item.vUnCom = newUnCom;
                    applied = true;
                    break;
                }
            }
        }
    }
    
    if (!applied) {
        // Se 0.0001 não funcionou, tenta passos maiores
        for (let mult = 2; mult <= 50; mult++) {
            let step = sign * mult * 0.0001;
            for (let item of arr) {
                let newUnCom = Math.round((item.vUnCom + step) * 10000) / 10000;
                let oldExact = item.qCom * item.vUnCom;
                let newExact = item.qCom * newUnCom;
                let diffExact = newExact - oldExact;
                
                let oldVProd = simpleCalc(item.qCom, item.vUnCom);
                let newVProd = simpleCalc(item.qCom, newUnCom);
                let diffVProd = newVProd - oldVProd;
                
                if (diffCentsExato !== 0) {
                    if (diffExact * sign > 0) {
                        item.vUnCom = newUnCom;
                        applied = true;
                        break;
                    }
                } else {
                    if (diffVProd * sign > 0) {
                        let tempSomaExata = calcSomaExata() - oldExact + newExact;
                        if (Math.round(tempSomaExata * 100) / 100 === novoTotal) {
                            item.vUnCom = newUnCom;
                            applied = true;
                            break;
                        }
                    }
                }
            }
            if (applied) break;
        }
    }
    if (!applied) {
        console.log("Não conseguiu ajustar mais!");
        break;
    }
}

// Atualizar vProdReal final e vUnTrib
for (let item of arr) {
    item.vProdReal = simpleCalc(item.qCom, item.vUnCom);
    item.vUnTrib = Math.round((item.vProdReal / item.qTrib) * 10000) / 10000;
    
    // Verifica vUnTrib
    if (simpleCalc(item.qTrib, item.vUnTrib) !== item.vProdReal) {
        for (let d of [0.0001, -0.0001, 0.0002, -0.0002]) {
            let t = Math.round((item.vUnTrib + d) * 10000) / 10000;
            if (simpleCalc(item.qTrib, t) === item.vProdReal) { item.vUnTrib = t; break; }
        }
    }
}

// VERIFICAÇÕES FINAIS
let sumExact = calcSomaExata();
let sumVProd = 0;
arr.forEach(i => sumVProd += i.vProdReal);

console.log(`\nSoma exata (Access): ${sumExact} -> Arredondado: ${(Math.round(sumExact * 100) / 100).toFixed(2)}`);
console.log(`Soma vProd (XML): ${(Math.round(sumVProd * 100) / 100).toFixed(2)}`);
console.log(`Iters usadas: ${iters}`);
