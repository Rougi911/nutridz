#!/usr/bin/env node
/**
 * generate-icons.js
 * Génère toutes les icônes PWA à partir d'un SVG
 * Usage : node generate-icons.js
 * Dépendance : npm install sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../public/icons');
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Icône SVG NutriDZ (feuille verte avec "N")
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#1A6B3C"/>
  <text x="256" y="340" text-anchor="middle" font-family="Arial,sans-serif"
    font-size="300" font-weight="700" fill="white">N</text>
  <circle cx="370" cy="140" r="40" fill="#97C459" opacity="0.9"/>
</svg>`;

async function generateIcons() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const svgBuffer = Buffer.from(SVG);

  for (const size of SIZES) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(OUT_DIR, `icon-${size}.png`));
    console.log(`✅ icon-${size}.png généré`);
  }

  console.log('\n🎉 Toutes les icônes sont dans public/icons/');
}

generateIcons().catch(console.error);
