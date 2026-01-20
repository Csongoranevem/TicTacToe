const socket = io();

let RoomIDField = document.getElementById("RoomID");
let playerNameField = document.getElementById("playerName");

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

socket.on('playerJoined', (data) => {
    console.log('Player joined:', data);
});


socket.on('gameStart', (data) => {
    console.log('Game started:', data);
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