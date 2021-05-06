var awsIot = require('aws-iot-device-sdk');
const express = require('express'); // Bilioteca para criar um servidor
const app = express();
const bodyParser = require('body-parser'); // Usado para obter os dados da hora e dia da semana no HTML
const fs = require('fs'); // Biblioteca para fazer operações de leitura e escrita
const {
  stringify
} = require('querystring');
const {
  Console
} = require('console');


// Template enginer como é chamado.
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(bodyParser.json())

// Definindo as rotas estáticas da aplicação 
app.use('/views', express.static('/views'))
app.use('/styles', express.static(__dirname + '/styles'))
app.use('/scripts', express.static(__dirname + '/scripts'))




// Certificados, chave e root para a conexão com o AWS IOT Core
var device = awsIot.device({
  keyPath: './private/ef40a3e9cd-private.pem.key',
  certPath: './private/ef40a3e9cd-certificate.pem.crt',
  caPath: './private/AmazonRootCA1.pem',
  clientId: 'testeAWS', // nome da coisa
  host: 'a1elzn2qiibjs7-ats.iot.us-east-1.amazonaws.com'
});


const operationJSON = {
  write(json, data) {
    fs.writeFileSync(`./data/${json}.json`, JSON.stringify(data), 'utf-8')
  },
  read(json) {
    return JSON.parse(fs.readFileSync(`./data/${json}.json`, 'utf-8'))
  },
  delete(file,positon) {
    let data = this.read(`${file}`);
    data.splice(positon, 1);
    this.write(`${file}`, data);
  }
}

