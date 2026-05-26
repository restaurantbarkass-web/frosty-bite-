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
    
    let img;
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

    // Draw some simple custom styling so the placeholders look premium
    // Draw a prominent contrasting accent stripe or box
    try {
      if (target.name.includes('logo')) {
        // High-contrast central white/pink cake shape or block
        const stripeSize = Math.floor(target.width * 0.4);
        const offset = Math.floor((target.width - stripeSize) / 2);
        
        // Use scan or simple pixel manipulation to draw an interior contrast square
        img.scan(offset, offset, stripeSize, stripeSize, function (x, y, idx) {
          this.bitmap.data[idx] = 255;     // R
          this.bitmap.data[idx + 1] = 255; // G
          this.bitmap.data[idx + 2] = 255; // B
          this.bitmap.data[idx + 3] = 255; // A
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
