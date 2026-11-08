import { looksBlack } from './looks-black';

/** Pixels per side of the small copy that's checked for an all-black frame. */
const CHECK_SIZE = 16;
const UNDRAWABLE =
  "This phone wouldn't draw frames from this video. Try a photo instead, or tell us which phone and video it was.";

const VERTEX_SHADER = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = vec2((position.x + 1.0) / 2.0, (1.0 - position.y) / 2.0);
  gl_Position = vec4(position, 0.0, 1.0);
}`;
const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D frame;
varying vec2 uv;
void main() {
  gl_FragColor = texture2D(frame, uv);
}`;

/**
 * Draws the frame a video is showing onto a 2D canvas.
 *
 * The plain way, drawImage, drew only black on an iPhone (iOS 26) for a video the pose model
 * read fine, likely the iPhone's HDR video. The pose model reads frames through WebGL, so when
 * drawImage gives an all-black frame this draws through WebGL instead, and keeps using that.
 */
export class VideoFrameDrawer {
  private mode: '2d' | 'webgl' = '2d';
  private gl: { canvas: HTMLCanvasElement; context: WebGLRenderingContext } | null = null;

  draw(video: HTMLVideoElement, target: HTMLCanvasElement, width: number, height: number): void {
    if (target.width !== width) target.width = width;
    if (target.height !== height) target.height = height;
    const context = target.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error(UNDRAWABLE);

    if (this.mode === '2d') {
      context.drawImage(video, 0, 0, width, height);
      if (!isBlank(target)) return;
      this.mode = 'webgl';
    }
    context.drawImage(this.drawWithWebGL(video, width, height), 0, 0, width, height);
    if (isBlank(target)) throw new Error(UNDRAWABLE);
  }

  dispose(): void {
    this.gl?.context.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
  }

  private drawWithWebGL(video: HTMLVideoElement, width: number, height: number) {
    const { canvas, context: gl } = this.webgl();
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return canvas;
  }

  /** One WebGL canvas per video, made the first time it's needed: phones allow only a few. */
  private webgl() {
    if (this.gl) return this.gl;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) throw new Error(UNDRAWABLE);

    const program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX_SHADER],
      [gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error(UNDRAWABLE);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(UNDRAWABLE);
    gl.useProgram(program);

    // Two triangles covering the whole canvas.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    // Video sizes are rarely powers of two, which WebGL 1 allows only without mipmaps or repeats.
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.gl = { canvas, context: gl };
    return this.gl;
  }
}

/** Whether a canvas came out all black, judged from a small copy of it. */
function isBlank(canvas: HTMLCanvasElement): boolean {
  const small = document.createElement('canvas');
  small.width = CHECK_SIZE;
  small.height = CHECK_SIZE;
  const context = small.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(canvas, 0, 0, CHECK_SIZE, CHECK_SIZE);
  return looksBlack(context.getImageData(0, 0, CHECK_SIZE, CHECK_SIZE).data);
}
