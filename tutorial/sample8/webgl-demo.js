/**
 *
 * @param {number} fps
 */
function createFrameRenderer(fps) {
  let wasStopped = false;
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

    if (elapsed <= fpsInterval) {
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
  }
  function stop() {
    console.log("stopped. FPS was: ", fpsCount);
    wasStopped = true;
  }

  return {
    render,
    stop
  };
}

// will set to true when video can be copied to texture
var copyVideo = false;

main();

//
// Start here
//
function main() {
  const canvas = document.querySelector("#glcanvas");
  const gl = canvas.getContext("webgl");

  // If we don't have a GL context, give up now

  if (!gl) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it."
    );
    return;
  }

  // Vertex shader program

  const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;

    varying highp vec2 vTextureCoord;

    void main(void) {
      gl_Position = aVertexPosition;
      vTextureCoord = aTextureCoord;
    }
  `;

  // Fragment shader program

  const edgeDetectFragmentShader = `
    precision mediump float;                            
    varying vec2 vTextureCoord;                            
    uniform sampler2D uSampler1;                             
    uniform sampler2D uSampler2;                        
    uniform float width;  
    uniform float height;  
    void main()                                         
    {          
      uSampler2;
      vec4 pixel = texture2D(uSampler1, vTextureCoord);              
      vec4 n[9];

      float w = 1.0 / width;
      float h = 1.0 / height;

      n[0] = texture2D(uSampler1, vTextureCoord + vec2(0.0, 0.0) );
      n[1] = texture2D(uSampler1, vTextureCoord + vec2(w, 0.0) );
      n[2] = texture2D(uSampler1, vTextureCoord + vec2(2.0*w, 0.0) );
      n[3] = texture2D(uSampler1, vTextureCoord + vec2(0.0*w, h) );
      n[4] = texture2D(uSampler1, vTextureCoord + vec2(w, h) );
      n[5] = texture2D(uSampler1, vTextureCoord + vec2(2.0*w, h) );
      n[6] = texture2D(uSampler1, vTextureCoord + vec2(0.0, 2.0*h) );
      n[7] = texture2D(uSampler1, vTextureCoord + vec2(w, 2.0*h) );
      n[8] = texture2D(uSampler1, vTextureCoord + vec2(2.0*w, 2.0*h) );

      vec4 sobel_x = n[2] + (2.0*n[5]) + n[8] - (n[0] + (2.0*n[3]) + n[6]);
      vec4 sobel_y = n[0] + (2.0*n[1]) + n[2] - (n[6] + (2.0*n[7]) + n[8]);

      float avg_x = (sobel_x.r + sobel_x.g + sobel_x.b) / 3.0;
      float avg_y = (sobel_y.r + sobel_y.g + sobel_y.b) / 3.0;

      sobel_x.r = avg_x;
      sobel_x.g = avg_x;
      sobel_x.b = avg_x;
      sobel_y.r = avg_y;
      sobel_y.g = avg_y;
      sobel_y.b = avg_y;

      vec3 sobel = vec3(sqrt((sobel_x.rgb * sobel_x.rgb) + (sobel_y.rgb * sobel_y.rgb)));
      gl_FragColor = vec4( sobel, 1.0 );   
    }     
  `;

  const brightnessFragmentShader = `    
    precision mediump float;                            
    varying vec2 vTextureCoord;                            
    uniform sampler2D uSampler1;    
    
    uniform float shadows;
    uniform float highlights;

    const vec3 luminanceWeighting = vec3(0.3, 0.3, 0.3);

    void main()                                         
    {                     
      vec4 source = texture2D(uSampler1, vTextureCoord);
      float luminance = dot(source.rgb, luminanceWeighting);

      //(shadows+1.0) changed to just shadows:
      float shadow = clamp((pow(luminance, 1.0/shadows) + (-0.76)*pow(luminance, 2.0/shadows)) - luminance, 0.0, 1.0);
      float highlight = clamp((1.0 - (pow(1.0-luminance, 1.0/(2.0-highlights)) + (-0.8)*pow(1.0-luminance, 2.0/(2.0-highlights)))) - luminance, -1.0, 0.0);
      vec3 result = vec3(0.0, 0.0, 0.0) + ((luminance + shadow + highlight) - 0.0) * ((source.rgb - vec3(0.0, 0.0, 0.0))/(luminance - 0.0));

      // blend toward white if highlights is more than 1
      float contrastedLuminance = ((luminance - 0.5) * 1.5) + 0.5;
      float whiteInterp = contrastedLuminance*contrastedLuminance*contrastedLuminance;
      float whiteTarget = clamp(highlights, 1.0, 2.0) - 1.0;
      result = mix(result, vec3(1.0), whiteInterp*whiteTarget);

      // blend toward black if shadows is less than 1
      float invContrastedLuminance = 1.0 - contrastedLuminance;
      float blackInterp = invContrastedLuminance*invContrastedLuminance*invContrastedLuminance;
      float blackTarget = 1.0 - clamp(shadows, 0.0, 1.0);
      result = mix(result, vec3(0.0), blackInterp*blackTarget);

      gl_FragColor = vec4(result, source.a);
    }
  `;

  // Initialize a shader program; this is where all the lighting
  // for the vertices and so forth is established.
  const shaderProgram = initShaderProgram(
    gl,
    vsSource,
    brightnessFragmentShader
  );

  // Collect all the info needed to use the shader program.
  // Look up which attributes our shader program is using
  // for aVertexPosition, aVertexNormal, aTextureCoord,
  // and look up uniform locations.
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      textureCoord: gl.getAttribLocation(shaderProgram, "aTextureCoord")
    },
    uniformLocations: {
      uSampler1: gl.getUniformLocation(shaderProgram, "uSampler1"),
      shadows: gl.getUniformLocation(shaderProgram, "shadows"),
      brightness: gl.getUniformLocation(shaderProgram, "brightness")
    }
  };

  // Here's where we call the routine that builds all the
  // objects we'll be drawing.
  const buffers = initBuffers(gl);

  const texture1 = initTexture(gl);

  const stop = () => {
    frameRenderer.stop();
    sum = timingArray.reduce(function(a, b) {
      return a + b;
    });
    avg = sum / timingArray.length;
    console.log("average update time: ", avg);
  };

  const video1 = setupVideo("dog.mp4");
  // Draw the scene repeatedly
  function render() {
    if (copyVideo) {
      updateTexture(gl, texture1, video1);
    }

    drawScene(gl, programInfo, buffers, texture1);
  }

  let frameRenderer = createFrameRenderer(30);
  video1.onended = stop;
  frameRenderer.render(render);
}

function setupVideo(url) {
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
      copyVideo = true;
    }
  }

  return video;
}

const timingArray = [];

//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just
// have one object -- a simple three-dimensional cube.
//
function initBuffers(gl) {
  // Create a buffer for the cube's vertex positions.

  const positionBuffer = gl.createBuffer();

  // Select the positionBuffer as the one to apply buffer
  // operations to from here out.

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Now create an array of positions for the cube.

  const positions = [
    -1.0,
    -1.0,
    1.0,
    1.0,
    -1.0,
    1.0,
    1.0,
    1.0,
    1.0,
    -1.0,
    1.0,
    1.0
  ];

  // Now pass the list of positions into WebGL to build the
  // shape. We do this by creating a Float32Array from the
  // JavaScript array, then use it to fill the current buffer.

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Now set up the texture coordinates for the faces.

  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

  const textureCoordinates = [
    // Front
    1.0,
    1.0,
    0.0,
    1.0,
    0.0,
    0.0,
    1.0,
    0.0
  ];

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(textureCoordinates),
    gl.STATIC_DRAW
  );

  // Build the element array buffer; this specifies the indices
  // into the vertex arrays for each face's vertices.

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.

  const indices = [0, 1, 2, 0, 2, 3];

  // Now send the element array to GL

  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );

  return {
    position: positionBuffer,
    textureCoord: textureCoordBuffer,
    indices: indexBuffer
  };
}

//
// Initialize a texture.
//
function initTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Because video havs to be download over the internet
  // they might take a moment until it's ready so
  // put a single pixel in the texture so we can
  // use it immediately.
  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
  gl.texImage2D(
    gl.TEXTURE_2D,
    level,
    internalFormat,
    width,
    height,
    border,
    srcFormat,
    srcType,
    pixel
  );

  // Turn off mips and set  wrapping to clamp to edge so it
  // will work regardless of the dimensions of the video.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  return texture;
}

//
// copy the video texture
//
function updateTexture(gl, texture, video) {
  const level = 0;
  const internalFormat = gl.RGBA;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const then = performance.now();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    level,
    internalFormat,
    srcFormat,
    srcType,
    video
  );
  const now = performance.now();
  timingArray.push(now - then);
}

//
// Draw the scene.
//
function drawScene(gl, programInfo, buffers, texture1, texture2) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
  gl.clearDepth(1.0); // Clear everything
  gl.enable(gl.DEPTH_TEST); // Enable depth testing
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things

  // Clear the canvas before we start drawing on it.

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute
  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
  }

  // Tell WebGL how to pull out the texture coordinates from
  // the texture coordinate buffer into the textureCoord attribute.
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
    gl.vertexAttribPointer(
      programInfo.attribLocations.textureCoord,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);
  }

  // Tell WebGL which indices to use to index the vertices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

  // Tell WebGL to use our program when drawing

  gl.useProgram(programInfo.program);

  gl.uniform1f(programInfo.uniformLocations.width, gl.canvas.width);
  gl.uniform1f(programInfo.uniformLocations.height, gl.canvas.height);

  // Specify the texture to map onto the faces.

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture1);
  gl.uniform1i(programInfo.uniformLocations.uSampler1, 0);

  gl.uniform1f(programInfo.uniformLocations.shadows, 2);
  gl.uniform1f(programInfo.uniformLocations.brightness, 0.1);

  {
    const vertexCount = 6;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }
}

//
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(
      `Unable to initialize the shader program:` +
        gl.getProgramInfoLog(shaderProgram)
    );
    return null;
  }

  return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object

  gl.shaderSource(shader, source);

  // Compile the shader program

  gl.compileShader(shader);

  // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(
      "An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader)
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}
