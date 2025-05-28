const SIZE = 10;
const SHIPS = [5, 4, 3, 3, 2]; //lunghezze delle navi
const TOTAL_SEGMENTS = SHIPS.reduce((sum, len) => sum + len, 0);

let piazzateShips = 0;
let draggedShip = null;
let playerGrid, compGrid, playerSegments, compSegments;

let seconds = 0;
let shots = 0;
let timerInterval = null;

//per la difficoltà
let difficulty = 'easy';
const difficultySelect = document.getElementById('difficulty');
difficultySelect.addEventListener('change', () => {
  difficulty = difficultySelect.value;
});
let lastBotHit = null;

//elementi
const fleet = document.getElementById('fleet');
const setupBoard = document.getElementById('player-board');
const startButton = document.getElementById('start');
const setupDiv = document.getElementById('setup');
const playDiv = document.getElementById('play');
const playerBoard = document.getElementById('player-view');
const computerBoard = document.getElementById('computer-view');
const messages = document.getElementById('messages');

const sounds = {
  hit: new Audio('static/Suoni/hit.mp3'),
  miss: new Audio('static/Suoni/miss.mp3'),
  win: new Audio('static/Suoni/win.mp3'),
  lose: new Audio('static/Suoni/lose.mp3'),
};

function startTimer() {
  timerInterval = setInterval(() => {
    seconds++;
    // format mm:ss
    const m = String(Math.floor(seconds/60)).padStart(2,'0');
    const s = String(seconds%60).padStart(2,'0');
    document.getElementById('timer').textContent = `${m}:${s}`;
  }, 1000);
}

//crea spazio per posizionare le navi
function makeBoard(container){
  container.innerHTML = '';
  for(let i = 0; i < SIZE * SIZE; i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.idx = i;
    container.appendChild(cell);
  }
}

makeBoard(setupBoard);
makeBoard(playerBoard);
makeBoard(computerBoard);

//drag & drop delle navi
fleet.querySelectorAll('.ship').forEach(ship => {
  ship.addEventListener('dragstart', e => {
    draggedShip = ship;
  });
});

setupBoard.addEventListener('dragover', e => {
  e.preventDefault();
  if(e.target.classList.contains('cell')){
    e.target.classList.add('over');
  }
});

setupBoard.addEventListener('dragleave', e => {
  if(e.target.classList.contains('cell')){
    e.target.classList.remove('over');
  }
});

setupBoard.addEventListener('drop', e => {
  e.preventDefault();
  const cell = e.target;
  if(!cell.classList.contains('cell')){
    return;
  }

  const idx = +cell.dataset.idx;
  const len = +draggedShip.dataset.length;
  const row = Math.floor(idx / SIZE);
  const col = idx % SIZE;

  //piazza orizzontalmente
  if(col + len > SIZE){
    return;
  }
  //controllo collisioni
  for(let off = 0; off < len; off++){
    const c = setupBoard.children[idx + off];
    if(c.classList.contains('filled')){
      return;
    }
  }
  //segna le celle
  for(let off = 0; off < len; off++){
    setupBoard.children[idx + off].classList.add('filled');
  }
  draggedShip.remove();
  piazzateShips++;
});

//inizio del game
startButton.addEventListener('click', () => {
  startTimer();
  if(piazzateShips < SHIPS.length){
    alert('Posiziona tutte le navi prima di iniziare!');
    return;
  }
  setupDiv.remove();
  playDiv.classList.remove('hidden');
  initGame();
});

//gioco vero e proprio
function initGame(){
  messages.textContent = '';
  playerGrid = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => ({ ship: false, hit: false }))
  );
  compGrid = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => ({ ship: false, hit: false }))
  );

  //copia posizioni dal setupBoard
  for(let i = 0; i < SIZE * SIZE; i++){
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    if(setupBoard.children[i].classList.contains('filled')){
      playerGrid[r][c].ship = true;
    }
  }

  placeCompShips();
  playerSegments = compSegments = TOTAL_SEGMENTS;
  renderBoard(playerBoard, playerGrid, false);
  renderBoard(computerBoard, compGrid, true);
}

//posiziona le navi del computer (lo fa casualmente)
function placeCompShips(){
  SHIPS.forEach(len => {
    let placed = false;
    while(!placed){
      //scegli riga e colonna di inizio
      const row = Math.floor(Math.random() * SIZE);
      const col = Math.floor(Math.random() * (SIZE - len + 1));
      
      //controllo sovrapposizione
      let spaceFree = true;
      for(let offset = 0; offset < len; offset++){
        if(compGrid[row][col + offset].ship){
          spaceFree = false;
          break;
        }
      }
      if(!spaceFree){
        //riprova con nuova posizione casuale
        continue;
      }

      //piazza la nave
      for(let offset = 0; offset < len; offset++){
        compGrid[row][col + offset].ship = true;
      }
      placed = true;
    }
  });
}


