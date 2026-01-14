const socket = io();
const config = window.CHAT_CONFIG;


const msglist = document.getElementById('msglist');
const leaveRoomBtn = document.getElementById('leaveRoom');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const userList = document.getElementById('userList');



const renderUsers = (users) => {
    userList.innerHTML = '';
    users.forEach(user => {
        const userElement = document.createElement('li');
        userElement.innerHTML = user.nickname;
        userList.appendChild(userElement);
    });
};

const renderMessage = (nickname , message,type) =>{
    const msgElement = document.createElement('li');
    timestamp = new Date().toLocaleTimeString();
    msgElement.innerHTML = `
    <div class="${type}">
        <span>${nickname}</span>
        <small>${timestamp}</small>
        <span>${message}</span>
    </div>
    `;
    msglist.appendChild(msgElement);
    msglist.parentElement.scrollTop = msglist.parentElement.scrollHeight;
}

socket.emit('joinRoom', {
    nickname: config.nickname,
    roomId: config.roomId
});

socket.on('systemmessage', (message) => {
    renderMessage('Rendszer',message,'system');
});

leaveRoomBtn.addEventListener('click', () => {
    socket.emit('leaveRoom', {
        nickname: config.nickname,
        roomId: config.roomId
    });
    window.location.href = `/?username=${config.nickname}`;
});
sendBtn.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message) {
        renderMessage(config.nickname, message, 'outgoing');
        socket.emit('send-message',{message : message});
        messageInput.value = '';
        messageInput.focus();
    }
    else {
        return;
    }
});
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendBtn.click();
    }
});

socket.on('chatmessage', ({ nickname, message }) => {
    renderMessage(nickname, message,'incoming');
});
socket.on('roomUsers', (users) => {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';

    users.forEach(user => {
        const userElement = document.createElement('li');
        userElement.textContent = user.nickname;
        userList.appendChild(userElement);
    });
});
