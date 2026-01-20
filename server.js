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
// Track which socket is in which room
const socketRooms = {};

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

// Debug endpoints (dev only) to inspect server room and socket state
app.get('/debug/games', (req, res) => {
    // Return a simplified view of games (roomID -> player names)
    const out = {};
    for (const roomID in games) {
        out[roomID] = games[roomID].players.map(p => ({ id: p.id, name: p.name }));
    }
    res.json({ games: out });
});

app.get('/debug/sockets', (req, res) => {
    res.json({ socketRooms });
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

        // Track socket to room
        socketRooms[socket.id] = roomID;

        socket.join(roomID);

        console.log(`${playerName} joined room ${roomID}. Room now has ${games[roomID].players.length} players`);

        io.to(roomID).emit('playerJoined', {
            playerName: playerName,
            playersInRoom: games[roomID].players.length,
            roomID: roomID
        });

        // Send authoritative players list to everyone in the room so clients can render names
        io.to(roomID).emit('playerUpdate', {
            players: games[roomID].players
        });

        if (games[roomID].players.length === 2) {
            console.log(`Room ${roomID} is full, starting game`);
            io.to(roomID).emit('gameStart', {
                players: games[roomID].players,
                roomID: roomID
            });

            // Also send an immediate playerUpdate when game starts
            io.to(roomID).emit('playerUpdate', {
                players: games[roomID].players
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        const roomID = socketRooms[socket.id];
        
        if (roomID && games[roomID]) {
            games[roomID].players = games[roomID].players.filter(p => p.id !== socket.id);

            if (games[roomID].players.length > 0) {
                io.to(roomID).emit('playerLeft');
            }

            if (games[roomID].players.length === 0) {
                delete games[roomID];
            }
        }
        
        delete socketRooms[socket.id];
    });

    socket.on('rejoinRoom', (data) => {
        const { roomID, playerName } = data;
        
        console.log(`${playerName} attempting to rejoin room ${roomID} with new socket ${socket.id}`);
        
        if (!roomID || !games[roomID]) {
            console.log(`Room ${roomID} does not exist`);
            return;
        }

        // Check if this player is already in the room
        const playerExists = games[roomID].players.some(p => p.name === playerName);
        
        if (!playerExists) {
            console.log(`Player ${playerName} not found in room, adding them`);
            // Add player with new socket ID
            games[roomID].players.push({
                id: socket.id,
                name: playerName
            });
        } else {
            // Update the socket ID for existing player
            const player = games[roomID].players.find(p => p.name === playerName);
            if (player) {
                console.log(`Updating socket ID for ${playerName} from ${player.id} to ${socket.id}`);
                player.id = socket.id;
            }
        }

        // Join the socket to the room if not already there
        socket.join(roomID);
        
        // Track this socket to the room
        socketRooms[socket.id] = roomID;
        
        console.log(`${playerName} re-joined room ${roomID}. Room has ${games[roomID].players.length} players:`, games[roomID].players.map(p => p.name));

        // Send current players to all in room
        io.to(roomID).emit('playerUpdate', {
            players: games[roomID].players
        });
    });

    // Client can request authoritative room state (useful after redirect)
    socket.on('requestRoomState', (data) => {
        const { roomID, playerName } = data;
        console.log(`${playerName} requested room state for ${roomID}`);
        if (!roomID || !games[roomID]) {
            socket.emit('playerUpdate', { players: [] });
            return;
        }

        // Ensure socket is in the room and tracked
        socket.join(roomID);
        socketRooms[socket.id] = roomID;

        // Send the authoritative players list to this socket only
        socket.emit('playerUpdate', { players: games[roomID].players });
    });
});

server.listen(3000, () => {
    console.log(`http://localhost:3000`);
});
