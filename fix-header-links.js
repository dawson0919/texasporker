const fs = require('fs');
const path = require('path');

function fixLinksInFile(fileRelativePath, replacements) {
    const filePath = path.join(__dirname, fileRelativePath);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    for (const r of replacements) {
        content = content.replace(r.regex, r.replacement);
    }

    if (original !== content) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${fileRelativePath}`);
    } else {
        console.log(`No changes needed for ${fileRelativePath}`);
    }
}

// Leaderboard and Page (Traditional Chinese nav)
const tcReplacements = [
    {
        regex: /<a([^>]+)href="#"([^>]*)>\s*大廳\s*<\/a>/g,
        replacement: '<Link$1href="/lobby"$2>大廳</Link>'
    },
    {
        regex: /<a([^>]+)href="#"([^>]*)>\s*牌桌\s*<\/a>/g,
        replacement: '<Link$1href="/"$2>牌桌</Link>'
    },
    {
        regex: /<a([^>]+)href="#"([^>]*)>\s*排行榜\s*<\/a>/g,
        replacement: '<Link$1href="/leaderboard"$2>排行榜</Link>'
    }
];

// History (English nav)
const enReplacements = [
    {
        regex: /<a([^>]+)href="#"([^>]*)>\s*Lobby\s*<\/a>/g,
        replacement: '<Link$1href="/lobby"$2>Lobby</Link>'
    },
    {
        regex: /<a([^>]+)href="#"([^>]*)>\s*Tables\s*<\/a>/g,
        replacement: '<Link$1href="/"$2>Tables</Link>'
    }
];

fixLinksInFile('app/leaderboard/page.tsx', tcReplacements);
fixLinksInFile('app/page.tsx', tcReplacements);
fixLinksInFile('app/history/page.tsx', enReplacements);

