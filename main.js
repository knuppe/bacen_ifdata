const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const downloadPath = path.join(__dirname, 'ifdata');
const fileDados = path.join(downloadPath, 'dados.csv');

// timeout que a rotina espera o site do bacen carregar, realmente precisa de 
// um valor grande, por que durante o dia é comum ter que esperar minutos para
// carregar os dados.
const defaultTimeout = 60000 * 5;

// por padrão o programa verifica somente a quantidade de datas que estão
// configuradas nesta constante, se quiser baixar tudo do site, só colocar 
// um valor bem elevado aqui!
const maxDatasVerificadas = 8;

(async () => {
    if (!dirExist(downloadPath)) {
        fs.mkdirSync(downloadPath);
    }
    const browser = await puppeteer.launch({
        headless: false
    });

    const page = await browser.newPage();
    await page.goto('https://www3.bcb.gov.br/ifdata/index.html');

    // Hack: configura o local de download dos dados, puppeteer não tem API para lidar com isso
    //       então acessamos objetos internos e mandamos um comando para interface do chrome para
    //       definir o download behavior.
    await page._client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath,
    });

    var dataOpen = false; // flags que indicam se os combos estão abertos na página
    var tipoOpen = false;
    var relaOpen = false;

    // carrega as datas disponíveis, primeira interação com a pagina o site do bacen carrega os dados...
    await page.click(`button#btnDataBase`);
    dataOpen = true;

    // espera carregar os dados
    await page.waitForSelector('#ulDataBase > li', { visible: true, timeout: defaultTimeout });

    var datas = [];
    {
        const nodes = await page.$$(`#ulDataBase > li`);
        for (let i = 0; i < nodes.length; i++) {
            const text = await nodes[i].evaluate(e => e.innerText);
            datas.push([i + 1, text]);
        }
    }

    var datasVerificadas = maxDatasVerificadas;
    while (datas.length && --datasVerificadas >= 0) {
        const data = datas.shift();

        if (!dataOpen) {
            await page.click('button#btnDataBase');
            dataOpen = true;
        }

        await page.click(`#ulDataBase > li:nth-child(${data[0]})`, {
            visible: true
        });
        dataOpen = false;

        await page.waitForTimeout(300);

        // tipos
        var tipos = [];
        {
            await page.click('button#btnTipoInst');
            tipoOpen = true;

            const nodes = await page.$$(`#ulTipoInst > li`);
            for (let i = 0; i < nodes.length; i++) {
                const text = await nodes[i].evaluate(e => e.innerText);
                tipos.push([i + 1, text]);
            }
        }

        while (tipos.length) {
            const tipo = tipos.shift();

            if (!tipoOpen) {
                await page.click('button#btnTipoInst');
                tipoOpen = true;
            }

            await page.click(`#ulTipoInst > li:nth-child(${tipo[0]})`, {
                visible: true
            });
            tipoOpen = false;

            await page.waitForTimeout(300);

            // relatórios

            var relatorios = [];
            {
                await page.click('button#btnRelatorio');
                relaOpen = true;

                const nodes = await page.$$(`#ulRelatorio > li`);
                for (let i = 0; i < nodes.length; i++) {
                    const text = await nodes[i].evaluate(e => e.innerText);
                    relatorios.push([i + 1, text]);
                }
            }

            while (relatorios.length) {
                const relatorio = relatorios.shift();

                if (!relaOpen) {
                    await page.click('button#btnRelatorio');
                    relaOpen = true;
                }

                const yyyymm = data[1].substr(3, 4) + data[1].substr(0, 2);
                const fileName = path.join(downloadPath, yyyymm + '_' + normalizaTexo(tipo[1]) + '_' + normalizaTexo(relatorio[1]) + '.csv');

                if (!fileExist(fileName)) {
                    try {
                        fs.unlinkSync(fileDados);
                    } catch { }
                    
                    // seleciona o relatório no combo
                    await page.click(`#ulRelatorio > li:nth-child(${relatorio[0]})`, {
                        visible: true
                    });
                    relaOpen = false;
   
                    // espera o export aparecer na rela e clica nele..
                    const csv = await page.waitForSelector("a#aExportCsv", {
                        visible: true,
                        timeout: defaultTimeout
                    });
                    await csv.click();

                    // como eles salvam o arquito via blob, é praticamente instantâneo, mas coloquei 
                    // 1 segundo para "garantir" que o "download" tenha completado.
                    await page.waitForTimeout(1000);

                    if (fileExist(fileDados)) {
                        processaDownload(fileName);
                    } else {
                        console.error(`Não foi possível localizar o arquivo: ${fileDados}`);
                    }
                }
            }
        }
    }

    console.log("Done");

    await browser.close();
})();

function processaDownload(outputFile) {
    try {
        const csv = fs.readFileSync(fileDados, { 'encoding': 'utf8' });
        const lines = csv.split('\r\n');
        var count = 0;

        if (lines.length > 6) {
            const header = lines[0].split(';');

            // Hack: Além dos programadores que fizeram o site do bacen não seguirem o formato padrão de CSV,
            //       eles tiveram a brilhante ideia de colocar agupamentos de headers dentro do CSV, o que faz
            //       com que o título da coluna no CSV estar na primeira linha OU na terceira, dependendo da
            //       quantidade de agrupamentos que os cabeçalhos possuem... aqui lido com essa aberração! :/
            var start = 1;
            for (var r = 1; r < 6; r++) {
                const c = lines[r].split(';');
                if (c[0] == '') {
                    start++;
                } else {
                    break
                }
            }
            if (start > 1) {
                for (var c = 0; c < header.length - 1; c++) {
                    if (header[c] == '' || header[c + 1] == '') {
                        for (let r = start - 1; r > 0; r--) {
                            const cols = lines[r].split(';');
                            if (cols.length > c && cols[c] != '') {
                                header[c] = cols[c];
                                break
                            }
                        }
                    }
    
                }
            }
            // paramos de lidar com a aberração...
    
            const file = fs.createWriteStream(outputFile, { encoding: 'utf8' });
    
            file.write(`${header.join(';')}\r\n`);
            try {
                for (let line = start; line < lines.length; line++) {
                    if (lines[line].split(';').length != header.length - 1) {
                        // quando a quantidade de colunas dentro da linha é diferente dos headers, 
                        // é por que chegamos nos rodapés do CSV, onde eles colocam informações de 
                        // agrupamentos, fugindo do padrão, então ignoramos o resto de "lixo"
                        break;
                    }

                    // remove os NI/NA/NA% dos campos numéricos
                    const data = lines[line].replace(/;N[IA][%]*(?=[;|\n])/g, ';');

                    file.write(`${data}\r\n`);
                    count++;
                }
            } catch (e) {
                console.error(`write file error: ${e}`);
            } finally {
                // console.log(`Write ${count} rows in ${outputFile}`);
                file.end()
            }
        } else {
            console.error('O arquivo baixado não contem registros');
        }
    } catch (e) {
        console.log(`erro no tratamento do arquivo: ${e}`);
    } finally {
        try {
            fs.unlinkSync(fileDados);
        } catch { }
    }
}
function dirExist(fileName) {
    try {
        return fs.statSync(fileName).isDirectory();
    } catch {
        return false;
    }
}
function fileExist(fileName) {
    try {
        return fs.statSync(fileName).isFile();
    } catch {
        return false;
    }
}
function normalizaTexo(str) {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s+]/g, '_')
        .toLowerCase()
        ;
}