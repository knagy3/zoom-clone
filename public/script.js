const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myPeer = new Peer(undefined, {
  path: '/peerjs',
  host: '/',
  port: '443'
});

const peers = {};
let faceMatcher = null;
let predictedAges = [];
let myVideoStream = null;
const myVideo = document.createElement('video');
myVideo.muted = true;

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
  faceapi.nets.faceExpressionNet.loadFromUri('/models'),
  faceapi.nets.ageGenderNet.loadFromUri("/models"),
  faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
]).then(startVideo);

function startVideo() {
  // gets access to the user video
  navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  })
  .then(stream => {
    myVideoStream = stream;
    myVideo.srcObject = stream;
    // add my video stream
    addVideoStream(myVideo, stream);
    // add new users' video stream via peer
    myPeer.on('call', (call) => {
      call.answer(stream);
      const video = document.createElement('video');
      call.on('stream', (userVideoStream) => {
        addVideoStream(video, userVideoStream);
        console.log("call on is done!");
      });
    });
    // listen to user-connected
    socket.on('user-connected', userId => {
      connectToNewUser(userId, stream);
    });
    // get labels
    mainLabel();
  },
    err => console.log(err)
  );
};

// face recog async
const mainLabel = async () => {
  // add images
  const labeledFaceDescriptors = await loadLabeledImages();
  faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
}

// face image loader
const loadLabeledImages = () => {
  const labels = ['Balint', 'Csilla', 'Kristof', 'Laci', 'Szilvi'];
  const image_number = 4;
  return Promise.all(
    labels.map(async label => {
      const descriptions = []
      for (let i = 1; i <= image_number; i++) {
        const img = await faceapi.fetchImage(`https://raw.githubusercontent.com/knagy3/zoom-clone/master/public/labeled_images/${label}/${i}.jpg`);
        const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        descriptions.push(detections.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  )
};
// make the othes able to join into the room vie peer
myPeer.on('open', (id) => {
  socket.emit('join-room', ROOM_ID, id);
});

// new user connect via peer // async
const connectToNewUser = (userId, stream) => {
  try {
    // get the call info // await
    const call = myPeer.call(userId, stream);
    // new video element for the new user
    const video = document.createElement('video');
    // joining to the call
    call.on('stream', (userVideoStream) => {
      addVideoStream(video, userVideoStream);
      console.log("call on userd-id: ", userId);
    });
    // closing the call
    call.on('close', () => {
      video.remove();
    });
    peers[userId] = call;
  } catch(e) {
    console.log('error connection', e);
  }
};

const addVideoStream = (video, stream) => {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });
  videoGrid.append(video);
};

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

// listen to user-disconnected
socket.on('user-disconnected', (userId) => {
  if (peers[userId]) peers[userId].close()
});

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
  let enabled = myVideoStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getVideoTracks()[0].enabled = false;
    setPlayVideo()
  } else {
    setStopVideo()
    myVideoStream.getVideoTracks()[0].enabled = true;
  }
};

const refresh = () => {
  window.location.reload();
};

const getFaceExpressions = () => {
  const video = document.getElementsByTagName("video")[0];
  const canvas = faceapi.createCanvasFromMedia(video);
  videoGrid.append(canvas);
  const displaySize = { width: 520, height: 415 };
  faceapi.matchDimensions(canvas, displaySize);    
  setInterval(async () => {
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions();
      //.withAgeAndGender();
    const resizedDetections = faceapi.resizeResults(detection, displaySize);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    faceapi.draw.drawDetections(canvas, resizedDetections);
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
  }, 90);
};

const getAgeAndGender = () => {
  const video = document.getElementsByTagName("video")[0];
  const canvas = faceapi.createCanvasFromMedia(video);
  videoGrid.append(canvas);
  const displaySize = { width: 520, height: 415 };
  faceapi.matchDimensions(canvas, displaySize);    
  setInterval(async () => {
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withAgeAndGender();
    const resizedDetections = faceapi.resizeResults(detection, displaySize);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    faceapi.draw.drawDetections(canvas, resizedDetections);

    const age = resizedDetections.age;
    const gender = resizedDetections.gender;
    const box = resizedDetections.detection.box
    const drawBox = new faceapi.draw.DrawBox(box, { label: Math.round(age) + " year old " + gender })
    drawBox.draw(canvas);
  }, 90);
};

const getFaceMatches = () => {
  const video = document.getElementsByTagName("video")[0];
  const canvas = faceapi.createCanvasFromMedia(video);
  videoGrid.append(canvas);
  const displaySize = { width: 520, height: 415 };
  faceapi.matchDimensions(canvas, displaySize);    
  setInterval(async () => {
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    const resizedDetections = faceapi.resizeResults(detection, displaySize);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    faceapi.draw.drawDetections(canvas, resizedDetections);

    const result = faceMatcher.findBestMatch(resizedDetections.descriptor);
    const box = resizedDetections.detection.box;
    const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
    drawBox.draw(canvas);
  }, 90);
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
};

const setPlayVideo = () => {
  const html = `
  <i class="bi bi-camera-video-off-fill"></i>
    <span>Play Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
};
