# EditPicture for Obsidian

A lightweight, mobile-friendly utility plugin that lets you apply basic image processing directly within Obsidian. Quickly invert colors or remove black backgrounds from your images without needing to open external graphics editors.

## 1. Why use this?
When taking notes in Dark Mode, inserting images with solid white backgrounds (like math formulas, charts, or diagrams) can be visually jarring. On the flip side, dark images might need their black backgrounds removed to blend seamlessly with your theme. 

**EditPicture** allows you to select an image link in your note and instantly generate a Dark Mode-friendly version, automatically updating the link to point to the new file.

## 2. Features
- **Invert Colors:** Automatically inverts image colors while tweaking contrast (+0.3) and brightness (-0.05) to make the resulting image look perfectly balanced in Obsidian's Dark Mode. Works on PNG, JPG, JPEG, and BMP files.
- **Remove Black Backgrounds:** Scans the image and turns dark/black pixels transparent. 
- **Smart Format Conversion:** Since JPEG and standard BMP formats do not support transparency, removing the background from them will automatically convert and save the new file as a `.png` to preserve the alpha channel.
- **Non-Destructive Workflow:** The plugin never overwrites your original files. It safely generates a new copy with an automatic version suffix (e.g., `image_ep-v1.png`, `image_ep-v2.jpg`).
- **Auto-Replace Links:** You can choose to just generate the new image file in your vault, or have the plugin automatically replace the currently selected markdown link to display the new version instantly.
- **Mobile Compatible:** Built using the native HTML5 Canvas API with zero external dependencies. It runs locally and flawlessly on both desktop and mobile versions of Obsidian.

## 3. Important Limitations
Before using the plugin, please note how the processing engine works:

1. **Supported Formats:** The plugin natively processes `.png`, `.jpg`, `.jpeg`, and `.bmp` files. Other formats like SVG or GIF are not supported by the canvas engine and will be ignored.
2. **Global Black Removal:** The "Remove background" command does not use AI object detection. It strictly makes *all* pixels transparent that are close to absolute black. This is perfect for formulas, charts, and simple diagrams, but running it on regular photographs will create "holes" wherever there are dark shadows.

## 4. Commands
To use the plugin, select an image link in your editor (e.g., `![[image.png]]` or `![alt](image.png)`) and run one of the following commands from the Command Palette:

- **Invert colors (create new version):** Inverts the image and saves it as a new file in the vault.
- **Invert colors (replace link):** Inverts the image, saves it, and replaces your selected link with the new file.
- **Remove background (create new version):** Makes black pixels transparent and saves as a new file.
- **Remove background (replace link):** Makes black pixels transparent and updates the selected link.

## 5. Installation

### Manual Installation
Copy over `main.js` and `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-edit-picture/`.
