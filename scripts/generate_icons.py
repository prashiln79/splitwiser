import math
from PIL import Image, ImageDraw, ImageFilter

INPUT_PATH = '/Users/prashilwadkar/.gemini/antigravity/brain/5112281c-7de0-4a59-bacf-3c1d8cde2527/.user_uploaded/media_1793875968844_5c7029b2.jpg'
ASSETS_DIR = 'assets'

def main():
    src = Image.open(INPUT_PATH).convert('RGBA')
    w, h = src.size

    # 1. Supersampled anti-aliased extraction of the squircle (126, 119, 895, 897)
    scale = 4
    mask_hi = Image.new('L', (w * scale, h * scale), 0)
    draw_hi = ImageDraw.Draw(mask_hi)
    box_hi = [126 * scale, 119 * scale, 895 * scale, 897 * scale]
    radius_hi = 175 * scale
    draw_hi.rounded_rectangle(box_hi, radius=radius_hi, fill=255)
    mask = mask_hi.resize((w, h), Image.Resampling.LANCZOS)

    isolated_squircle = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    isolated_squircle.paste(src, (0, 0), mask)
    cropped_squircle = isolated_squircle.crop((126, 119, 895, 897))

    # 2. Build full-bleed 1024x1024 background (mint top-left, dark emerald bottom-right)
    # Bottom-right: #015c43 (1, 92, 67)
    bg = Image.new('RGBA', (1024, 1024), (1, 92, 67, 255))
    draw_bg = ImageDraw.Draw(bg)

    # Diagonal partition from (0, 755) to (1024, 215)
    mint_poly = [(0, 0), (1024, 0), (1024, 215), (0, 755)]
    draw_bg.polygon(mint_poly, fill=(162, 233, 196, 255))

    # Soft radial mint glow from top-left
    grad_overlay = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    draw_grad = ImageDraw.Draw(grad_overlay)
    for r in range(650, 0, -20):
        alpha = int(75 * (1 - r / 650))
        draw_grad.ellipse([-r, -r, r, r], fill=(225, 253, 238, alpha))
    grad_overlay = grad_overlay.filter(ImageFilter.GaussianBlur(30))
    bg.paste(grad_overlay, (0, 0), grad_overlay)

    # 3. Save icon.png (1024x1024, full bleed opaque RGB for iOS / App Store / Play Store)
    icon_fb = bg.copy()
    scale_fb = 1024.0 / max(cropped_squircle.size)
    cw = int(cropped_squircle.width * scale_fb)
    ch = int(cropped_squircle.height * scale_fb)
    icon_scaled = cropped_squircle.resize((cw, ch), Image.Resampling.LANCZOS)
    px = (1024 - cw) // 2
    py = (1024 - ch) // 2
    icon_fb.paste(icon_scaled, (px, py), icon_scaled)

    # Convert to RGB (no alpha) for App Store guideline compliance
    icon_final = icon_fb.convert('RGB')
    icon_final.save(f'{ASSETS_DIR}/icon.png', 'PNG')
    print('✓ Generated assets/icon.png (1024x1024 full-bleed RGB)')

    # 4. Save Android Adaptive Icon (1024x1024, safe zone scaled to 660px)
    # Background extends across the canvas so circle/squircle masks clip cleanly
    adaptive_bg = bg.copy()
    scale_ad = 660.0 / max(cropped_squircle.size)
    aw = int(cropped_squircle.width * scale_ad)
    ah = int(cropped_squircle.height * scale_ad)
    adaptive_scaled = cropped_squircle.resize((aw, ah), Image.Resampling.LANCZOS)
    apx = (1024 - aw) // 2
    apy = (1024 - ah) // 2
    adaptive_bg.paste(adaptive_scaled, (apx, apy), adaptive_scaled)
    adaptive_bg.save(f'{ASSETS_DIR}/adaptive-icon.png', 'PNG')
    adaptive_bg.save(f'{ASSETS_DIR}/adaptive-icon/foreground.png', 'PNG')
    print('✓ Generated assets/adaptive-icon.png (1024x1024 safe-zone)')

    # Solid background for adaptive-icon/background.png
    bg_solid = Image.new('RGB', (1024, 1024), (1, 92, 67))
    bg_solid.save(f'{ASSETS_DIR}/adaptive-icon/background.png', 'PNG')

    # 5. Save splash-icon.png (1024x1024 with transparent background, centered)
    splash = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    scale_splash = 560.0 / max(cropped_squircle.size)
    sw = int(cropped_squircle.width * scale_splash)
    sh = int(cropped_squircle.height * scale_splash)
    splash_scaled = cropped_squircle.resize((sw, sh), Image.Resampling.LANCZOS)
    spx = (1024 - sw) // 2
    spy = (1024 - sh) // 2
    splash.paste(splash_scaled, (spx, spy), splash_scaled)
    splash.save(f'{ASSETS_DIR}/splash-icon.png', 'PNG')
    print('✓ Generated assets/splash-icon.png (1024x1024 transparent)')

    # 6. Save favicon.png (48x48)
    favicon = cropped_squircle.resize((48, 48), Image.Resampling.LANCZOS)
    favicon.save(f'{ASSETS_DIR}/favicon.png', 'PNG')
    print('✓ Generated assets/favicon.png (48x48)')

    # 7. Save splash.png (2048x2048, centered new icon on white background)
    splash_full = Image.new('RGBA', (2048, 2048), (255, 255, 255, 255))
    splash_logo_size = 560
    scale_sp_full = splash_logo_size / max(cropped_squircle.size)
    spw = int(cropped_squircle.width * scale_sp_full)
    sph = int(cropped_squircle.height * scale_sp_full)
    sp_scaled = cropped_squircle.resize((spw, sph), Image.Resampling.LANCZOS)
    sp_x = (2048 - spw) // 2
    sp_y = (2048 - sph) // 2
    splash_full.paste(sp_scaled, (sp_x, sp_y), sp_scaled)
    splash_full.convert('RGB').save(f'{ASSETS_DIR}/splash.png', 'PNG')
    print('✓ Generated assets/splash.png (2048x2048)')

if __name__ == '__main__':
    main()
