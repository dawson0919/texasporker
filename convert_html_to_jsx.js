const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3];
const componentName = process.argv[4] || 'PageComponent';
const isDark = process.argv[5] === 'true'; // Add dark mode logic if needed

if (!inputFile || !outputFile) {
    console.error("Usage: node convert_html_to_jsx.js <inputFile> <outputFile> <ComponentName>");
    process.exit(1);
}

try {
    const html = fs.readFileSync(inputFile, 'utf8');

    // Extract body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let bodyContent = bodyMatch ? bodyMatch[1] : html;

    // Convert HTML to JSX
    bodyContent = bodyContent
        .replace(/class=/g, 'className=')
        .replace(/for=/g, 'htmlFor=')
        .replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}')
        .replace(/stroke-linecap/g, 'strokeLinecap')
        .replace(/stroke-linejoin/g, 'strokeLinejoin')
        .replace(/stroke-dasharray/g, 'strokeDasharray')
        .replace(/stroke-width/g, 'strokeWidth')
        .replace(/viewbox/gi, 'viewBox')
        // Fix inline styles with background images
        .replace(/style="background-image:\s*url\('([^']+)'\);?"/g, "style={{ backgroundImage: `url('$1')` }}")
        .replace(/style='background-image:\s*url\("([^"]+)"\);?'/g, "style={{ backgroundImage: `url('$1')` }}")
        // Close unclosed tags
        .replace(/<img(.*?.+)>/g, (match) => {
            if (match.endsWith("/>")) return match;
            return match.substring(0, match.length - 1) + " />";
        })
        .replace(/<input(.*?.+)>/g, (match) => {
            if (match.endsWith("/>")) return match;
            return match.substring(0, match.length - 1) + " />";
        })
        .replace(/<br>/gi, '<br />')
        .replace(/<hr>/gi, '<hr />');

    // Extract custom styles from <head> if present
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
    let styleJSX = '';
    if (styleMatch) {
        styleJSX = `\n      <style dangerouslySetInnerHTML={{__html: \`\n${styleMatch[1]}\n      \`}} />\n`;
    }

    const jsx = `import Link from 'next/link';

export default function ${componentName}() {
  return (
    <div className="bg-[#1a160a] min-h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC'] overflow-x-hidden">
${styleJSX}
${bodyContent}
    </div>
  );
}
`;

    // Ensure output directory exists (basic logic for next.js app routing)
    const outDir = path.dirname(outputFile);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, jsx, 'utf8');
    console.log(`Successfully converted ${inputFile} to ${outputFile}`);

} catch (err) {
    console.error("Error during conversion:", err);
}
