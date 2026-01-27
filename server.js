const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const path = require('path');

const ERRORS = {
    MISSING_FIELDS: "Kérlek töltsd ki az összes mezőt!"
};

// In-memory game store
const games = {};
// Map socket.id -> roomID
const socketRooms = {};

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.render('main'));
app.get('/join', (req, res) => res.redirect('/'));
app.get('/game', (req, res) => res.redirect('/'));

app.get('/debug/games', (req, res) => {
    const out = {};
    for (const roomID in games) {
        out[roomID] = {
            players: games[roomID].players.map(p => ({ id: p.id, name: p.name, symbol: p.symbol })),
            board: games[roomID].board,
            currentTurn: games[roomID].currentTurn,
            gameInProgress: games[roomID].gameInProgress
        };
    }
    res.json({ games: out });
});

app.get('/debug/sockets', (req, res) => res.json({ socketRooms }));

// Helpers
function checkGameResult(board) {
    const lines = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];
    for (const [a,b,c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    if (board.every(cell => cell !== null)) return 'draw';
    return null;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (data) => {
        const { playerName, roomID } = data || {};
        if (!playerName || !roomID) {
            socket.emit('errorMessage', ERRORS.MISSING_FIELDS);
            return;
        }

        if (!games[roomID]) {
            games[roomID] = {
                players: [],
                gameInProgress: false,
                board: Array(9).fill(null),
                currentTurn: 0
            };
        }

        if (games[roomID].players.length >= 2) {
            socket.emit('errorMessage', 'A szoba megtelt! Már 2 játékos van benne.');
            return;
        }

        const symbol = games[roomID].players.length === 0 ? 'X' : 'O';
        games[roomID].players.push({ id: socket.id, name: playerName, symbol });
        socketRooms[socket.id] = roomID;
        socket.join(roomID);

        console.log(`${playerName} joined room ${roomID}. players: ${games[roomID].players.map(p=>p.name).join(',')}`);

    // Emit joined notification including the current players array so clients can update immediately
    io.to(roomID).emit('playerJoined', { playerName, playersInRoom: games[roomID].players.length, roomID, players: games[roomID].players });
    io.to(roomID).emit('playerUpdate', { players: games[roomID].players });

        if (games[roomID].players.length === 2) {
            games[roomID].gameInProgress = true;
            games[roomID].board = Array(9).fill(null);
            games[roomID].currentTurn = 0;

            io.to(roomID).emit('gameStart', {
                players: games[roomID].players,
                roomID,
                gameState: { board: games[roomID].board, currentTurn: games[roomID].currentTurn }
            });
        }
    });

    socket.on('rejoinRoom', (data) => {
        const { roomID, playerName } = data || {};
        if (!roomID || !games[roomID]) return;

        const existing = games[roomID].players.find(p => p.name === playerName);
        if (existing) {
            existing.id = socket.id;
        } else {
            const symbol = games[roomID].players.length === 0 ? 'X' : 'O';
            games[roomID].players.push({ id: socket.id, name: playerName, symbol });
        }

    socket.join(roomID);
    socketRooms[socket.id] = roomID;

    // Broadcast the updated players list to the whole room (so everyone sees the rejoined player)
    io.to(roomID).emit('playerUpdate', { players: games[roomID].players });
    // Send the current game state to the rejoined socket only
    socket.emit('gameState', { board: games[roomID].board, currentTurn: games[roomID].currentTurn });
    });

    socket.on('requestRoomState', (data) => {
        const { roomID } = data || {};
        if (!roomID || !games[roomID]) {
            socket.emit('playerUpdate', { players: [] });
            socket.emit('gameState', { board: Array(9).fill(null), currentTurn: 0 });
            return;
        }
        socket.join(roomID);
        socketRooms[socket.id] = roomID;
        socket.emit('playerUpdate', { players: games[roomID].players });
        socket.emit('gameState', { board: games[roomID].board, currentTurn: games[roomID].currentTurn });
    });

    socket.on('makeMove', (data) => {
        const { roomID, index, playerName } = data || {};
        if (!roomID || typeof index !== 'number') return;
        const game = games[roomID];
        if (!game || !game.gameInProgress) return;

        const playerIndex = game.players.findIndex(p => p.name === playerName && p.id === socket.id);
        if (playerIndex === -1) return;

        if (playerIndex !== game.currentTurn) {
            socket.emit('errorMessage', 'Nem a te köröd.');
            return;
        }

        if (index < 0 || index > 8 || game.board[index] !== null) {
            socket.emit('errorMessage', 'Érvénytelen lépés.');
            return;
        }

        const symbol = game.players[playerIndex].symbol || (playerIndex === 0 ? 'X' : 'O');
        game.board[index] = symbol;

        const result = checkGameResult(game.board);
        if (result) {
            game.gameInProgress = false;
            if (result === 'draw') {
                io.to(roomID).emit('gameOver', { outcome: 'draw', board: game.board });
            } else {
                const winner = game.players.find(p => p.symbol === result);
                const winnerName = winner ? winner.name : null;
                io.to(roomID).emit('gameOver', { outcome: 'win', symbol: result, winnerName, board: game.board });
            }
        } else {
            game.currentTurn = (game.currentTurn + 1) % game.players.length;
            io.to(roomID).emit('gameState', { board: game.board, currentTurn: game.currentTurn });
        }
    });

    socket.on('leaveRoom', (data) => {
        const { roomID, playerName } = data || {};
        const room = roomID || socketRooms[socket.id];
        if (!room || !games[room]) return;

        games[room].players = games[room].players.filter(p => p.id !== socket.id && p.name !== playerName);
        socket.leave(room);
        delete socketRooms[socket.id];

        if (games[room].players.length > 0) {
            io.to(room).emit('playerLeft');
            io.to(room).emit('playerUpdate', { players: games[room].players });
        } else {
            delete games[room];
        }
    });

    socket.on('restartGame', (data) => {
        const { roomID } = data || {};
        const room = roomID || socketRooms[socket.id];
        if (!room || !games[room]) return;
        if (games[room].players.length < 2) return;

        games[room].board = Array(9).fill(null);
        games[room].gameInProgress = true;
        games[room].currentTurn = 0;

        io.to(room).emit('gameStart', {
            players: games[room].players,
            roomID: room,
            gameState: { board: games[room].board, currentTurn: games[room].currentTurn }
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const roomID = socketRooms[socket.id];
        if (roomID && games[roomID]) {
            games[roomID].players = games[roomID].players.filter(p => p.id !== socket.id);
            if (games[roomID].players.length > 0) {
                io.to(roomID).emit('playerLeft');
                io.to(roomID).emit('playerUpdate', { players: games[roomID].players });
            }
            if (games[roomID].players.length === 0) delete games[roomID];
        }
        delete socketRooms[socket.id];
    });
});

server.listen(3000, () => console.log('http://localhost:3000'));
