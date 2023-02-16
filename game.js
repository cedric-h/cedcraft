"use strict";
// vim: sw=2 ts=2 expandtab smartindent ft=javascript

/* ENGINE
 *  [ ] Camera
 *  [ ] Skybox

 *  [ ] 2D Physics
 *  [ ] Jump
 *
 *  [ ] Splitscreen
 *  [ ] State Cache

 *  [ ] Networking
 *  [ ] Chat
 *
 * SANDBOX
 *  [ ] Break
 *  [ ] Place
 *  [ ] Pick Up
 *
 *  [ ] Hotbar
 *  [ ] Item break speeds
 *
 *  [ ] Inventory
 *  [ ] Furnace
 *  [ ] Chest
 *
 * DAY DREAM
 *  [ ] Grappling Hook
 *  [ ] World-in-a-Pot
 *  [ ] Pulleys
 */

const log = x => (console.log(x), x);
const VEC3_UP = [0, 1, 0];

function mat4_target_to(eye, target, up=VEC3_UP) {
  /**
   * Generates a matrix that makes something look at something else.
   *
   * eye = Position of the viewer
   * center = Point the viewer is looking at
   * up = vec3 pointing up
   * returns mat4 out
   */
  var eyex = eye[0],
      eyey = eye[1],
      eyez = eye[2],
      upx = up[0],
      upy = up[1],
      upz = up[2];
  var z0 = eyex - target[0],
      z1 = eyey - target[1],
      z2 = eyez - target[2];
  var len = z0 * z0 + z1 * z1 + z2 * z2;

  if (len > 0) {
    len = 1 / Math.sqrt(len);
    z0 *= len;
    z1 *= len;
    z2 *= len;
  }

  var x0 = upy * z2 - upz * z1,
      x1 = upz * z0 - upx * z2,
      x2 = upx * z1 - upy * z0;
  len = x0 * x0 + x1 * x1 + x2 * x2;

  if (len > 0) {
    len = 1 / Math.sqrt(len);
    x0 *= len;
    x1 *= len;
    x2 *= len;
  }

  const out = new DOMMatrix();
  out.m11 = x0;
  out.m12 = x1;
  out.m13 = x2;
  out.m14 = 0;
  out.m21 = z1 * x2 - z2 * x1;
  out.m22 = z2 * x0 - z0 * x2;
  out.m23 = z0 * x1 - z1 * x0;
  out.m24 = 0;
  out.m31 = z0;
  out.m32 = z1;
  out.m33 = z2;
  out.m34 = 0;
  out.m41 = eyex;
  out.m42 = eyey;
  out.m43 = eyez;
  out.m44 = 1;
  return out;
}
function mat4_perspective(fovy, aspect, near, far) {
  const out = new DOMMatrix();
  const f = 1.0 / Math.tan(fovy / 2);
  out.m11 = f / aspect;
  out.m12 = 0;
  out.m13 = 0;
  out.m14 = 0;
  out.m21 = 0;
  out.m22 = f;
  out.m23 = 0;
  out.m24 = 0;
  out.m31 = 0;
  out.m32 = 0;
  out.m34 = -1;
  out.m41 = 0;
  out.m42 = 0;
  out.m44 = 0;


  if (far != null && far !== Infinity) {
    const nf = 1 / (near - far);
    out.m33 = (far + near) * nf;
    out.m43 = 2 * far * near * nf;
  } else {
    out.m33 = -1;
    out.m43 = -2 * near;
  }

  return out;
}


function initBuffers(gl) {
  function initPositionBuffer(gl) {
    // Create a buffer for the square's positions.
    const positionBuffer = gl.createBuffer();

    // Select the positionBuffer as the one to apply buffer
    // operations to from here out.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    const positions = [
      // Front face
      -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,

      // Back face
      -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,

      // Top face
      -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,

      // Bottom face
      -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,

      // Right face
      1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0,

      // Left face
      -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0,
    ];

    // Now pass the list of positions into WebGL to build the
    // shape. We do this by creating a Float32Array from the
    // JavaScript array, then use it to fill the current buffer.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    return positionBuffer;
  }

  function initColorBuffer(gl) {
    const faceColors = [
      [1.0, 1.0, 1.0, 1.0], // Front face: white
      [1.0, 0.0, 0.0, 1.0], // Back face: red
      [0.0, 1.0, 0.0, 1.0], // Top face: green
      [0.0, 0.0, 1.0, 1.0], // Bottom face: blue
      [1.0, 1.0, 0.0, 1.0], // Right face: yellow
      [1.0, 0.0, 1.0, 1.0], // Left face: purple
    ];

    // Convert the array of colors into a table for all the vertices.
    var colors = [];

    for (var j = 0; j < faceColors.length; ++j) {
      const c = faceColors[j];
      // Repeat each color four times for the four vertices of the face
      colors = colors.concat(c, c, c, c);
    }

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    return colorBuffer;
  }

  function initIndexBuffer(gl) {
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    const indices = [
       0,  1,  2,  0,  2,  3, // front
       4,  5,  6,  4,  6,  7, // back
       8,  9, 10,  8, 10, 11, // top
      12, 13, 14, 12, 14, 15, // bottom
      16, 17, 18, 16, 18, 19, // right
      20, 21, 22, 20, 22, 23, // left
    ];

    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW
    );

    return indexBuffer;
  }

  const positionBuffer = initPositionBuffer(gl);
  const colorBuffer = initColorBuffer(gl);
  const indexBuffer = initIndexBuffer(gl);

  return {
    position: positionBuffer,
    color: colorBuffer,
    indices: indexBuffer,
  };
}

