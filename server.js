const express = require('express');
const app = express();
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

server.listen(3000, () => {
    console.log(`http://localhost:3000`);
});
