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
    capObj = {
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
      cap.results.forEach((element, index) => {
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
          //verso = (index + lastInd + 1).toString() + ". " + verso;

          capObj.conteudo.push(verso)
        }
      })

      //Se tiver mais versos do que o que a API pôde retornar, mandar consultar de novo
      if (cap.results.length >= 100) {
        lastInd += cap.results.length - 1;
        lastIt = cap.results[cap.results.length - 1].id;
      }else {
        lastIt = "end"
      }
    }
    capitulos.push(capObj);
  }

  //Criar arquivo HTML
  let doc = "<ol>";
  for (let t of capitulos[1].conteudo){
    txt = t;
    doc += "<li>" + txt + "</li>\n";
  }
  doc += "</ol>"

  fs.writeFile("teste.html",doc, err => {
    if (err) {
      console.error(err);
    }
  })
})();