const socket = io();

let RoomIDField = document.getElementById("RoomID");
let playerNameField = document.getElementById("playerName");

let currentGameID = null;
let currentPlayerName = null;
let gamePlayers = [];

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

}

function leaveGame(event) {
    event.preventDefault();
    socket.disconnect();
    window.location.href = '/';
}

function updateGameDisplay() {
    // Read from sessionStorage
    const gameID = sessionStorage.getItem('gameID');
    const playerName = sessionStorage.getItem('playerName');
    const playersData = sessionStorage.getItem('players');
    
    // Update current variables
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
        
        // Re-join the socket room on game page
        if (gameID && playerName) {
            console.log('Re-joining room:', gameID, 'with player:', playerName);
            socket.emit('rejoinRoom', { roomID: gameID, playerName: playerName });
        }
    }
}

socket.on('playerJoined', (data) => {
    console.log('Player joined:', data);
    currentGameID = data.roomID;
    gamePlayers = [];
    
    sessionStorage.setItem('gameID', data.roomID);
    sessionStorage.setItem('playersCount', data.playersInRoom);
    
    console.log('Redirecting to game page...');
    window.location.href = '/game';
});


socket.on('gameStart', (data) => {
    console.log('Game started:', data);
    currentGameID = data.roomID;
    gamePlayers = data.players;
    
    sessionStorage.setItem('gameID', data.roomID);
    sessionStorage.setItem('players', JSON.stringify(data.players));
    console.log('gameStart stored players:', data.players);
    
    // Update display immediately if already on game page
    if (document.getElementById('gameIDDisplay')) {
        updateGameDisplay();
    } else {
        window.location.href = '/game';
    }
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