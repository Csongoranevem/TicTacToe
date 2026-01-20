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

app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('main');
});


app.get('/game', (req, res) => {
    res.render('user/game');
});


app.post('/leave', (req, res) => {
    res.render('main');
});

server.listen(3000, () => {
    console.log(`http://localhost:3000`);
});
