"""Build the self-contained website with the Python standard library."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent
preset = json.loads((root / "preset.json").read_text(encoding="utf-8"))
html = (root / "template.html").read_text(encoding="utf-8")
replacements = {
    "__PRESET__": json.dumps(preset, ensure_ascii=False).replace("</", "<\\/"),
    "__IMAGE__": preset["imageData"],
    "__DETECTOR__": (root / "auto-boundaries.js").read_text(encoding="utf-8"),
    "__AUTO_UI__": (root / "auto-ui.js").read_text(encoding="utf-8"),
    "__EXPORT_ENGINE__": (root / "export-engine.js").read_text(encoding="utf-8"),
    "__SAVE_UI__": (root / "save-ui.js").read_text(encoding="utf-8"),
}
for marker, content in replacements.items():
    if marker not in html:
        raise ValueError(f"Missing template marker {marker}")
    html = html.replace(marker, content)

output = root / "dist"
output.mkdir(exist_ok=True)
(output / "index.html").write_text(html, encoding="utf-8")
(output / ".nojekyll").write_text("", encoding="utf-8")
scripts = re.findall(r"<script(?: [^>]*)?>(.*?)</script>", html, re.S)
syntax = "\n".join(s for s in scripts if not s.lstrip().startswith("{"))
(root / "check-syntax.js").write_text(syntax, encoding="utf-8")
print(f"Built dist/index.html ({len(html.encode('utf-8')):,} bytes)")
