const fs=require('fs');
const xml=fs.readFileSync('NotaOrigem.xml', 'utf8');
let divergencias=0;
const regexDet=/<(?:\w+:)?det\b[^>]*nItem="(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?det>/g;
let match;
while((match=regexDet.exec(xml))!==null) {
    const fd=match[0];
    const ni=match[1];
    const vp=fd.match(/<(?:\w+:)?vProd>([\d\.]+)<\/(?:\w+:)?vProd>/);
    if(!vp)continue;
    const vProd=parseFloat(vp[1]);
    const imp=fd.match(/<(?:\w+:)?imposto>([\s\S]*?)<\/(?:\w+:)?imposto>/);
    if(!imp)continue;
    const icms=imp[1].match(/<(?:\w+:)?ICMS>([\s\S]*?)<\/(?:\w+:)?ICMS>/);
    if(!icms)continue;
    const vbc=icms[0].match(/<(?:\w+:)?vBC>([\d\.]+)<\/(?:\w+:)?vBC>/);
    if(vbc){
        const vbcv=parseFloat(vbc[1]);
        const diff=Math.round((vProd-vbcv)*100)/100;
        console.log(`Item ${ni}: vProd=${vProd}, vBC=${vbcv}, diff=${diff}`);
        if(diff>=0.01) {
            console.log('  -> Divergencia >= 0.01 detectada!');
            divergencias++;
        }
    }
}
console.log('Total: ' + divergencias);
