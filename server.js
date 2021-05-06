var awsIot = require('aws-iot-device-sdk');
const express = require('express'); // Bilioteca para criar um servidor
const app = express();
const bodyParser = require('body-parser'); // Usado para obter os dados da hora e dia da semana no HTML
const fs = require('fs'); // Biblioteca para fazer operações de leitura e escrita


// Template enginer como é chamado.
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(bodyParser.json())

// Definindo as rotas estáticas 
app.use('/views', express.static('/views'))
app.use('/styles', express.static(__dirname + '/styles'))
app.use('/scripts', express.static(__dirname + '/scripts'))


const operationJSON = {
  write(json, data) {
    fs.writeFileSync(`./data/${json}.json`, JSON.stringify(data), 'utf-8')
  },
  read(json) {
    return JSON.parse(fs.readFileSync(`./data/${json}.json`, 'utf-8'))
  },
  delete(positon) {
    let data = this.read('store_Program');
    data.splice(positon, 1);
    this.write('store_Program', data);
  }
}

let statebutton = 0;
const publish = {
  onLamp() {
    if (statebutton == 0) {
      device.publish('lamp', '1'); // Publica ao dispositivo a mensagem para liga a lâmpada
      calculateTime.start();
      statebutton = 1;  // Indica que o botão foi pressionado, evitando que possa ser executada esse bloco de código novamente
    }
  },
  offLamp() {
    if (statebutton == 1) {
      device.publish('lamp', '0'); // Publica ao dispositivo a mensagem para desligar a lâmpada
      calculateTime.end();
      statebutton = 0; // Indica que o botão foi pressionado, evitando que possa ser executada esse bloco de código novamente
    }
  }
}


const calculateTime = {
  start() {
    let initalTime = operationJSON.read('tempos'); //Ler o arquivo e retorna no formato JSON
    let datanow = convertUTC();
    let horario = Date.parse(datanow); // alterar datanow OU "April 24, 2021"
    if (initalTime[0].tempo == 0) {
      initalTime[0].tempo = horario
    }
    operationJSON.write('tempos', initalTime); //Escreve no arquivo com o novo objeto adicionado
  },
  end() {
    let initalTime = operationJSON.read('tempos') //Ler o arquivo e retorna no formato JSON
    if (initalTime[0].tempo != 0) {
      let hour = operationJSON.read('horas') //Ler o arquivo e retorna no formato JSON
      var datanow = convertUTC();
      let hourNow = Date.parse(datanow); // alterar datanow OU "April 24, 2021"
      let month = datanow.getMonth();
      let timeSpent = hour.hora[month] // 
      timeSpent += ((hourNow - initalTime[0].tempo) / 3600000); // Gerar o tempo gasto no intervalo que a lâmpada ficou ligada
      hour.hora[month] = timeSpent
      operationJSON.write('horas', hour) //Escreve no arquivo com o novo objeto adicionado
      initalTime[0].tempo = 0
      operationJSON.write('tempos', initalTime) //Escreve no arquivo com o novo objeto adicionado

    }
  }
}



/*******************************************************************************
 * Obtem os dados da semana e hora e armazena no arquivo store_Program
 */
app.post('/', (req, res) => {
  let day
  let getData = {
    "week": req.body.week,
    "hour": req.body.hour,
    "action": req.body.selectState
  }
  day = operationJSON.read('store_Program') //Ler o arquivo e retorna no formato JSON
  day.push(getData)
  operationJSON.write('store_Program', day) //Escreve no arquivo com o novo objeto adicionado 
  copyJSONProgram();
  return res.redirect('/')
})


// Através do método post usamos para poder enviar um publicação
// Aqui é enviado a publicação para a lâmpada ligar
app.post('/on', (req, res) => {
  publish.onLamp();
  return res.redirect('/') //Após o click no botão de ligar a página é redirecionada própria página principal

})

//Através do método post usamos para poder enviar um publicação 
// Aqui é enviado a publicação para a lâmpada desligar
app.post('/off', (req, res) => {
  publish.offLamp();
  return res.redirect('/')
})

app.post('/delete', (req, res) => {
  operationJSON.delete(parseInt(req.body.positionDelete))
  copyJSONProgram() // Rescrever no arquivo os valores alterando-os para mostrar na tela
  return res.redirect('/');
})



// Certificados, chave e root para a conexão com o AWS IOT Core
var device = awsIot.device({
  keyPath: './private/ef40a3e9cd-private.pem.key',
  certPath: './private/ef40a3e9cd-certificate.pem.crt',
  caPath: './private/AmazonRootCA1.pem',
  clientId: 'testeAWS', // nome da coisa
  host: 'a1elzn2qiibjs7-ats.iot.us-east-1.amazonaws.com'
});


let repeat;
function runProgram() {
  let time = 1000;
  let date = convertUTC();
  let temp = operationJSON.read('store_Program');
  if (temp[0] == null) {} else {
    for (i in temp) {
      let array = temp[i].hour.split(':'); //Retirar os ':' da hora e retora um array com as palavra separadas em cada posição
      if (date.getDay().toString() === temp[i].week) {
        if (date.getHours() == parseInt(array[0]) && date.getMinutes() == parseInt(array[1])) {
          time = 60000
          temp[i].action === '1' ? publish.onLamp() : publish.offLamp();
        } else time = 1000;
      }
    }
  }
  repeat = setTimeout(runProgram, time);
}


/**************************************************************************************************************
 * Através desse metódo post podemos obter os valores dos inputs com o tempo para setar o temporizador
 * 
 */
