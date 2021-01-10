// node js express server
const express = require('express');
const app = express();
// const cors = require('cors');
// app.use(cors());
// set server app
const server = require('http').Server(app);
// it allows to make others camera and mic turned on
const io = require('socket.io')(server);
// set up peerjs server
const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, {
  debug: true
});
// unique ID for joining to the room
const { v4: uuidV4 } = require('uuid');
// use peer server
app.use('/peerjs', peerServer);
// Set the the embedded js engine
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
  //res.status(200).send("Hello World!");
  res.redirect(`/${uuidV4()}`);
});

app.get('/:room', (req, res) => {
  res.render('room', { roomId: req.params.room });
});

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).broadcast.emit('user-connected', userId);
    // messages
    socket.on('message', (message) => {
      //send message to the same room
      io.to(roomId).emit('createMessage', message);
    }); 

    socket.on('disconnect', () => {
      socket.to(roomId).broadcast.emit('user-disconnected', userId)
    });
  });
})

server.listen(3030);
