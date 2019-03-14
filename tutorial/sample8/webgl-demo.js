/**
 *
 * @param {number} fps
 */
function createFrameRenderer(fps) {
  let wasStopped = false;
  let canRender = false;
  let shouldBlock = false;
  let frameCount = 0;
  const fpsInterval = 1000 / fps;
  let now, elapsed;
  let then = performance.now();
  let startTime = then;
  let count,
    seconds = 0;
  let drawCallback = () => {
    throw new Error("no draw callback provided!");
    return undefined;
  };
  let fpsCount = [];

  /**
   *
   * @param {() => any} callback - The drawing code.
   */
  function render(callback) {
    drawCallback = callback;
    renderFrame();
  }

  function renderFrame() {
    if (wasStopped) {
      return;
    }

    now = performance.now();
    elapsed = now - then;

    if (elapsed <= fpsInterval || (!canRender && shouldBlock)) {
      //console.log("blocked");
      requestAnimationFrame(renderFrame);
      return;
    }

    count += 1;
    if ((now - startTime) / 1000 > seconds) {
      seconds += 1;
      fpsCount.push(count);
      count = 0;
    }
    then = now - (elapsed % fpsInterval);
    drawCallback();
    requestAnimationFrame(renderFrame);
    canRender = false;
  }

  function stop() {
    //console.log("stopped. FPS was: ", fpsCount);
    wasStopped = true;
  }

  function unblock() {
    //console.log("unblocking");
    canRender = true;
  }

  function startBlocking() {
    shouldBlock = true;
  }

  return {
    render,
    stop,
    unblock
  };
}

// will set to true when video can be copied to texture
let copyVideo1 = false;
let copyVideo2 = false;

main();

//
// Start here
//
function main() {
  const canvas = document.querySelector("#glcanvas");
  const offscreen = canvas.transferControlToOffscreen();
  const worker = new Worker("./worker.js");

  const video1 = setupVideo("race.mp4", () => {
    //console.log("1 ready");
    copyVideo1 = true;
  });
  const video2 = setupVideo("dog.mp4", () => {
    //console.log("2 ready");
    copyVideo2 = true;
  });
  let frameRenderer = createFrameRenderer(30);

  // Draw the scene repeatedly
  function render() {
    if (!copyVideo1 || !copyVideo2) {
      //console.log("early leaving: ", copyVideo1, " , ", copyVideo2);
      frameRenderer.unblock();
      return;
    }
    let promise = Promise.all([
      // Cut out two sprites from the sprite sheet
      createImageBitmap(video1),
      createImageBitmap(video2)
    ]);
    promise.catch(error => {
      console.log(error);
    });
    promise.then(sprites => {
      worker.postMessage(
        {
          render: true,
          bitmap1: sprites[0],
          bitmap2: sprites[1]
        },
        [sprites[0], sprites[1]]
      );
    });
  }

  video1.onended = frameRenderer.stop;
  video2.onended = frameRenderer.stop;
  frameRenderer.render(render);
  worker.onmessage = frameRenderer.unblock;

  worker.postMessage({ canvas: offscreen }, [offscreen]);
}

function setupVideo(url, completion) {
  const video = document.createElement("video");

  var playing = false;
  var timeupdate = false;

  video.autoplay = true;
  video.muted = true;
  video.loop = false;

  // Waiting for these 2 events ensures
  // there is data in the video

  video.addEventListener(
    "playing",
    function() {
      playing = true;
      checkReady();
    },
    true
  );

  video.addEventListener(
    "timeupdate",
    function() {
      timeupdate = true;
      checkReady();
    },
    true
  );

  video.src = url;
  video.play();

  function checkReady() {
    if (playing && timeupdate) {
      completion();
    }
  }

  return video;
}