let timer = 0
let comandLamp
app.post('/timer', (req, res) => {
  timer = (parseInt(req.body.timer) * 60 * 60) + (parseInt(req.body.timer[3] + req.body.timer[4]))
  if (timer > 0) {
    comandLamp = req.body.timerSelect[0]
    setTimeout(() => {
      countTime() // Obtem a primeira letra da palavra l = ligar , d = desliga
    }, 1000)
  }
  return res.redirect('/')
})

//Função que decrementa a váriavel do temporizador
let counting

function countTime() {
  timer -= 1
  counting = setTimeout(countTime, 1000);
  if (timer == 0) {
    comandLamp == 'l' ? publish.onLamp() : publish.offLamp()
    clearTimeout(counting)
  }

}
/************************************************************************************************************** */

//Vetor com os tópicos inscritos
vectorTopic = ['state', 'alive', 'stateLamp']
//Conecta com o AWS IOT e se inscreve nos tópicos
device
  .on('connect', function () {
    console.log('connect');
    device.subscribe(vectorTopic[0]);
    device.subscribe(vectorTopic[1]);
    device.subscribe(vectorTopic[2]);
  })



let data; //Variável para ler o estado da lâmpada dentro do arquivo 
let stateNode = 'Carregando...'
let count = 0

//Função que recebe a publicação sempre que houver uma publicação
device
  .on('message', function (topic, payload) {

    //Verificar se o nodemcu está conectado ao aws recebendo publicações que avisa que está conectado
    if (topic === 'alive') {
      count = 0; // Zerar o contado para que possa mater a informação de que o Node MCU está conectado
      stateNode = 'Online' //variável usada para mostrar o estado do node em tela
    }
    if (topic === 'stateLamp') {
      let getStateLamp = payload.toString();
      if (getStateLamp === 'l') {
        calculateTime.start(); //Função que inicia a contagem do tempo para ser calculado posteriomente os watts hora e o custo
        statebutton = 1;
      } else {
        statebutton = 0;
        calculateTime.end(); //Função que para a contagem do tempo para calcular o watts hora e custo  
      }
      const update = {
        state: getStateLamp
      }
      operationJSON.write('state', update); //Escrever o estado da lâmpada recebida na publicação
    }
  });


/**
 *Contagem para identificar se o Node MCU está conectado ou desconectado.
 * Quando a decorrido o tempo de no máximo 15 segundo se não houver publicção do Node MCU é atribuida à variável 
 * o valor de offline que é mostrado na interface
 */
setInterval(function () {
  count += 1

  if (count > 20) {
    count = 0;
    stateNode = 'Offline';
    calculateTime.end();
  }
}, 1000)
setTimeout(() => {
  //colocar a funcao de verificar se é o dia posterior ou nao para poder executar só uma vez
}, 10)



function copyJSONProgram() {
  let read = operationJSON.read('store_Program');
  let dayWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  for (i in read) {
    read[i].week = dayWeek[read[i].week];
    read[i].action === '1' ? read[i].action = 'Ligar' : read[i].action = 'Desligar';
  }
  operationJSON.write('copy_Program', read);
}


function convertUTC() {
  return new Date(new Date().getTime() - 180 * 60 * 1000)
}


const wattsLamp = 10;

/**
 * Essas variáveis estão sendo sempre alteradas. No text é mostrado o estado do Node MCU, text2 o estado da lâmpada
 * e no text3 é resultado do temporizado que está decrementando 
 */
app.get('/', (req, res) => {
  data = operationJSON.read('state'); // Ler o arquivo JSON com o estado da lâmpada
  let hour = operationJSON.read('horas'); //Ler o arquivo e retorna no formato JSON
  let dataCopy = operationJSON.read('copy_Program');
  res.render("../views/index", {
    showData: dataCopy,
    text: stateNode,
    text2: data.state,
    texto3: timer,
    hr0: (hour.hora[0] * wattsLamp).toFixed(2),
    vl0: (hour.hora[0] * 0.003).toFixed(6),
    hr1: (hour.hora[1] * wattsLamp).toFixed(2),
    vl1: (hour.hora[1] * 0.003).toFixed(6),
    hr2: (hour.hora[2] * wattsLamp).toFixed(2),
    vl2: (hour.hora[2] * 0.003).toFixed(6),
    hr3: (hour.hora[3] * wattsLamp).toFixed(2),
    vl3: (hour.hora[3] * 0.003).toFixed(6),
    hr4: (hour.hora[4] * wattsLamp).toFixed(2),
    vl4: (hour.hora[4] * 0.003).toFixed(6),
    hr5: (hour.hora[5] * wattsLamp).toFixed(2),
    vl5: (hour.hora[5] * 0.003).toFixed(6),
    hr6: (hour.hora[6] * wattsLamp).toFixed(2),
    vl6: (hour.hora[6] * 0.003).toFixed(6),
    hr7: (hour.hora[7] * wattsLamp).toFixed(2),
    vl7: (hour.hora[7] * 0.003).toFixed(6),
    hr8: (hour.hora[8] * wattsLamp).toFixed(2),
    vl8: (hour.hora[8] * 0.003).toFixed(6),
    hr9: (hour.hora[9] * wattsLamp).toFixed(2),
    vl9: (hour.hora[9] * 0.003).toFixed(6),
    hr10:(hour.hora[10] * wattsLamp).toFixed(2),
    vl10:(hour.hora[10] * 0.003).toFixed(6),
    hr11:(hour.hora[11] * wattsLamp).toFixed(2),
    vl11:(hour.hora[11] * 0.003).toFixed(6)
  })
})



/***************************** Chamada das funções *************************/
runProgram();
copyJSONProgram();
/**************************************************************************/


app.listen(process.env.PORT || 3000); //Definido a porta padrão do servidor