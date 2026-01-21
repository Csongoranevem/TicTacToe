const socket = io();

// Lazy DOM lookup helper
function getInputFields() {
    return {
        RoomIDField: document.getElementById('RoomID'),
        playerNameField: document.getElementById('playerName'),
        joinForm: document.getElementById('joinForm')
    };
}

let currentGameID = null;
let currentPlayerName = null;
let gamePlayers = [];
let hasRejoined = false;
let prevGameID = null;

function GenerateRandomRoom6characters() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function fillRandomRoomID() {
    const { RoomIDField } = getInputFields();
    if (RoomIDField) RoomIDField.value = GenerateRandomRoom6characters();
}

function joinGame(event) {
    event.preventDefault();
    const { RoomIDField, playerNameField } = getInputFields();
    if (!RoomIDField || !playerNameField) { alert('Frissítsd az oldalt, mezők nem elérhetők.'); return; }

    const playerName = playerNameField.value.trim();
    const roomID = RoomIDField.value.trim();
    if (!playerName || !roomID) { alert('Kérlek töltsd ki az összes mezőt!'); return; }

    currentGameID = roomID;
    currentPlayerName = playerName;

    sessionStorage.setItem('gameID', roomID);
    sessionStorage.setItem('playerName', playerName);

    socket.emit('join', { playerName, roomID });
    showGameFragment();
}

function leaveGame(event) {
    if (event) event.preventDefault();
    socket.emit('leaveRoom', { roomID: currentGameID, playerName: currentPlayerName });
    try { socket.disconnect(); } catch (e) {}
    hideGameFragment();
}

function createGameFragment() {
    const wrapper = document.createElement('div');
    wrapper.id = 'gameWrapper';
    wrapper.className = 'd-flex flex-column align-items-center mx-auto gameContainer';
    wrapper.style.display = 'flex';

    // empty gameID div (matches provided HTML)
    const gameIDDiv = document.createElement('div');
    gameIDDiv.className = 'gameID';
    wrapper.appendChild(gameIDDiv);

    // players section
    const playersDiv = document.createElement('div');
    playersDiv.className = 'players';
    const playersH3 = document.createElement('h3');
    playersH3.textContent = 'Játékosok';
    playersDiv.appendChild(playersH3);
    const playerList = document.createElement('div');
    playerList.id = 'playerList';
    const p1 = document.createElement('div'); p1.id = 'player1'; p1.textContent = 'Várakozás...';
    const p2 = document.createElement('div'); p2.id = 'player2'; p2.textContent = 'Várakozás...';
    playerList.appendChild(p1); playerList.appendChild(p2);
    playersDiv.appendChild(playerList);
    wrapper.appendChild(playersDiv);

    // current turn
    const currentTurnDiv = document.createElement('div'); currentTurnDiv.className = 'currentTurn';
    const currentTurnH3 = document.createElement('h3'); currentTurnH3.textContent = 'Aktuális kör';
    const currentPlayerDiv = document.createElement('div'); currentPlayerDiv.id = 'currentPlayer'; currentPlayerDiv.className = 'text-center'; currentPlayerDiv.textContent = '1. Játékos';
    currentTurnDiv.appendChild(currentTurnH3); currentTurnDiv.appendChild(currentPlayerDiv);
    wrapper.appendChild(currentTurnDiv);

    // game space + board with prefilled tiles (I and O) matching provided HTML
    const gameSpace = document.createElement('div'); gameSpace.className = 'gameSpace mx-auto';
    const board = document.createElement('div'); board.id = 'gameBoard'; board.className = 'd-flex flex-wrap'; board.style.width = '400px'; board.style.height = '400px';

    for (let i = 1; i <= 9; i++) {
        const tile = document.createElement('div');
        tile.className = 'tile b' + i;
        board.appendChild(tile);
    }

    gameSpace.appendChild(board);
    wrapper.appendChild(gameSpace);

    // result banner (hidden until game over)
    const resultBanner = document.createElement('div');
    resultBanner.id = 'gameResultBanner';
    resultBanner.style.display = 'none';
    resultBanner.style.marginTop = '12px';
    wrapper.appendChild(resultBanner);

    // game-bottom
    const gameBottom = document.createElement('div');
    gameBottom.className = 'game-bottom mt-3 text-center';
    const roomH3 = document.createElement('h3');
    roomH3.innerHTML = 'Szoba ID: <span id="gameIDDisplay">---</span>';
    gameBottom.appendChild(roomH3);

    const exitForm = document.createElement('form');
    exitForm.onsubmit = function(e) { leaveGame(e); };
    const exitBtn = document.createElement('button'); exitBtn.type = 'submit'; exitBtn.className = 'btn btn-danger'; exitBtn.textContent = 'Kilépés';
    exitForm.appendChild(exitBtn);
    gameBottom.appendChild(exitForm);
    // restart container (populated after round ends)
    const restartContainer = document.createElement('div');
    restartContainer.id = 'restartContainer';
    restartContainer.style.marginTop = '8px';
    gameBottom.appendChild(restartContainer);
    wrapper.appendChild(gameBottom);

    return wrapper;
}

function showGameFragment() {
    const { joinForm } = getInputFields();
    if (joinForm) joinForm.style.display = 'none';
    let gw = document.getElementById('gameWrapper');
    if (!gw) {
        gw = createGameFragment();
        const { joinForm } = getInputFields();
        if (joinForm && joinForm.parentNode) joinForm.parentNode.insertBefore(gw, joinForm.nextSibling);
        else document.body.appendChild(gw);
    } else gw.style.display = 'flex';
    updateGameDisplay();
}

