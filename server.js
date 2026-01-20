const express = require('express');
const app = express();
let cors = require('cors');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const ejs = require('ejs');
const path = require('path');
const { error } = require('console');
const { emit } = require('cluster');


const ERRORS = {
    MISSING_FIELDS: "Kérlek töltsd ki az összes mezőt!"
}

// Store active games by room ID
const games = {};

app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('main');
});

app.get('/join', (req, res) => {
    res.render('user/join');
});

app.get('/game', (req, res) => {
    res.render('user/game');
});


io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (data) => {
        const { playerName, roomID } = data;


        if (!playerName || !roomID) {
            socket.emit('error', ERRORS.MISSING_FIELDS);
            return;
        }

        if (!games[roomID]) {
            games[roomID] = {
                players: [],
                gameInProgress: false
            };
        }

        if (games[roomID].players.length >= 2) {
            socket.emit('error', 'A szoba megtelt! Már 2 játékos van benne.');
            return;
        }

        games[roomID].players.push({
            id: socket.id,
            name: playerName
        });

        socket.join(roomID);

        console.log(`${playerName} joined room ${roomID}`);

        io.to(roomID).emit('playerJoined', {
            playerName: playerName,
            playersInRoom: games[roomID].players.length,
            roomID: roomID
        });

        if (games[roomID].players.length === 2) {
            io.to(roomID).emit('gameStart', {
                players: games[roomID].players,
                roomID: roomID
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        for (let roomID in games) {
            games[roomID].players = games[roomID].players.filter(p => p.id !== socket.id);

            if (games[roomID].players.length > 0) {
                io.to(roomID).emit('playerLeft');
            }

            if (games[roomID].players.length === 0) {
                delete games[roomID];
            }
        }
    });
});

server.listen(3000, () => {
    console.log(`http://localhost:3000`);
});