function cross3(x, y) {
  return [
    x[1] * y[2] - y[1] * x[2],
    x[2] * y[0] - y[2] * x[0],
    x[0] * y[1] - y[0] * x[1]
  ];
}
function add3(l, r) {
  return [l[0] + r[0],
          l[1] + r[1],
          l[2] + r[2]];
}
function mul3_f(v, f) {
  v[0] *= f;
  v[1] *= f;
  v[2] *= f;
  return v;
}

let state = {
  pos: [0, 0, -12],
  cam: { yaw_deg: 0, pitch_deg: 0 },
  keysdown: {},
};
window.onmousemove = e => {
  if (!document.pointerLockElement) return;
  const dy = e.movementY * 0.35;
  const dx = e.movementX * 0.35;
  state.cam.pitch_deg = Math.max(-89, Math.min(89, state.cam.pitch_deg - dy));
  state.cam.yaw_deg = (state.cam.yaw_deg - dx) % 360;
};
window.onkeydown = e => state.keysdown[e.code] = 1;
window.onkeyup   = e => state.keysdown[e.code] = 0;
function cam_looking() {
  const yaw_sin   = Math.sin(state.cam.yaw_deg   / 180 * Math.PI);
  const yaw_cos   = Math.cos(state.cam.yaw_deg   / 180 * Math.PI);
  const pitch_sin = Math.sin(state.cam.pitch_deg / 180 * Math.PI);
  const pitch_cos = Math.cos(state.cam.pitch_deg / 180 * Math.PI);

  const looking = [
    yaw_sin * pitch_cos,
    pitch_sin,
    yaw_cos * pitch_cos,
  ];
  return looking;
}

function draw_scene(gl, programInfo, buffers, cubeRotation) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const side = cross3(VEC3_UP, cam_looking());
  if (state.keysdown['KeyW']) state.pos = add3(state.pos, mul3_f(cam_looking(),  0.1));
  if (state.keysdown['KeyS']) state.pos = add3(state.pos, mul3_f(cam_looking(), -0.1));
  if (state.keysdown['KeyA']) state.pos = add3(state.pos, mul3_f(         side,  0.1));
  if (state.keysdown['KeyD']) state.pos = add3(state.pos, mul3_f(         side, -0.1));

  const fieldOfView = (45 * Math.PI) / 180;
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4_perspective(fieldOfView, aspect, zNear, zFar);
  const viewMatrix = mat4_target_to(
    state.pos,
    add3(cam_looking(), state.pos),
    VEC3_UP
  );
  const viewProjectionMatrix = projectionMatrix.multiply(viewMatrix.inverse());
  // const viewProjectionMatrix = viewMatrix.multiply(projectionMatrix);
  // const viewProjectionMatrix = projectionMatrix;

  cubeRotation *= 0.01;
  const modelViewMatrix = new DOMMatrix()
    .translate(-0, 0, 6)
    .rotate(cubeRotation, cubeRotation * 0.7, cubeRotation * 0.3);

  {
    const numComponents = 3;
    const type = gl.FLOAT; // the data in the buffer is 32bit floats
    const normalize = false; // don't normalize
    const stride = 0; // how many bytes to get from one set of values to the next
    // 0 = use type and numComponents above
    const offset = 0; // how many bytes inside the buffer to start from
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
  {
    const numComponents = 4;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexColor,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
  gl.useProgram(programInfo.program);

  // Set the shader uniforms
  const mat_to_arr = mat => [
    mat.m11, mat.m12, mat.m13, mat.m14,
    mat.m21, mat.m22, mat.m23, mat.m24,
    mat.m31, mat.m32, mat.m33, mat.m34,
    mat.m41, mat.m42, mat.m43, mat.m44 
  ];
  gl.uniformMatrix4fv(
    programInfo.uniformLocations.viewProjectionMatrix,
    false,
    mat_to_arr(viewProjectionMatrix)
  );
  gl.uniformMatrix4fv(
    programInfo.uniformLocations.modelViewMatrix,
    false,
    mat_to_arr(modelViewMatrix)
  );

  {
    const vertexCount = 36;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }
}

function initShaderProgram(gl) {
  const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying lowp vec4 vColor;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vColor = aVertexColor;
    }
  `;
  const fsSource = `
    varying lowp vec4 vColor;

    void main(void) {
      gl_FragColor = vColor;
    }
  `;

  function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(
        `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`
      );

    return shader;
  }

  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
    throw new Error(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(
        shaderProgram
      )}`
    );

  return shaderProgram;
}

(function main() {
  const canvas = document.getElementById("p1");
  const gl = canvas.getContext("webgl");

  if (gl === null) alert(
    "Unable to initialize WebGL. Your browser or machine may not support it."
  );

  const shaderProgram = initShaderProgram(gl);

  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      vertexColor: gl.getAttribLocation(shaderProgram, "aVertexColor"),
    },
    uniformLocations: {
      viewProjectionMatrix: gl.getUniformLocation(
        shaderProgram,
        "uProjectionMatrix"
      ),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
    },
  };

  const buffers = initBuffers(gl);

  canvas.addEventListener("click", () => {
    canvas.requestPointerLock({
      unadjustedMovement: true
    });
  });

  (window.onresize = () => {
    gl.viewport(
      0,
      0,
      canvas.width = window.innerWidth,
      canvas.height = window.innerHeight
    );
  })();

  // Draw the scene repeatedly
  let last;
  requestAnimationFrame(function render(now) {
    requestAnimationFrame(render);

    let dt = 0;
    if (last != undefined) dt = now - last;
    last = now;

    draw_scene(gl, programInfo, buffers, now);
  });
})();