//renderizza un campo da gioco (isEnemy=true abilita il click per sparare)
function renderBoard(container, grid, isEnemy){
  container.innerHTML = '';
  grid.flat().forEach((cell, idx) => {
    const div = document.createElement('div');
    div.className = 'cell';
    if(cell.hit){
      div.classList.add(cell.ship ? 'colpita' : 'acqua');
    }
    else if(!isEnemy && cell.ship){
      div.classList.add('filled');
    }
    if(isEnemy && !cell.hit){
      div.addEventListener('click', () => playerShoot(idx));
    }
    container.appendChild(div);
  });
}

//gestione del colpo del giocatore
function playerShoot(idx){
  shots++;
  document.getElementById('shots').textContent = `Colpi: ${shots}`;
  const r = Math.floor(idx / SIZE);
  const c = idx % SIZE;
  const cell = compGrid[r][c];
  if(cell.hit){
    return;
  }
  cell.hit = true;
  if(cell.ship){
    compSegments--;
    sounds.hit.currentTime = 0;
    sounds.hit.play();
    messages.textContent = 'Colpito!💥';
  }
  else{
    sounds.miss.currentTime = 0;
    sounds.miss.play();
    messages.textContent = 'Acqua!🌊';
  }
  renderBoard(computerBoard, compGrid, true);
  if(compSegments === 0){
    festeggiamenti();
    return endGame('Hai vinto!🎉');
  }
  setTimeout(botTurn, 1000);
}

function botTurn(){
  if(difficulty === 'easy' || !lastBotHit){
    randomShot();
  }
  else{
    smartShot();
  }
}

function randomShot(){
  let r, c;
  //trova una cella non ancora colpita
  do{
    r = Math.floor(Math.random() * SIZE);
    c = Math.floor(Math.random() * SIZE);
  }while(playerGrid[r][c].hit);

  //simula il colpo
  playerGrid[r][c].hit = true;
  if(playerGrid[r][c].ship){
    playerSegments--;
    sounds.hit.currentTime = 0;
    sounds.hit.play();
    messages.textContent = 'Il computer ha colpito!💥';
    //la memorizza per la hard
    lastBotHit = { x: c, y: r };
  }
  else{
    sounds.miss.currentTime = 0;
    sounds.miss.play();
    messages.textContent = 'Il computer ha fatto acqua!🌊';
    //resetta per la hard
    lastBotHit = null;
  }

  renderBoard(playerBoard, playerGrid, false);
  if(playerSegments === 0){
    endGame('Hai perso😢');
  }
}

function smartShot(){
  const { x, y } = lastBotHit;
  //scegli direzione (a caso) -1 = sinistra, +1 = destra
  const dir = Math.random() < 0.5 ? -1 : 1;
  const newCol = x + dir;

  //se entro bordo e non ancora colpita
  if(newCol >= 0 && newCol < SIZE && !playerGrid[y][newCol].hit){
    // simula il colpo vicino
    playerGrid[y][newCol].hit = true;
    if(playerGrid[y][newCol].ship){
      playerSegments--;
      sounds.hit.currentTime = 0;
      sounds.hit.play();
      messages.textContent = 'Il computer ha colpito!💥';
      //aggiorna lastBotHit su questo nuovo colpo
      lastBotHit = { x: newCol, y: y };
    }
    else{
      sounds.miss.currentTime = 0;
      sounds.miss.play();
      messages.textContent = 'Il computer ha fatto acqua!🌊';
      //dopo un miss torna a hittare random
      lastBotHit = null;
    }

    renderBoard(playerBoard, playerGrid, false);
    if(playerSegments === 0){
      endGame('Hai perso😢');
    }
  }
  else{
    //se fuori o già colpita hitta ancora random
    lastBotHit = null;
    randomShot();
  }
}

//disabilita ulteriori click (quando finisce il gioco ovviamente)
function endGame(msg){
  clearInterval(timerInterval);
  messages.textContent = msg;
  if(msg.includes('Hai vinto!🎉')){
    sounds.win.play();
  }
  else{
    sounds.lose.play();
  }
  const clone = computerBoard.cloneNode(true);
  computerBoard.replaceWith(clone);
}

function festeggiamenti(){
  confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
}