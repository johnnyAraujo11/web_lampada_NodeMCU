let loop;

function initalState() {
    const stateESP = document.getElementById('stateESP').innerText
    if (stateESP !== 'Online') {
        document.getElementById('on').disabled = true;
        document.getElementById('off').disabled = true;
      
    } else {
        document.getElementById('on').disabled = false;
        document.getElementById('off').disabled = false;
    }
}



function updateValues() {
    let date = new Date(new Date().getTime() - 180 * 60 * 1000);
    const stateLamp = document.getElementById('stateLamp').innerText
    const colorLamp = document.getElementById('lamp')
    const baseLamp = document.getElementById('lamp1')

    // Atualiza os valores do servido na página
    $('#stateESP').load(window.location.href + " " + '#stateESP');
    $('#stateLamp').load(window.location.href + " " + '#stateLamp');
    $('#timerResult').load(window.location.href + " " + '#timerResult')
    $(`#mes${date.getMonth()}`).load(window.location.href + " " + `#mes${date.getMonth()}`)
    $(`#mes${date.getMonth()}value`).load(window.location.href + " " + `#mes${date.getMonth()}value`)

    if (stateLamp === 'l') {
        colorLamp.style.backgroundColor = '#EBCE2A'
        colorLamp.style.boxShadow = " inset 1px 1px 20px #E8E1AB, 0 0 5rem #FAF378, 0 0 50px black"
        baseLamp.style.backgroundColor = '#EBCE2A'

    } else if (stateLamp === 'd') {
        colorLamp.style.backgroundColor = 'gray'
        baseLamp.style.backgroundColor = 'gray'
        colorLamp.style.boxShadow = "1px 1px 50px black"
    }
    initalState() //Desbilitar ou habilita os botões quando desconectado ou iniciando a conexão
    loop = setTimeout(updateValues, 50)
}



// Mostrar ou retirar da tela a parte de programação ao clicar no botão
const Schedule = {
    open() {
        document.querySelector('.schedule-week').classList.add('active')
    },
    close() {
        document.querySelector('.schedule-week').classList.remove('active')
    }
}











// Chamadas da função 
updateValues();