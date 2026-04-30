# AlterNFe Tools

O **AlterNFe Tools** é uma aplicação web de ferramenta única (Single-Page Tool) desenvolvida em HTML, CSS e Vanilla JavaScript. O seu propósito principal é manipular, corrigir e auditar falhas estruturais ou matemáticas em arquivos XML de Nota Fiscal Eletrônica (NFe), lidando especificamente com bugs oriundos do ecossistema de emissão de um ERP legado (Softshop) acoplado ao seu emissor local (NFeManager).

O projeto é inteiramente *client-side*. O processamento e a varredura das tags XML ocorrem em memória no próprio navegador do usuário, garantindo rapidez e privacidade dos dados da nota. Nenhuma informação é enviada para servidores externos.

## 🛠 Funcionalidades e Ferramentas

O sistema conta com uma interface baseada em abas contendo duas ferramentas dedicadas:

### 1. Rateio e Recálculo NFe
Foi construída para corrigir notas de importação ou reajustes gerais de valor onde os centavos nunca batiam nas plataformas de gestão (ex: bancos de dados Access 2003 que truncam valores ou exigem correspondência matemática estrita). 
* Permite inserir o XML da nota e definir o **Novo Total de Produtos (R$)**.
* O algoritmo aplica uma técnica matemática de busca estocástica/otimização (hill-climbing) limitando as casas decimais de `<vUnCom>` a no máximo 4 casas. 
* Ele garante ao mesmo tempo que:
   - O `<vProd>` de cada item somado gere os R$ 0,00 de diferença em relação ao alvo XML final.
   - O cálculo `(qCom * vUnCom)` global gere os R$ 0,00 de diferença na importação para sistemas legados com cálculos diretos não arredondados (Access 2003).
* Substitui internamente `<vUnCom>`, `<vUnTrib>` e `<vProd>`, formatando as posições originais com Expressões Regulares (Regex) para não quebrar quebras de linha/formatos da tag.

### 2. Divergência de BC ICMS (Caçador de Erros de Arredondamento)
Ferramenta focada em solucionar a rejeição na qualificação do somatório no portal da SEFAZ, gerado por uma falha do **NFeManager**. 
* O emissor frequentemente gera itens onde a tag `<vBC>` localizada dentro do grupo de tributos `<ICMS>` está com 1 a 5 centavos menor/maior que o real total do produto (`<vProd>`), por erro de arredondamento.
* O sistema localiza iterativamente os blocos de imposto ignorando isenções e bases de cálculo reduzidas e compara `vProd` contra `vBC`.
* Se encontra um erro estrito (entre 1 e 5 centavos de diferença), atua cirurgicamente corrigindo a base de cálculo individual.
* Refaz o cálculo e atualiza o totalizador do arquivo (`<total><ICMSTot><vBC>`).
* Emite relatórios (Logs) no painel com todas as correções efetuadas antes de permitir o download.

## 🚀 Como Executar

Por ser em Vanilla JS e não possuir back-end (não existem rotas ou necessidade de node_modules), rodar o projeto é imediato:

1. Clone o repositório ou baixe o arquivo `.zip`.
2. Dê um duplo clique no arquivo `index.html`.
3. O projeto abrirá no seu navegador padrão pronto para uso.

> [!WARNING]  
> **Reassinatura Digital:** Todas as ferramentas modificam fisicamente as *strings* do XML, como os valores de unidade e base de cálculo. Ao baixar o XML de `AlterNFe`, a "DigestValue" ou "Signature" (Assinatura digital padrão SEFAZ) que estiver presente no arquivo será invalidada pelas leis matemáticas da assinatura assimétrica. Você **sempre** precisará re-assinar o XML resultante no seu sistema emissor, validador ou assinador local antes de retransmitir para o webservice estadual.

## 🎨 Arquitetura Front-End

- **Layout e UI/UX:** A interface gráfica adere a temas sofisticados `Dark Mode`, utilizando propriedades de "Glassmorphism" suave, contornos brilhantes e paletas variando em tons pretos (`#050505`) e Azul Royal (`#2563eb`).
- **Engenharia:**
  - `FileReader API` para lidar com upload/drag & drop instantâneo de strings.
  - O processamento de tags é efetuado 100% via **Expressões Regulares** (`Regex`) em vez de conversão para DOM/JSON. Isso ocorre porque conversores XML tendem a reordenar as chaves/tags ou modificar os fechamentos padrão, quebrando a estrutura que sistemas governamentais e de emissão antigos aguardam.
  
## Contribuições

Este repositório foi desenvolvido sob medida para fluxos de validações contábeis e fiscais do ambiente de negócio local, focando em sistemas legados. Quaisquer atualizações de regras matemáticas e refatorações devem tomar extremo cuidado com a lógica Regex.
