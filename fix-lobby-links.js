const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/lobby/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
    /<button className="bg-white\/5 hover:bg-white\/10 border border-white\/10 rounded-lg p-2 text-xs text-slate-300 transition-colors flex flex-col items-center gap-1">\s*<span className="material-symbols-outlined text-lg">history<\/span> 歷史紀錄\s*<\/button>/g,
    `<Link href="/history" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-2 text-xs text-slate-300 transition-colors flex flex-col items-center gap-1">
<span className="material-symbols-outlined text-lg">history</span> 歷史紀錄
</Link>`
);

content = content.replace(
    /<span className="text-xs text-primary cursor-pointer hover:underline">查看全部<\/span>/g,
    `<Link href="/leaderboard" className="text-xs text-primary cursor-pointer hover:underline">查看全部</Link>`
);

content = content.replace(
    /<button className="flex-1 bg-gradient-to-r from-accent-gold to-\[#AA823C\] text-surface-darker hover:brightness-110 font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">\s*<span className="material-symbols-outlined">play_circle<\/span> 立即遊玩\s*<\/button>/g,
    `<Link href="/" className="flex-1 bg-gradient-to-r from-accent-gold to-[#AA823C] text-surface-darker hover:brightness-110 font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
<span className="material-symbols-outlined">play_circle</span> 立即遊玩
</Link>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Lobby links updated');
