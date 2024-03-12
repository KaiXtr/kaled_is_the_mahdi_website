require("dotenv").config();

const fs = require("fs");
const express = require("express");
const app = express();

const { Client } = require("@notionhq/client");
const notion = new Client({ auth: process.env.NOTION_KEY });

app.use(express.static("public"));

(async () => {
  const livroFilhos = [];
  const capitulos = [];

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

  //Obter parágrafos do capítulo
  for (let cc of livroFilhos){
    console.log("Buscando capítulo",cc.name);
    capitulo = {
      id: cc.id,
      name: cc.name,
      conteudo: []
    }
    lastIt = undefined;
    lastInd = 0;

    //Obter páginas dos capítulos
    while (lastIt != "end" ){
      const cap = await notion.blocks.children.list({
        block_id: cc.id,
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
    let doc = "<h2>" + capitulo.name + "</h2>\n";
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
        }else {
          txt += t.charAt(caractere);
        }
      }
      doc += "        <p>" + txt + "</p>\n";
    }
    
    //Criar arquivo HTML
    let cpNome = capitulo.name.toLowerCase();
    cpNome = cpNome.replace(". ","-");
    cpNome = cpNome.replace(" ","-");
    cpContent = "";

    //Adicionar informações do template ao documento
    headerData = fs.readFileSync('templates/header.html', 'utf8');
    footerData = fs.readFileSync('templates/footer.html', 'utf8');
    cpContent += headerData + doc + footerData;

    //Recriar os capítulos para cada idioma
    const idiomas = ["pt","en","es","ar"];
    idiomas.forEach(idioma => {
      fs.writeFile("src/" + idioma + "/" + cpNome + ".html",cpContent, err => {
        if (err) {
          console.error(err);
        }
      })
    })
  }

})();