function hideGameFragment() {
    const gw = document.getElementById('gameWrapper');
    const { joinForm } = getInputFields(); if (joinForm) joinForm.style.display = '';
    if (gw && gw.parentNode) gw.parentNode.removeChild(gw);
    sessionStorage.removeItem('gameID'); sessionStorage.removeItem('playerName'); sessionStorage.removeItem('players');
    currentGameID = null; currentPlayerName = null; gamePlayers = []; hasRejoined = false; prevGameID = null;
}

function updateGameDisplay() {
    const gameID = sessionStorage.getItem('gameID');
    const playerName = sessionStorage.getItem('playerName');
    const playersData = sessionStorage.getItem('players');

    if (prevGameID !== gameID) hasRejoined = false;
    prevGameID = currentGameID; currentGameID = gameID; currentPlayerName = playerName;
    if (playersData) gamePlayers = JSON.parse(playersData);

    const gameIDElem = document.getElementById('gameIDDisplay');
    const p1 = document.getElementById('player1'); const p2 = document.getElementById('player2');
    if (gameIDElem) {
        gameIDElem.textContent = gameID || '---';
        if (gamePlayers && gamePlayers.length >= 2) {
            if (p1) p1.textContent = gamePlayers[0].name;
            if (p2) p2.textContent = gamePlayers[1].name;
        } else if (playerName) {
            if (p1) p1.textContent = playerName;
            if (p2) p2.textContent = 'Várakozás...';
        }

        if (gameID && playerName && !hasRejoined) {
            socket.emit('rejoinRoom', { roomID: gameID, playerName });
            hasRejoined = true;
        }
    }
}

function renderBoard(board) {
    const boardEl = document.getElementById('gameBoard');
    if (!boardEl) return;
    boardEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const tile = document.createElement('div');
        tile.className = 'tile b' + (i+1);
        tile.dataset.index = i;
        const val = board[i];
        if (val) {
            tile.textContent = val;
            tile.classList.add('symbol');
            tile.classList.add(val === 'X' ? 'sym-x' : 'sym-o');
            tile.style.cursor = 'default';
        } else {
            tile.textContent = '';
            tile.classList.remove('symbol', 'sym-x', 'sym-o');
            tile.style.cursor = 'pointer';
        }
        tile.addEventListener('click', () => {
            const pn = sessionStorage.getItem('playerName');
            if (!pn) return;
            socket.emit('makeMove', { roomID: currentGameID, index: i, playerName: pn });
        });
        boardEl.appendChild(tile);
    }
}

socket.on('playerJoined', (data) => {
    if (!data) return;
    sessionStorage.setItem('gameID', data.roomID);
    sessionStorage.setItem('playersCount', data.playersInRoom);
    showGameFragment();
});

socket.on('playerUpdate', (data) => {
    if (data && data.players) {
        sessionStorage.setItem('players', JSON.stringify(data.players));
        gamePlayers = data.players;
        updateGameDisplay();
    }
});

socket.on('gameStart', (data) => {
    if (!data) return;
    sessionStorage.setItem('gameID', data.roomID);
    sessionStorage.setItem('players', JSON.stringify(data.players || []));
    gamePlayers = data.players || [];
    showGameFragment();
    if (data.gameState && data.gameState.board)
        {
            renderBoard(data.gameState.board);
        }
    const rc = document.getElementById('restartContainer'); if (rc) rc.innerHTML = '';
    const banner = document.getElementById('gameResultBanner'); if (banner) { banner.style.display = 'none'; banner.textContent = ''; }
});

socket.on('gameState', (data) => {
    if (!data) return;
    if (data.board) renderBoard(data.board);
    if (typeof data.currentTurn === 'number') {
        const cur = document.getElementById('currentPlayer');
        if (cur && gamePlayers && gamePlayers[data.currentTurn]) cur.textContent = gamePlayers[data.currentTurn].name + ' következik';
    }
});

socket.on('gameOver', (data) => {
    if (!data) return;
    renderBoard(data.board || Array(9).fill(null));
    const banner = document.getElementById('gameResultBanner');
    if (banner) {
        if (data.outcome === 'draw') {
            banner.textContent = 'Döntetlen!';
        } else if (data.outcome === 'win') {
            const winner = data.winnerName || data.symbol || 'Győztes';
            banner.textContent = 'Győzött: ' + winner;
        }
        banner.style.display = 'block';
    }
    const rc = document.getElementById('restartContainer');
    if (rc) {
        rc.innerHTML = '';
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.textContent = 'Újraindít';
        btn.onclick = function() {
            socket.emit('restartGame', { roomID: currentGameID });
        };
        rc.appendChild(btn);
    }
});

socket.on('playerLeft', () => {
    alert('Az ellenfél elhagyta a játékot.');
    hideGameFragment();
});


socket.on('errorMessage', (m) => {
    if (!m) return;
    const banner = document.getElementById('gameResultBanner');
    if (banner) {
        banner.textContent = m;
        banner.style.display = 'block';
        banner.style.backgroundColor = 'var(--accent)';
    } else {
        alert(m);
    }
    setTimeout(() => {
        const banner = document.getElementById('gameResultBanner');
        if (banner) {
            banner.style.display = 'none';
            banner.textContent = '';
        }
    }, 3000);
});

window.addEventListener('load', () => {
    setTimeout(() => {
        updateGameDisplay();
        const gameID = sessionStorage.getItem('gameID');
        const playerName = sessionStorage.getItem('playerName');
        if (gameID && playerName) socket.emit('requestRoomState', { roomID: gameID, playerName });
    }, 100);
});
