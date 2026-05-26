import fs from 'fs';
import path from 'path';

async function generate() {
  console.log('Detecting Jimp module...');
  let JimpModule;
  try {
    JimpModule = await import('jimp');
  } catch (err) {
    console.error('Failed to import jimp:', err);
    process.exit(1);
  }

  // Handle both default and named exports depending on the installed Jimp version
  const Jimp = JimpModule.Jimp || JimpModule.default || JimpModule;

  console.log('Jimp version loaded successfully.');

  const logoUrl = 'https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg';
  let logoBuffer = null;
  try {
    console.log(`Downloading custom user logo from ${logoUrl}...`);
    const res = await fetch(logoUrl);
    if (res.ok) {
      logoBuffer = Buffer.from(await res.arrayBuffer());
      console.log(`Successfully downloaded premium logo. Size: ${logoBuffer.length} bytes`);
    } else {
      console.warn(`Download returned status: ${res.status}. Procedural drawing will be used.`);
    }
  } catch (err) {
    console.warn(`Could not fetch custom logo: ${err.message}. Procedural drawing fallback active.`);
  }

  const targets = [
    { name: 'logo.png', width: 512, height: 512, color: 0xff0055ff },
    { name: 'logo_192.png', width: 192, height: 192, color: 0xff0055ff },
    { name: 'logo_512.png', width: 512, height: 512, color: 0xff0055ff },
    { name: 'screenshot_narrow.png', width: 1080, height: 1920, color: 0x1f1218ff },
    { name: 'screenshot_wide.png', width: 1920, height: 1080, color: 0x121214ff }
  ];

  for (const target of targets) {
    const filePath = path.join('public', target.name);
    console.log(`Generating ${target.name} (${target.width}x${target.height})...`);
    
    let img = null;
    
    if (target.name.includes('logo') && logoBuffer) {
      try {
        console.log(`Loading and resizing custom downloaded logo for ${target.name}...`);
        const srcImg = await Jimp.read(logoBuffer);
        try {
          img = srcImg.resize({ width: target.width, height: target.height });
        } catch (resizeErr) {
          img = srcImg.resize(target.width, target.height);
        }
      } catch (err) {
        console.error(`Jimp encountered layout or decoding error processing user logo. Falling back to procedural layout. Error: ${err.message}`);
        img = null;
      }
    }

    if (!img) {
      // For Jimp v1, the constructor expects an object: { width, height, color }
      try {
        img = new Jimp({
          width: target.width,
          height: target.height,
          color: target.color
        });
      } catch (e) {
        console.warn(`Jimp constructor failed with object, trying positional arguments: ${e.message}`);
        img = new Jimp(target.width, target.height, target.color);
      }
    }

    // Draw some simple custom styling so the placeholders look premium
    try {
      if (target.name.includes('logo') && !logoBuffer) {
        const cw = target.width;
        const ch = target.height;
        const cx = cw / 2;
        const cy = ch / 2;
        
        // Scan the entire icon canvas and apply premium artisan shapes
        img.scan(0, 0, cw, ch, function (x, y, idx) {
          const dx = x - cx;
          const dy = y - cy;
          const r = Math.sqrt(dx * dx + dy * dy);
          const rMax = Math.min(cx, cy);
          
          // Normalized relative coordinates (-1.0 to 1.0)
          const u = dx / (cw / 2);
          const v = dy / (ch / 2);

          // 1. Core Background: Fill the entire square background with dark velvet slate
          this.bitmap.data[idx] = 11;      // R
          this.bitmap.data[idx + 1] = 10;   // G
          this.bitmap.data[idx + 2] = 13;   // B
          this.bitmap.data[idx + 3] = 255;  // A

          // 2. Neon-pink aesthetic outer glowing circular border ring
          const ringInner = rMax * 0.84;
          const ringOuter = rMax * 0.90;
          if (r >= ringInner && r <= ringOuter) {
            // Neon pink / strawberry red glow
            this.bitmap.data[idx] = 255;
            this.bitmap.data[idx + 1] = 0;
            this.bitmap.data[idx + 2] = 85;
            this.bitmap.data[idx + 3] = 255;
            return;
          }

          // 3. Inner premium circular badge frame
          if (r < ringInner) {
            // Elegant deeper black velvet accent
            this.bitmap.data[idx] = 18;
            this.bitmap.data[idx + 1] = 17;
            this.bitmap.data[idx + 2] = 21;
            this.bitmap.data[idx + 3] = 255;
          }

          // 4. ARTISAN CUPCAKE / PASTRY GRAPHIC
          // A. Golden Bakery Liner Base (Trapezoid shape at the bottom)
          // v starts around 0.1 and goes down to 0.45, with balanced tapering width
          if (v >= 0.1 && v <= 0.46) {
            const widthBound = 0.28 - 0.08 * (v - 0.1); 
            if (Math.abs(u) <= widthBound) {
              // Sweet golden hazelnut pastry color (#e2aa76)
              this.bitmap.data[idx] = 226;
              this.bitmap.data[idx + 1] = 170;
              this.bitmap.data[idx + 2] = 118;
              this.bitmap.data[idx + 3] = 255;
              
              // Decorative liner ridges
              if (Math.floor(x / (cw * 0.05)) % 2 === 0) {
                // Slightly darker lines for texture
                this.bitmap.data[idx] = 196;
                this.bitmap.data[idx + 1] = 135;
                this.bitmap.data[idx + 2] = 80;
              }
              return;
            }
          }

          // B. Vanilla Creme Swirl (Middle fluffy frosting layer)
          const rCreamX = 0.38;
          const rCreamY = 0.18;
          const offsetCreamY = 0.04;
          const dCream = (u * u) / (rCreamX * rCreamX) + ((v - offsetCreamY) * (v - offsetCreamY)) / (rCreamY * rCreamY);
          if (dCream <= 1.0 && v <= 0.12) {
            // Elegant creamy white bakery frosting (#fff5f2)
            this.bitmap.data[idx] = 255;
            this.bitmap.data[idx + 1] = 245;
            this.bitmap.data[idx + 2] = 242;
            this.bitmap.data[idx + 3] = 255;
            return;
          }

          // C. Pink Strawberry Creme Swirl (Top frosting swirl layer)
          const rPinkX = 0.26;
          const rPinkY = 0.15;
          const offsetPinkY = -0.12;
          const dPink = (u * u) / (rPinkX * rPinkX) + ((v - offsetPinkY) * (v - offsetPinkY)) / (rPinkY * rPinkY);
          if (dPink <= 1.0 && v <= 0.02) {
            // Vibrant velvet neon peak pink color (#ff0055)
            this.bitmap.data[idx] = 255;
            this.bitmap.data[idx + 1] = 0;
            this.bitmap.data[idx + 2] = 85;
            this.bitmap.data[idx + 3] = 255;
            return;
          }

          // D. Cherry Star on Top
          const rCherry = 0.07;
          const offsetCherryY = -0.32;
          const dCherry = (u * u) / (rCherry * rCherry) + ((v - offsetCherryY) * (v - offsetCherryY)) / (rCherry * rCherry);
          if (dCherry <= 1.0) {
            // Sweet cherry ruby red color (#df2c4e)
            this.bitmap.data[idx] = 223;
            this.bitmap.data[idx + 1] = 44;
            this.bitmap.data[idx + 2] = 78;
            this.bitmap.data[idx + 3] = 255;
            return;
          }
        });
      } else if (target.name.includes('narrow')) {
        // Vertical screenshot mockup: pink header at top, some product cards
        // Pink header (height: 250px)
        img.scan(0, 0, target.width, 300, function (x, y, idx) {
          this.bitmap.data[idx] = 255;     // R
          this.bitmap.data[idx + 1] = 0;   // G
          this.bitmap.data[idx + 2] = 85;  // B
          this.bitmap.data[idx + 3] = 255; // A
        });
        
        // A couple of "pastry cards" - white rounded rectangles in the middle
        const cardW = 880;
        const cardH = 350;
        const startX = 100;
        
        [500, 950, 1400].forEach(topY => {
          img.scan(startX, topY, cardW, cardH, function (x, y, idx) {
            this.bitmap.data[idx] = 40;     // R
            this.bitmap.data[idx + 1] = 40;  // G
            this.bitmap.data[idx + 2] = 45;  // B
            this.bitmap.data[idx + 3] = 255; // A
          });
          // Draw pink accent inside products
          img.scan(startX + 40, topY + 40, 200, 270, function (x, y, idx) {
            this.bitmap.data[idx] = 255;     // R
            this.bitmap.data[idx + 1] = 0;   // G
            this.bitmap.data[idx + 2] = 85;  // B
            this.bitmap.data[idx + 3] = 255; // A
          });
        });
      } else if (target.name.includes('wide')) {
        // Horizontal screenshot mockup
        // Left side navbar (width: 350)
        img.scan(0, 0, 350, target.height, function (x, y, idx) {
          this.bitmap.data[idx] = 20;     // R
          this.bitmap.data[idx + 1] = 20;  // G
          this.bitmap.data[idx + 2] = 25;  // B
          this.bitmap.data[idx + 3] = 255; // A
        });
        
        // Large promo banner
        img.scan(450, 80, 1370, 400, function (x, y, idx) {
          this.bitmap.data[idx] = 255;     // R
          this.bitmap.data[idx + 1] = 0;   // G
          this.bitmap.data[idx + 2] = 85;  // B
          this.bitmap.data[idx + 3] = 255; // A
        });

        // Store grid items
        const gridW = 400;
        const gridH = 400;
        [450, 935, 1420].forEach(startX => {
          img.scan(startX, 560, gridW, gridH, function (x, y, idx) {
            this.bitmap.data[idx] = 30;     // R
            this.bitmap.data[idx + 1] = 30;  // G
            this.bitmap.data[idx + 2] = 35;  // B
            this.bitmap.data[idx + 3] = 255; // A
          });
        });
      }
    } catch (e) {
      console.warn(`Visual pixel drawing warm-up was skipped: ${e.message}`);
    }

    console.log(`Writing ${target.name} to disk...`);
    await img.write(filePath);
    console.log(`Successfully generated ${target.name}. File size: ${fs.statSync(filePath).size} bytes`);
  }

  console.log('All image placeholder targets generated successfully!');
}

generate().catch(err => {
  console.error('Generation script failed:', err);
  process.exit(1);
});
