from PIL import Image

def remove_background(image_path):
    img = Image.open(image_path).convert("RGBA")
    datas = img.getdata()

    new_data = []
    # We will assume the top-left pixel is the background color
    # and anything within a certain distance of it is background.
    bg_color = datas[0]
    
    # Or simply: if the pixel is very bright, make it transparent.
    # But let's use distance to the background color.
    threshold = 30 # tolerance
    
    for item in datas:
        # Calculate distance to background color
        if abs(item[0] - bg_color[0]) < threshold and \
           abs(item[1] - bg_color[1]) < threshold and \
           abs(item[2] - bg_color[2]) < threshold:
            new_data.append((255, 255, 255, 0)) # Fully transparent
        else:
            # Maybe the edges of the dots have anti-aliasing.
            # We could do partial transparency, but solid is fine for now.
            new_data.append(item)

    img.putdata(new_data)
    img.save(image_path, "PNG")
    print("Background removed successfully!")

if __name__ == "__main__":
    remove_background(r"C:\Antigravity IDE\WEB DEIS\Portal_Web\mapa_chile.png")
