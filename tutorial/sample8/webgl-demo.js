const globalSize = { width: 1920, height: 1200 };

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
    console.log("stopped. FPS was: ", fpsCount);
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

const getContext = () => {
  const canvas = document.createElement("canvas");
  return canvas.getContext("webgl");
};

const getTexture = renderContext => {
  const tex = renderContext.createTexture();
  renderContext.bindTexture(renderContext.TEXTURE_2D, tex);
  const fbo = renderContext.createFramebuffer();
  renderContext.bindFramebuffer(renderContext.FRAMEBUFFER, fbo);
  return tex;
};

const getImageData = (renderContext, texture, video) => {
  renderContext.viewport(0, 0, globalSize.width, globalSize.height);
  renderContext.framebufferTexture2D(
    renderContext.FRAMEBUFFER,
    renderContext.COLOR_ATTACHMENT0,
    renderContext.TEXTURE_2D,
    texture,
    0
  );
  renderContext.texImage2D(
    renderContext.TEXTURE_2D,
    0,
    renderContext.RGBA,
    renderContext.RGBA,
    renderContext.UNSIGNED_BYTE,
    video
  );
  const typedArray = new Uint8Array(globalSize.width * globalSize.height * 4);
  renderContext.readPixels(
    0,
    0,
    globalSize.width,
    globalSize.height,
    renderContext.RGBA,
    renderContext.UNSIGNED_BYTE,
    typedArray
  );
  return typedArray.buffer;
};

main();

//
// Start here
//
function main() {
  const canvas = document.querySelector("#glcanvas");
  const offscreen = canvas.transferControlToOffscreen();
  const worker = new Worker("./worker.js");

  const context1 = getContext();
  const context2 = getContext();
  const texture1 = getTexture(context1);
  const texture2 = getTexture(context2);
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
    const image1 = getImageData(context1, texture1, video1);
    const image2 = getImageData(context2, texture2, video2);
    worker.postMessage(
      {
        render: true,
        bitmap1: image1,
        bitmap2: image2
      },
      [image1, image2]
    );
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
