import streamlit as st
import re

# Configuração da página
st.set_page_config(page_title="Corretor de NFe", page_icon="🧾", layout="centered")

def processar_xml(xml_content, novo_total_produtos):
    try:
        # 1. CORRIGIR A ESTRUTURA DO XML
        xml_content = xml_content.replace('MaceiÃ³', 'Maceió')
        xml_content = xml_content.replace(
            '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">', 
            '<NFe xmlns="http://www.portalfiscal.inf.br/nfe" xmlns:ns1="http://www.w3.org/2000/09/xmldsig#">'
        )
        xml_content = xml_content.replace(
            '<protNFe versao="4.00">', 
            '<protNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">'
        )
        xml_content = xml_content.replace('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">', '<ns1:Signature>')
        xml_content = xml_content.replace('</Signature>', '</ns1:Signature>')

        tags_assinatura = [
            'SignedInfo', 'CanonicalizationMethod', 'SignatureMethod', 'Reference', 
            'Transforms', 'Transform', 'DigestMethod', 'DigestValue', 
            'SignatureValue', 'KeyInfo', 'X509Data', 'X509Certificate'
        ]
        for tag in tags_assinatura:
            xml_content = re.sub(rf'<{tag}(\s|>)', rf'<ns1:{tag}\1', xml_content)
            xml_content = xml_content.replace(f'</{tag}>', f'</ns1:{tag}>')
            xml_content = re.sub(rf'<{tag}\s*/>', rf'<ns1:{tag}/>', xml_content)

        # 2. RECALCULAR OS VALORES
        vprod_total_match = re.search(r'<ICMSTot>.*?<vProd>([\d\.]+)</vProd>', xml_content, re.DOTALL)
        if not vprod_total_match:
            return None, "Erro: Não foi possível encontrar a tag <vProd> no totalizador da nota."
            
        valor_atual_produtos = float(vprod_total_match.group(1))
        fator = novo_total_produtos / valor_atual_produtos

        dets = re.findall(r'<det nItem="\d+">.*?</det>', xml_content, re.DOTALL)
        soma_vprod_novo = 0.0
        
        for i, det in enumerate(dets):
            vprod_antigo = float(re.search(r'<vProd>([\d\.]+)</vProd>', det).group(1))
            qcom = float(re.search(r'<qCom>([\d\.]+)</qCom>', det).group(1))
            qtrib = float(re.search(r'<qTrib>([\d\.]+)</qTrib>', det).group(1))
            
            if i == len(dets) - 1:
                vprod_novo = round(novo_total_produtos - soma_vprod_novo, 2)
            else:
                vprod_novo = round(vprod_antigo * fator, 2)
                soma_vprod_novo += vprod_novo
                
            vuncom_novo = vprod_novo / qcom
            vuntrib_novo = vprod_novo / qtrib
            
            det_novo = re.sub(r'<vProd>[\d\.]+</vProd>', f'<vProd>{vprod_novo:.2f}</vProd>', det)
            det_novo = re.sub(r'<vUnCom>[\d\.]+</vUnCom>', f'<vUnCom>{vuncom_novo:.10f}</vUnCom>', det_novo)
            det_novo = re.sub(r'<vUnTrib>[\d\.]+</vUnTrib>', f'<vUnTrib>{vuntrib_novo:.10f}</vUnTrib>', det_novo)
            det_novo = re.sub(r'<vItem>[\d\.]+</vItem>', f'<vItem>{vprod_novo:.2f}</vItem>', det_novo)
            
            xml_content = xml_content.replace(det, det_novo)
            
        # 3. ATUALIZAR TOTALIZADORES
        xml_content = re.sub(r'(<ICMSTot>.*?<vProd>)[\d\.]+([^<]*</vProd>)', rf'\g<1>{novo_total_produtos:.2f}\g<2>', xml_content, flags=re.DOTALL)
        
        tags_impostos = ['vII', 'vIPI', 'vPIS', 'vCOFINS', 'vOutro']
        soma_impostos = 0.0
        icmstot_block = re.search(r'<ICMSTot>.*?</ICMSTot>', xml_content, re.DOTALL).group(0)
        
        for tag in tags_impostos:
            match = re.search(rf'<{tag}>([\d\.]+)</{tag}>', icmstot_block)
            if match:
                soma_impostos += float(match.group(1))
                
        novo_vnf = novo_total_produtos + soma_impostos
        
        xml_content = re.sub(r'(<ICMSTot>.*?<vNF>)[\d\.]+([^<]*</vNF>)', rf'\g<1>{novo_vnf:.2f}\g<2>', xml_content, flags=re.DOTALL)
        xml_content = re.sub(r'<vNFTot>[\d\.]+</vNFTot>', f'<vNFTot>{novo_vnf:.2f}</vNFTot>', xml_content)

        return xml_content, f"Sucesso! Novo Total Produtos: R$ {novo_total_produtos:.2f} | Novo Total Nota: R$ {novo_vnf:.2f}"
    
    except Exception as e:
        return None, f"Ocorreu um erro no processamento: {str(e)}"

# Interface da Aplicação
st.title("Ferramenta de Correção e Recálculo de NFe")
st.write("Faça o upload do XML que precisa ser corrigido e informe o novo valor desejado para os produtos.")

uploaded_file = st.file_uploader("Selecione o arquivo XML da NFe", type=['xml'])
novo_valor = st.number_input("Novo Total de Produtos (R$)", min_value=0.01, value=130990.48, step=100.00, format="%.2f")

if uploaded_file is not None:
    if st.button("Processar XML", type="primary"):
        # Ler o arquivo submetido
        xml_string = uploaded_file.getvalue().decode("utf-8")
        
        # Processar
        xml_processado, mensagem = processar_xml(xml_string, novo_valor)
        
        if xml_processado:
            st.success(mensagem)
            
            # Botão de download
            st.download_button(
                label="📥 Baixar XML Corrigido",
                data=xml_processado,
                file_name=f"Corrigido_{uploaded_file.name}",
                mime="application/xml"
            )
        else:
            st.error(mensagem)
