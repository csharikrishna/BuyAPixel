from PIL import Image
import os

light_path = "public/logo/light_theme.jpeg"
dark_path = "public/logo/dark_theme.jpeg"

if os.path.exists(light_path):
    with Image.open(light_path) as img:
        print(f"Light theme logo dimensions: {img.width}x{img.height}, format: {img.format}")

if os.path.exists(dark_path):
    with Image.open(dark_path) as img:
        print(f"Dark theme logo dimensions: {img.width}x{img.height}, format: {img.format}")
