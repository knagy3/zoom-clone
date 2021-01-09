const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myPeer = new Peer(undefined, {
  path: '/peerjs',
  host: '/',
  port: '3030'
});

let myVideoStream;
const myVideo = document.createElement('video');
myVideo.muted = true;
const peers = {};

// gets access to the user video
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  myVideoStream = stream;
  // add my video stream
  addVideoStream(myVideo, stream);
  // add new users' video stream via peer
  myPeer.on('call', call => {
    call.answer(stream)
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
    })
  });
  // listen to user-connected
  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
  });
  // input value with JQuerry ($)
  let text = $("input");
  // when press enter send message
  $('html').keydown((e) => {
    if (e.which == 13 && text.val().length !== 0) {
      socket.emit('message', text.val());
      text.val('');
    }
  });

  socket.on("createMessage", message => {
    $("ul").append(`<li class="message"><b>user</b><br/>${message}</li>`);
    scrollToBottom();
  });
});

// listen to user-disconnected
socket.on('user-disconnected', (userId) => {
  if (peers[userId]) peers[userId].close()
});

// make the othes able to join into the room vie peer
myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id)
});

// new user connect via peer
const connectToNewUser = (userId, stream) => {
  console.log("userd-id: ", userId);
  // get the call info
  const call = myPeer.call(userId, stream);
  // new video element for the new user
  const video = document.createElement('video');
  // joining to the call
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream);
  })
  // closing the call
  call.on('close', () => {
    video.remove();
  })

  peers[userId] = call;
};

const addVideoStream = (video, stream) => {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  })
  videoGrid.append(video);
}

const scrollToBottom = () => {
  var d = $('.main__chat_window');
  d.scrollTop(d.prop("scrollHeight"));
};

const muteUnmute = () => {
  const enabled = myVideoStream.getAudioTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getAudioTracks()[0].enabled = false;
    setUnmuteButton();
  } else {
    setMuteButton();
    myVideoStream.getAudioTracks()[0].enabled = true;
  }
};

const playStop = () => {
  console.log('object')
  let enabled = myVideoStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getVideoTracks()[0].enabled = false;
    setPlayVideo()
  } else {
    setStopVideo()
    myVideoStream.getVideoTracks()[0].enabled = true;
  }
};

const setMuteButton = () => {
  const html = `
    <i class="bi bi-mic-fill"></i>
    <span>Mute</span>
  `
  document.querySelector('.main__mute_button').innerHTML = html;
};

const setUnmuteButton = () => {
  const html = `
    <i class="bi bi-mic-mute-fill"></i>
    <span>Unmute</span>
  `
  document.querySelector('.main__mute_button').innerHTML = html;
};

const setStopVideo = () => {
  const html = `
    <i class="bi bi-camera-video-fill"></i>
    <span>Stop Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
};;

const setPlayVideo = () => {
  const html = `
  <i class="bi bi-camera-video-off-fill"></i>
    <span>Play Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
};
