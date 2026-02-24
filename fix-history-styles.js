const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/history/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target1 = 'style="background: conic-gradient(#2b8cee 0% 58%, #1f2d3a 58% 100%);"';
const replace1 = 'style={{ background: `conic-gradient(#2b8cee 0% 58%, #1f2d3a 58% 100%)` }}';

const target2 = 'style="clip-path: polygon(50% 10%, 90% 35%, 80% 80%, 20% 80%, 10% 35%);"';
const replace2 = 'style={{ clipPath: `polygon(50% 10%, 90% 35%, 80% 80%, 20% 80%, 10% 35%)` }}';

if (content.includes(target1)) {
    content = content.replace(target1, replace1);
    console.log('Fixed target 1');
} else {
    console.log('Target 1 not found');
}

if (content.includes(target2)) {
    content = content.replace(target2, replace2);
    console.log('Fixed target 2');
} else {
    console.log('Target 2 not found');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');
