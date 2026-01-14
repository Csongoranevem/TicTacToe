const socket = io();

let RoomIDField = document.getElementById("RoomID");

function GenerateRandomRoom6characters() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}