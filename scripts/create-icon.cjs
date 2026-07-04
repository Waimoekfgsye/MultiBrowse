const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const buildDir = path.join(__dirname, '..', 'build');

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

// Save SVG version of the icon
const svgIcon = '<?xml version="1.0" encoding="UTF-8"?>\n<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">\n  <rect width="256" height="256" rx="48" fill="#0a0a0f"/>\n  <rect x="2" y="2" width="252" height="252" rx="46" fill="none" stroke="#1a1a26" stroke-width="2"/>\n  <g transform="translate(64, 56)">\n    <path d="M64 8L16 32V72C16 104 36 132 64 144C92 132 112 104 112 72V32L64 8Z" fill="none" stroke="#e8d44d" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>\n    <path d="M64 32L40 44V64C40 80 48 94 64 102C80 94 88 80 88 64V44L64 32Z" fill="#e8d44d" opacity="0.15"/>\n    <path d="M50 68L60 78L78 58" fill="none" stroke="#e8d44d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>\n  </g>\n</svg>';

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);
console.log('SVG icon created.');
