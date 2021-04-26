let img;

// preload is an event function called before setup
function preload() {
  img = loadImage("Oo.png");
}

function setup() {
  // image processing
  createCanvas(img.width, img.height);
  img.loadPixels();
  for (let x = 0; x < img.width; x++) {
    for (let y = 0; y < img.height; y++) {
      // index into pixels array
      let i = (x + y * img.width) * 4;

      // extract red, green, blue, alpha
      let r = img.pixels[i];
      let g = img.pixels[i + 1];
      let b = img.pixels[i + 2];

      if (b === 255 && g === 80 && r === 80) {
        r = 0;
        g = 0;
        b = 0;
      }

      // write red, blue, green, alpha
      img.pixels[i] = r;
      img.pixels[i + 1] = g;
      img.pixels[i + 2] = b;
    }
  }
  img.updatePixels();

  // display image
  image(img, 0, 0);
}
