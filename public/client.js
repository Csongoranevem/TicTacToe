const socket = io();

let RoomIDField = document.getElementById("RoomID");
let playerNameField = document.getElementById("playerName");

let currentGameID = null;
let currentPlayerName = null;
let gamePlayers = [];
let hasRejoined = false;
let prevGameID = null;

function GenerateRandomRoom6characters() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function joinGame(event) {
    event.preventDefault();
    
    const playerName = playerNameField.value.trim();
    const roomID = RoomIDField.value.trim();
    
    if (!playerName || !roomID) {
        alert("Kérlek töltsd ki az összes mezőt!");
        return;
    }
    currentGameID = roomID;
    currentPlayerName = playerName;
    
    // Store in sessionStorage to persist across page navigation
    sessionStorage.setItem('gameID', roomID);
    sessionStorage.setItem('playerName', playerName);
    
    socket.emit('join', {
        playerName: playerName,
        roomID: roomID
    });

    // Immediately show embedded game fragment (no redirect) so socket persists
    showGameFragment();
}

function leaveGame(event) {
    event.preventDefault();
    // leave the room but keep the socket if you want, here we'll fully disconnect
    socket.emit('leaveRoom', { roomID: currentGameID, playerName: currentPlayerName });
    socket.disconnect();
    hideGameFragment();
}

function showGameFragment() {
    const joinForm = document.getElementById('joinForm');
    if (joinForm) joinForm.style.display = 'none';

    // Create game wrapper DOM if it doesn't exist
    let gameWrapper = document.getElementById('gameWrapper');
    if (!gameWrapper) {
        gameWrapper = document.createElement('div');
        gameWrapper.id = 'gameWrapper';
        gameWrapper.className = 'd-flex flex-column align-items-center mx-auto gameContainer';
        gameWrapper.style.display = 'flex';
        gameWrapper.innerHTML = `
            <div class="gameID">
                <h3>Játék ID: <span id="gameIDDisplay">---</span></h3>
            </div>
            <div class="players">
                <h3>Játékosok</h3>
                <div id="playerList">
                    <div id="player1">Várakozás...</div>
                    <div id="player2">Várakozás...</div>
                </div>
            </div>
            <div class="currentTurn">
                <h3>Aktuális kör</h3>
                <div id="currentPlayer" class="text-center">1. Játékos</div>
            </div>
            <div class="gameSpace mx-auto">
                <div id="gameBoard" class="d-flex flex-wrap" style="width: 400px; height: 400px;">
                    <div class="tile b1"></div>
                    <div class="tile b2"></div>
                    <div class="tile b3"></div>
                    <div class="tile b4"></div>
                    <div class="tile b5"></div>
                    <div class="tile b6"></div>
                    <div class="tile b7"></div>
                    <div class="tile b8"></div>
                    <div class="tile b9"></div>
                </div>
            </div>
            <form onsubmit="leaveGame(event)" class="mt-4">
                <button type="submit" class="btn btn-danger">Kilépés</button>
            </form>
        `;

        // Append after the join form
        if (joinForm && joinForm.parentNode) {
            joinForm.parentNode.insertBefore(gameWrapper, joinForm.nextSibling);
        } else {
            document.body.appendChild(gameWrapper);
        }
    } else {
        gameWrapper.style.display = 'flex';
    }

    // Immediately update display
    updateGameDisplay();
}

function hideGameFragment() {
    const gameWrapper = document.getElementById('gameWrapper');
    const joinForm = document.getElementById('joinForm');
    if (joinForm) joinForm.style.display = '';
    if (gameWrapper && gameWrapper.parentNode) {
        // remove the fragment entirely so it can't show before join
        gameWrapper.parentNode.removeChild(gameWrapper);
    }
    // clear session
    sessionStorage.removeItem('gameID');
    sessionStorage.removeItem('playerName');
    sessionStorage.removeItem('players');
    currentGameID = null;
    currentPlayerName = null;
    gamePlayers = [];
    hasRejoined = false;
}

function updateGameDisplay() {
    // Read from sessionStorage
    const gameID = sessionStorage.getItem('gameID');
    const playerName = sessionStorage.getItem('playerName');
    const playersData = sessionStorage.getItem('players');
    
    // Update current variables
    // Reset hasRejoined only when the stored prevGameID differs
    if (prevGameID !== gameID) {
        hasRejoined = false;
    }
    prevGameID = currentGameID;
    currentGameID = gameID;
    currentPlayerName = playerName;
    if (playersData) {
        gamePlayers = JSON.parse(playersData);
    }
    
    const gameIDElement = document.getElementById('gameIDDisplay');
    const player1Element = document.getElementById('player1');
    const player2Element = document.getElementById('player2');
    
    // Only update if on game page (these elements don't exist on join page)
    if (gameIDElement) {
        gameIDElement.textContent = gameID || '---';
        
        console.log('Updating display. gamePlayers:', gamePlayers);
        
        if (gamePlayers && gamePlayers.length >= 2) {
            // Both players have joined
            if (player1Element && gamePlayers[0]) {
                player1Element.textContent = gamePlayers[0].name;
            }
            if (player2Element && gamePlayers[1]) {
                player2Element.textContent = gamePlayers[1].name;
            }
        } else if (playerName) {
            // Only one player (self)
            if (player1Element) {
                player1Element.textContent = playerName;
            }
            if (player2Element) {
                player2Element.textContent = 'Várakozás...';
            }
        }
        
        // Re-join the socket room on game page (only once to avoid loops)
        if (gameID && playerName && !hasRejoined) {
            console.log('Re-joining room (once):', gameID, 'with player:', playerName);
            socket.emit('rejoinRoom', { roomID: gameID, playerName: playerName });
            hasRejoined = true;
        }
    }
}

socket.on('playerJoined', (data) => {
    console.log('Player joined:', data);
    currentGameID = data.roomID;
    gamePlayers = [];
    
    sessionStorage.setItem('gameID', data.roomID);
    sessionStorage.setItem('playersCount', data.playersInRoom);
    
    console.log('Showing game fragment (playerJoined)');
    showGameFragment();
});


socket.on('gameStart', (data) => {
    console.log('Game started:', data);
    currentGameID = data.roomID;
    gamePlayers = data.players;
    
    sessionStorage.setItem('gameID', data.roomID);
    sessionStorage.setItem('players', JSON.stringify(data.players));
    console.log('gameStart stored players:', data.players);
    
    // Update display immediately if already on game page
    showGameFragment();
    updateGameDisplay();
});


socket.on('error', (message) => {
    console.error('Error:', message);
    alert(message);
});


socket.on('playerLeft', () => {
    console.log('Other player left the game');
    alert('Az ellenfél elhagyta a játékot!');
    window.location.href = '/';
});

socket.on('playerUpdate', (data) => {
    console.log('Player update received:', data);
    if (data && data.players) {
        gamePlayers = data.players;
        console.log('gamePlayers updated to:', gamePlayers);
        
        // Update sessionStorage with the players data
        sessionStorage.setItem('players', JSON.stringify(data.players));
        console.log('sessionStorage updated with players');
        
        updateGameDisplay();
    } else {
        console.log('playerUpdate data invalid:', data);
    }
});

window.addEventListener('load', () => {
    // Give socket events time to arrive then request authoritative room state
    setTimeout(() => {
        updateGameDisplay();
        const gameID = sessionStorage.getItem('gameID');
        const playerName = sessionStorage.getItem('playerName');
        if (gameID && playerName) {
            console.log('Requesting room state for', gameID);
            socket.emit('requestRoomState', { roomID: gameID, playerName: playerName });
        }
    }, 100);
});