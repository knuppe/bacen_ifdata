# Bacen IF.data

Programa para extração dos relatórios do site [IF.data](https://www3.bcb.gov.br/ifdata/index.html) do Banco Central do Brasil. 

Em resumo, o programa faz o seguinte:
* Faz o download dos arquivos em csv *(delimitado por ponto e vírgula)*;
* Normgaliza o cabeçalho (arquivo original do bacen possui header com até 3 linhas... ¯\\_(ツ)_/¯ );
* Remove os "NA" (não aplicável) e "NI" (não informado) dos dados numéricos, substituindo por vazio;
* Salva o relatório com um nome mais acessível por scripts de consumo.

O programa não baixa mais de uma vez os dados uma vez que o arquivo de saída já existe.

## Instação

Para instalar  executar o programa de extração é necessário que o [nodejs](https://nodejs.org) esteja instalado e configurado conforme a documentação.

## Passos para utilizar

1. Clonar o repositório no computador local;
2. Instalar as dependências com o comando `npm -i`;
3. Executar o programa `node main.js`
4. O programa vai criar uma pasta no diretório chamada `ifdata` com todos os arquivos .csv extraídos do site.

Nota: O programa não vai tentar extrair mais de uma vez o arquivo caso ele já exista na pasta de dados salvos! \o/

## Importante

* O site do banco central não é muito estável durante o horário comercial, e algumas vezes problemas no site geram erros neste script.

* Este programa foi feito em menos de 2h de trabalho *(para ser sincero levei mais tempo documentando o código e escrevendo esse readme do que programando)*! Então... **use este programa sua conta e risco**.
