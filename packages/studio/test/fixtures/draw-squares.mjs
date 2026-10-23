// A drawing script, as an agent writes one: a 16×16 square and a sheet of two 8×8 frames.
export default async ({ createCanvas, save }) => {
  const square = createCanvas(16, 16);
  const context = square.getContext('2d');
  context.fillStyle = '#ff0000';
  context.fillRect(4, 4, 8, 8);
  await save('shapes/square', square, { tags: ['shape'] });

  const sheet = createCanvas(16, 8);
  const frames = sheet.getContext('2d');
  frames.fillStyle = '#00ff00';
  frames.fillRect(0, 0, 8, 8);
  frames.fillStyle = '#0000ff';
  frames.fillRect(8, 0, 8, 8);
  await save('shapes/blink', sheet, { kind: 'spritesheet', frames: { width: 8, height: 8, count: 2 } });
};
