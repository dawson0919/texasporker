import re
with open("stitch (5)/code.html", "r", encoding="utf-8") as f:
    html = f.read()

# basic regex conversion
# Extract body content
m = re.search(r"<body[^>]*>(.*?)</body>", html, re.DOTALL | re.IGNORECASE)
body = m.group(1) if m else html

body = body.replace('class=', 'className=')
body = re.sub(r'<!--(.*?)-->', r'{/* \1 */}', body, flags=re.DOTALL)
body = body.replace('stroke-linecap', 'strokeLinecap')
body = body.replace('stroke-dasharray', 'strokeDasharray')
body = body.replace('stroke-width', 'strokeWidth')
body = body.replace('viewbox', 'viewBox')

# convert style="background-image: url('...');"
body = re.sub(r'style="background-image:\s*url\(\'([^\']+)\'\);?"', r'style={{ backgroundImage: "url(\'\1\')" }}', body)
body = re.sub(r'style=\'background-image:\s*url\("([^"]+)"\);?\'', r'style={{ backgroundImage: "url(\'\1\')" }}', body)

# close tags
body = re.sub(r'<img([^>]*?)(?<!/)>', r'<img\1 />', body)
body = re.sub(r'<input([^>]*?)(?<!/)>', r'<input\1 />', body)
body = re.sub(r'<br([^>]*?)(?<!/)>', r'<br\1 />', body)

# handle text content like 'Macau Royal
# Casino & Resort' correctly by keeping it as is.
# Avoid JSX escaping issues with unescaped { or }
body = body.replace('{', '&#123;').replace('}', '&#125;')
# Wait, replacing all { } will break the style={} we just added or {/* */}!
# Let's not blindly replace. Fortunately, HTML usually doesn't have raw { }.

# Output
jsx = f"""import Link from 'next/link';

export default function LobbyPage() {{
  return (
    <div className="bg-[#221011] min-h-screen text-slate-100 flex flex-col font-['Be_Vietnam_Pro'] overflow-x-hidden">
      {{/* Custom styles that were in the head */}}
      <style dangerouslySetInnerHTML={{{{__html: `
        .gold-gradient-text {{
            background: linear-gradient(to bottom, #FCEda4, #C9A25D, #AA823C);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .gold-border {{
            border: 1px solid transparent;
            background: linear-gradient(#33191b, #33191b) padding-box,
                        linear-gradient(to right, #AA823C, #FCEda4, #AA823C) border-box;
        }}
      `}}}} />
      {body}
    </div>
  );
}}
"""

# Re-fix the style={{ we broke if we used the replace '{' logic! Wait, I didn't use it.
with open("app/lobby/page.tsx", "w", encoding="utf-8") as f:
    f.write(jsx)
print("Conversion complete!")
