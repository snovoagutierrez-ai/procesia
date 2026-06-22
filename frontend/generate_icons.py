from svglib.svglib import svg2rlg
from reportlab.graphics import renderPM
import os
from PIL import Image

svg_path = "public/aiproces-logo.svg"
icon_192_path = "public/icon-192x192.png"
icon_512_path = "public/icon-512x512.png"
maskable_path = "public/icon-maskable-512x512.png"

# We first render to a high-res PNG (512x512)
drawing = svg2rlg(svg_path)
# We need to scale the drawing if it's not 512x512
# Assuming standard scale, we can scale it explicitly but it's easier to just use Pillow to resize later
temp_png = "temp.png"
renderPM.drawToFile(drawing, temp_png, fmt="PNG", dpi=300)

with Image.open(temp_png) as img:
    # Resize to 512x512
    img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    img_512.save(icon_512_path)
    
    # Resize to 192x192
    img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    img_192.save(icon_192_path)
    
    # For maskable icon, typically we add padding
    maskable = Image.new('RGBA', (512, 512), (19, 32, 43, 255)) # #13202B color
    
    # Calculate size for inner icon (say 80% size)
    inner_size = 410
    img_inner = img.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    offset = ((512 - inner_size) // 2, (512 - inner_size) // 2)
    maskable.paste(img_inner, offset, img_inner)
    maskable.save(maskable_path)

os.remove(temp_png)
print("Icons generated successfully!")
