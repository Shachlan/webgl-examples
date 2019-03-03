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

  const blendingFragmentShader = `    
    precision mediump float;                            
    varying vec2 vTextureCoord;                            
    uniform sampler2D uSampler1;                        
    uniform sampler2D uSampler2;                      
    void main()                                         
    {                
      vec4 color1 = texture2D(uSampler1, vTextureCoord) * 0.5;    
      vec4 color2 = texture2D(uSampler2, vTextureCoord) * 0.5;                                     
      gl_FragColor = color1 + color2;   
    }
  `;

  // Initialize a shader program; this is where all the lighting
  // for the vertices and so forth is established.
  const blendingProgram = initShaderProgram(
    gl,
    vsSource,
    blendingFragmentShader
  );

  const edgeDetectProgram = initShaderProgram(
    gl,
    vsSource,
    edgeDetectFragmentShader
  );

  const makeProgramInfo = (program, context, frameBuffer) => {
    return {
      program: program,
      attribLocations: {
        vertexPosition: context.getAttribLocation(program, "aVertexPosition"),
        textureCoord: context.getAttribLocation(program, "aTextureCoord")
      },
      uniformLocations: {
        uSampler1: context.getUniformLocation(program, "uSampler1"),
        uSampler2: context.getUniformLocation(program, "uSampler2"),
        width: context.getUniformLocation(program, "width"),
        height: context.getUniformLocation(program, "height")
      },
      frameBuffer: frameBuffer
    };
  };

  const blendingProgramInfo = makeProgramInfo(blendingProgram, gl, null, null, {
    width: canvas.width,
    height: canvas.height
  });
  const frameBuffer = gl.createFramebuffer();
  let targetTexture1;
  let targetTexture2;
  let size1;
  let size2;
  const edgeProgramInfo = makeProgramInfo(edgeDetectProgram, gl, frameBuffer);

  // Here's where we call the routine that builds all the
  // objects we'll be drawing.
  const buffers = initBuffers(gl);
  const sourceTexture1 = initTexture(gl);
  const sourceTexture2 = initTexture(gl);

  const video1 = setupVideo("race.mp4", video => {
    targetTexture1 = createTexture(
      gl,
      video.videoWidth,
      video.videoHeight,
      null
    );
    size1 = { width: video.videoWidth, height: video.videoHeight };
    console.log(size1);
  });
  const video2 = setupVideo("dog.mp4", video => {
    targetTexture2 = createTexture(
      gl,
      video.videoWidth,
      video.videoHeight,
      null
    );
    size2 = { width: video.videoWidth, height: video.videoHeight };
    console.log(size2);
  });

  // Draw the scene repeatedly
  function render() {
    if (!copyVideo || !targetTexture1 || !targetTexture2) {
      requestAnimationFrame(render);
      return;
    }

    updateTexture(gl, sourceTexture1, video1);
    drawToTexture(
      gl,
      edgeProgramInfo,
      buffers,
      targetTexture1,
      sourceTexture1,
      frameBuffer,
      size1
    );
    updateTexture(gl, sourceTexture2, video2);
    drawToTexture(
      gl,
      edgeProgramInfo,
      buffers,
      targetTexture2,
      sourceTexture2,
      frameBuffer,
      size2
    );
    drawScene(gl, blendingProgramInfo, buffers, targetTexture1, targetTexture2);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function setupVideo(url, setup) {
  const video = document.createElement("video");

  var playing = false;
  var timeupdate = false;
  let setupCalled = false;

  video.autoplay = true;
  video.muted = true;
  video.loop = true;

  // Waiting for these 2 events ensures
  // there is data in the video

  video.addEventListener(
    "playing",
    function() {
      playing = true;
      checkReady(setup, video);
    },
    true
  );

  video.addEventListener(
    "timeupdate",
    function() {
      timeupdate = true;
      checkReady(setup, video);
    },
    true
  );

  video.src = url;
  video.play();

  function checkReady(setup, video) {
    if (playing && timeupdate) {
      copyVideo = true;
      if (!setupCalled) {
        setup(video);
        setupCalled = true;
      }
    }
  }

  return video;
}

function initBuffers(gl) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions = [-1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

  const textureCoordinates = [0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0];

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

function createTexture(gl, width, height, data) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  {
    // define size and format of level 0
    const level = 0;
    const internalFormat = gl.RGBA;
    const border = 0;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      width,
      height,
      border,
      format,
      type,
      data
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  return texture;
}

//
// Initialize a texture.
//
function initTexture(gl) {
  const pixel = new Uint8Array([0, 0, 255, 255]);
  return createTexture(gl, 1, 1, pixel);
}

//
// copy the video texture
//
function updateTexture(gl, texture, video) {
  const level = 0;
  const internalFormat = gl.RGBA;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    level,
    internalFormat,
    srcFormat,
    srcType,
    video
  );
}

function setupContext(
  gl,
  programInfo,
  buffers,
  viewportSize,
  frameBuffer,
  targetTexture
) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  if (targetTexture) {
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    const level = 0;
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      attachmentPoint,
      gl.TEXTURE_2D,
      targetTexture,
      level
    );
  }
  gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
  gl.clearDepth(1.0); // Clear everything
  gl.enable(gl.DEPTH_TEST); // Enable depth testing
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.viewport(0, 0, viewportSize.width, viewportSize.height);

  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute
  {
    const numComponents = 2;
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
  gl.useProgram(programInfo.program);
}

function drawToTexture(
  gl,
  programInfo,
  buffers,
  targetTexture,
  sourceTexture,
  frameBuffer,
  size
) {
  setupContext(gl, programInfo, buffers, size, frameBuffer, targetTexture);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  gl.uniform1i(programInfo.uniformLocations.uSampler1, 0);
  gl.uniform1f(programInfo.uniformLocations.width, size.width);
  gl.uniform1f(programInfo.uniformLocations.height, size.height);

  {
    const vertexCount = 6;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }
}

function drawScene(gl, programInfo, buffers, texture1, texture2) {
  setupContext(
    gl,
    programInfo,
    buffers,
    {
      width: gl.canvas.width,
      height: gl.canvas.height
    },
    null,
    null
  );

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture1);
  gl.uniform1i(programInfo.uniformLocations.uSampler1, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texture2);
  gl.uniform1i(programInfo.uniformLocations.uSampler2, 1);

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
