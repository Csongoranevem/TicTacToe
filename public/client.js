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

    const gameIDElement = document.getElementById('gameIDDisplay');
    if (gameIDElement) {
        gameIDElement.textContent = currentGameID || '---';
    }
    
    const player1Element = document.getElementById('player1');
    const player2Element = document.getElementById('player2');
    
    if (player1Element && gamePlayers[0]) {
        player1Element.textContent = gamePlayers[0].name;
    }
    if (player2Element && gamePlayers[1]) {
        player2Element.textContent = gamePlayers[1].name;
    }
}

socket.on('playerJoined', (data) => {
    console.log('Player joined:', data);
    currentGameID = data.roomID;
    gamePlayers = [];
    window.location.href = '/game';
});


socket.on('gameStart', (data) => {
    console.log('Game started:', data);
    currentGameID = data.roomID;
    gamePlayers = data.players;
    window.location.href = '/game';
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

window.addEventListener('load', updateGameDisplay);