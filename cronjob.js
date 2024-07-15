require("dotenv").config();
const { translate } = require('google-translate-api-browser');
const fs = require("fs");
const Wattpad = require('wattpad.js')
const w = new Wattpad();

const { Client } = require("@notionhq/client");
const notion = new Client({ auth: process.env.NOTION_KEY });

function nomeCapitulo(nome) {
  let cpNome = nome.toLowerCase();
  cpNome = cpNome.replace(". ","-");
  cpNome = cpNome.replace(" ","-");
  return cpNome;
}

(async () => {
  const livroFilhos = [];
  const capitulos = [];
  const imagens = [];

  await w.Stories.detail("360139746").then(res => {
    res.parts.forEach(part => {
      if (part.photoUrl == '') {
        imagens.push('../media/bg.jpg');
      }else {
        imagens.push(part.photoUrl);
      }
    })
    console.log(res.voteCount)
    console.log(res.readCount)
    console.log(res.commentCount)
  })

  //Obter capítulos do livro
  const livro = await notion.blocks.children.list({
    block_id: process.env.NOTION_PAGE_ID,
    page_size: 50,
  });
  livro.results.forEach(element => {
    if (element.type == 'child_page') {
      livroFilhos.push({
        id: element.id,
        name: element.child_page.title
      });
    }
  })

  //Criar sumário de capítulos
  let capList = ""
  let sumList = []
  for (let cc=0;cc<livroFilhos.length;cc++){
    let capLink = `src/pt/${nomeCapitulo(livroFilhos[cc].name)}.html`
    capList += `<li><a href="${capLink}">${livroFilhos[cc].name}</a></li>`
    sumList.push(livroFilhos[cc].name)
  }
  indexData = fs.readFileSync('templates/index.html', 'utf8');
  indexData = indexData.replace("{{capList}}",capList);
  fs.writeFile('index.html',indexData, err => {
    if (err) {
      console.error(err);
    }
  })

  //Obter parágrafos do capítulo
  for (let cc=0;cc<livroFilhos.length;cc++){
    console.log("Buscando capítulo",livroFilhos[cc].name);
    capitulo = {
      id: livroFilhos[cc].id,
      name: livroFilhos[cc].name,
      conteudo: [],
      imagem: imagens[cc + 3]
    }
    lastIt = undefined;
    lastInd = 0;

    //Obter páginas dos capítulos
    while (lastIt != "end" ){
      const cap = await notion.blocks.children.list({
        block_id: livroFilhos[cc].id,
        start_cursor: lastIt,
        page_size: 100,
      });
  
      //Colocar versos do capítulo dentro de objeto.
      let index = 0;
      let skip = 0;
      cap.results.forEach(element => {
        if ((index < 99) && ('numbered_list_item' in element)) {
          let verso = element.numbered_list_item.rich_text[0].plain_text;
          
          //Adicionar formatação para negrito e itálico
          if (element.numbered_list_item.rich_text[0].annotations.bold) {
            verso = "*" + verso + "*";
          }
          if (element.numbered_list_item.rich_text[0].annotations.italic) {
            verso = "_" + verso + "_";
          }
          //Adicionar numeração
          verso = (index + lastInd + 1).toString() + ". " + verso;

          capitulo.conteudo.push(verso)
          index++;
        }else {
          skip++;
        }
      })

      //Se tiver mais versos do que o que a API pôde retornar, mandar consultar de novo
      if (cap.results.length >= 100) {
        lastInd += index;
        lastIt = cap.results[index + skip - 1].id;
      }else {
        lastIt = "end"
      }
    }
    capitulos.push(capitulo);

    //Criar documento HTML para cada capítulo
    const idiomas = ["pt"]//,"en","es","ar"];
    const traducoes = [];
    idiomas.forEach(idioma => {
      if (idioma != 'pt') {
        translate(capitulo.name, {to: idioma}).then(res => {
          traducoes.push("<h2>" + res.text + "</h2>\n");
        }).catch(err => {
            console.error(err);
        });
      }else {
        traducoes.push("<h2>" + capitulo.name + "</h2>\n")
      }
    })

    for (let t of capitulo.conteudo){
      txt = "";
  
      bTag = false;
      iTag = false;
      
      //Formatar de acordo com negrito e/ou itálico
      for (let caractere = 0;caractere<t.length;caractere++) {
        if (t.charAt(caractere) == '*'){
          if (bTag){
            txt += "</b>";
            bTag = false;
          }else {
            txt += "<b>";
            bTag = true;
          }
        }else if (t.charAt(caractere) == '_'){
          if (iTag){
            txt += "</i>";
            iTag = false;
          }else {
            txt += "<i>";
            iTag = true;
          }
        }else if (t.charAt(caractere) == '\n'){
          txt += "<br />";
        }else {
          txt += t.charAt(caractere);
        }
      }
      //Traduzir cada verso
      for (let i=0;i<idiomas.length;i++) {
        if (idiomas[i] != 'pt') {
          translate(txt, {to: idiomas[i]}).then(res => {
              console.log(res);
              traducoes[i] += "        <p>" + res.text + "</p>\n";
          }).catch(err => {
              console.error(err);
          });
        }else {
          traducoes[i] += "        <p>" + txt + "</p>\n";
        }
      }
    }
    
    //Criar arquivo HTML
    let cpNome = nomeCapitulo(capitulo.name);
    cpContent = "";

    //Adicionar informações do template ao documento
    headerData = fs.readFileSync('templates/header.html', 'utf8');
    headerData = headerData.replace("{{pagTitulo}}",capitulo.name);
    headerData = headerData.replace("{{pagImg}}", '../media/bg.jpg');//capitulo.imagem);
    footerData = fs.readFileSync('templates/footer.html', 'utf8');

    //Adicionar link para página anterior
    if (cc > 0)
      footerData = footerData.replace(
        "{{pagAnter}}",
        `<a href="pt/${nomeCapitulo(livroFilhos[cc - 1].name)}.html">Página anterior</a>`)
    else
      footerData = footerData.replace("{{pagAnter}}",'')
    
    //Adicionar link para a próxima página
    if (cc < livroFilhos.length - 1)
      footerData = footerData.replace(
        "{{proxPag}}",
        `<a href="pt/${nomeCapitulo(livroFilhos[cc + 1].name)}.html">Próxima página</a>`)
    else
      footerData = footerData.replace("{{proxPag}}",'')

    //Adicionando sumário de capítulos
    let sumTxt = ""
    for (let ss=0;ss<sumList.length;ss++){
      let capLink = `pt/${nomeCapitulo(sumList[ss])}.html`
      if (livroFilhos[cc].name == sumList[ss])
        sumTxt += `<li><b>-> <a href="${capLink}">${sumList[ss]}</a> <-</b></li>`
      else
        sumTxt += `<li><a href="${capLink}">${sumList[ss]}</a></li>`
    }
    footerData = footerData.replace("{{sumList}}",sumTxt);

    //Recriar os capítulos para cada idioma
    for (let i=0;i<idiomas.length;i++) {
      cpContent += headerData + traducoes[i] + footerData;
      fs.writeFile(`src/${idiomas[i]}/${cpNome}.html`,cpContent, err => {
        if (err) {
          console.error(err);
        }
      })
    }
  }

})();