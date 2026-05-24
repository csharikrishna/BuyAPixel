import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Let's use standard node/powershell to get image info or just look at them.
// We can use a quick PowerShell command to get image dimensions.
const imagePathLight = path.resolve('public/logo/light_theme.jpeg');
const imagePathDark = path.resolve('public/logo/dark_theme.jpeg');

console.log('Light Theme Logo exists:', fs.existsSync(imagePathLight));
console.log('Dark Theme Logo exists:', fs.existsSync(imagePathDark));