let statebutton = 0; // Variável que indica o pressionamento do botão.
const publish = {
  onLamp() {
    if (statebutton == 0) {
      device.publish('lamp', '1'); // Publica ao dispositivo a mensagem para liga a lâmpada
      calculateTime.start();
      statebutton = 1; // Indica que o botão foi pressionado, evitando que possa ser executada esse bloco de código novamente
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


/**
 *
 */
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



/**
 * Obtém os dados da semana e hora e armazena no arquivo 'store_Program'
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

//Deleta um programação no arquivo json (state_Program)
app.post('/delete', (req, res) => {
  operationJSON.delete('store_Program',parseInt('store_Program',req.body.positionDelete))
  copyJSONProgram() // Rescrever no arquivo os valores alterando-os para mostrar na tela
  return res.redirect('/');
})




/**
 * Esta função ler o arquivo state_Program que é onde fica a programação que o usuário faz página web
 * e verificar a cada segundo se é o dia da semana e o horário para executar a ação de ligar ou desligar a lâmpada.
 */
let repeat;
let saveStateBefore;

function runProgram() {
  let time = 1000;
  let date = convertUTC();
  let temp = operationJSON.read('store_Program');
  let stateBefore = operationJSON.read('state'); //Obter do arquivo estado atua da lâmpada
  
  
  if (temp[0] == null) {} else {
    for (i in temp) {
      let array = temp[i].hour.split(':'); //Retirar os ':' da hora e retorna um array com as palavra separadas em cada posição(exemplo: ['22','50'])
      if (date.getDay().toString() === temp[i].week) {
        if (date.getHours() == parseInt(array[0]) && date.getMinutes() == parseInt(array[1])) {
          saveStateBefore = stateBefore.state
          time = 60000 //Caso entre nesse escopo muda o tempo que a função irá executar na execução seguinte

          temp[i].action === '1' ? publish.onLamp() : publish.offLamp()

          let readWait = operationJSON.read('wait');
          setTimeout(() => {
            let stateNow = operationJSON.read('state') //Ler o arquivo depois que houve a alteração do estado da lâmpada
            if (temp[i].action === '1' && stateBefore.state === 'd' && stateNow.state === 'd') {
              readWait.push(temp[i])
              operationJSON.write('wait', readWait)
              console.log("estippo")
              

            } else if (temp[i].action === '0' && stateBefore.state === 'l' && stateNow.state === 'l') {
              readWait.push(temp[i])
              operationJSON.write('wait', readWait)
              console.log("cabruncro")
            }
          }, 1000);
        } else time = 1000;
      }
    }
  }
  repeat = setTimeout(runProgram, time);
}
/**
 * Esta função guardar a programação quando ocorre uma desconexão do  node MCU com a internet ela publicando até que 
 * o dado do arquivo 'state.json' mude, pois a programação não ocorreu. Quando o node mcu conectar à internet é publicado a ação que 
 * deveria ter acontecido. O objetivo principal é a instabilidade da internet.
 * */


let readJson
function wait() {
  readJson = operationJSON.read('wait')
  console.log("ddddddddd: " + saveStateBefore)
  let stateLamp = operationJSON.read('state');
  console.log(readJson)
  console.log(stateLamp)
  console.log(saveStateBefore)

  if (readJson[0] === undefined) {
    console.log("vazio")
  } else {
    if (stateLamp.state === saveStateBefore) {
      readJson[0].action === '1' ? publish.onLamp() : publish.offLamp();
      console.log("dhdhdhd")
    } else {
      console.log("sao diferentes")
      operationJSON.delete('wait', 0);
    }
  }
  setTimeout(wait, 5000);
}



function nulo(){


}
/*******************************************************************************************************************
 * Através desse metódo 'post' podemos obter os valores dos 'inputs' com o tempo para setar o temporizador
 */
let timer = 0
let comandLamp // variável utilizada para poder guardar qual comando irá executar, deligar ou ligar a lâmpada
app.post('/timer', (req, res) => {
  timer = (parseInt(req.body.timer) * 60 * 60) + (parseInt(req.body.timer[3] + req.body.timer[4]))
  if (timer > 0) {
    comandLamp = req.body.timerSelect[0]
    setTimeout(() => {
      countTime(); // Chamada á função que irá decrementar os o tempo escolhido pelo usuário 
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
    clearTimeout(counting) // clearTimeout faz uma limpeza na váriavel selecionada, assim parando a chamada recursiva do código
  }
}
/***************************************************************************************************************/

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

let stateNode = 'Carregando...'
let count = 0


//Função que recebe a publicação sempre que houver uma nova publicação.
device
  .on('message', function (topic, payload) {

    //Verificar se o nodemcu está conectado ao MQTT da AWS Iot Core recebendo publicações que avisa que está conectado
    if (topic === 'alive') {
      console.log("SDDSDD")
      count = 0; // Zerar a váriavel count para que possa mater a informação de que o Node MCU está conectado.
      stateNode = 'Online' //variável usada para mostrar o estado do node na web
    }
    if (topic === 'stateLamp') {
      let getStateLamp = payload.toString(); //Transforma a mesagem em um string.
      if (getStateLamp === 'l') {
        calculateTime.start(); //Função que salva o horário que a a lâmpada ligou.
        statebutton = 1; //Indica que o botão foi pressionado.
      } else {
        statebutton = 0; // Indica que foi pressionado o botão.
        calculateTime.end(); //Função que para a contagem do tempo para calcular o watts hora e custo  
      }
      const update = {
        state: getStateLamp // Atribui ao objeto o estado da lâmpada recebida pela publicação do noce MCU
      }
      operationJSON.write('state', update); //Escrever o estado da lâmpada recebida na publicação
    }
  });


/**
 *Contagem para identificar se o Node MCU está conectado ou desconectado.
 * Quando a decorrido o tempo de no máximo 20 segundo, se não houver publicação do Node MCU é atribuida à variável 
 * o valor de offline, que é mostrado na web.
 */
setInterval(function () {
  count += 1
  if (count > 20) {
    count = 0;
    stateNode = 'Offline';
    calculateTime.end();
  }
}, 1000)

const dayWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Função para reescrever os valores das chaves, week e action, atribuidos um valor semântico para ser mostrado na web
function copyJSONProgram() {
  let read = operationJSON.read('store_Program');
  for (i in read) {
    read[i].week = dayWeek[read[i].week];
    read[i].action === '1' ? read[i].action = 'Ligar' : read[i].action = 'Desligar';
  }
  operationJSON.write('copy_Program', read);
}

/**
 * Função que ajusta o fuso horário para o horário Brasileiro que é GMT -3.
 * Na função o tempo é convertido milisegundos para ser subtraído, gerando o 
 * horário do Brasil.
 */
function convertUTC() {
  return new Date();
  //new Date(new Date().getTime() - 180 * 60 * 1000)
}

// a potência da lâmpada
const wattsLamp = 10;

/**
 * Essas variáveis estão sendo sempre alteradas. No text é mostrado o estado do Node MCU, text2 o estado da lâmpada
 * e no text3 é resultado do temporizado que está decrementando 
 */
app.get('/', (req, res) => {
  let data = operationJSON.read('state'); // Ler o arquivo JSON com o estado da lâmpada
  let hour = operationJSON.read('horas'); //Ler o arquivo e retorna no formato JSON
  let dataCopy = operationJSON.read('copy_Program');
  let aa = operationJSON.read('wait')
  res.render("../views/index", {
    teste: aa,
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
    hr10: (hour.hora[10] * wattsLamp).toFixed(2),
    vl10: (hour.hora[10] * 0.003).toFixed(6),
    hr11: (hour.hora[11] * wattsLamp).toFixed(2),
    vl11: (hour.hora[11] * 0.003).toFixed(6)
  })
})


/***************************** Chamada das funções *************************/
runProgram();
copyJSONProgram();
wait();
/**************************************************************************/

app.listen(process.env.PORT || 3000); //Definido a porta padrão do servidor