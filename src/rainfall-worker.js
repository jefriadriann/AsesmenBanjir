import {createRainfallRenderer} from './rainfall-render.js';

let draw;
self.onmessage = ({data: {input, id, coords}}) => {
  if (input) {
    draw = createRainfallRenderer(input);
    return;
  }
  try {
    const tile = draw(new OffscreenCanvas(256, 256), coords);
    const bitmap = tile.transferToImageBitmap();
    self.postMessage({id, bitmap}, [bitmap]);
  } catch {
    self.postMessage({id, error: true});
  }
};
