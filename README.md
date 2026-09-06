# Obsidian Image Editor

A lightweight, fully native Obsidian plugin that allows you to quickly manipulate embedded images directly within your notes. Easily invert image colors for seamless Dark Mode viewing or remove black backgrounds—all powered natively in JavaScript without relying on external system binaries or command-line tools.

Working with diagrams, math formulas, or handwritten notes in Dark Mode often leaves you with blinding white backgrounds or low-contrast graphics. This plugin solves that by providing instant, non-destructive image processing methods that create versioned copies and update your markdown links automatically.

## ✨ Features

*   **Pure JavaScript Processing:** Powered by `jimp` to process images natively within Obsidian's Vault API. It runs seamlessly across Windows, macOS, Linux, and mobile devices (iOS/Android).
*   **Contrast-Enhanced Color Inversion:** Inverts image colors while automatically fine-tuning contrast and brightness offsets to ensure deep blacks, bright whites, and readable graphics in Dark Mode.
*   **Black Background Removal:** Scans image pixels using mathematical RGB color-distance tolerance to convert solid black backgrounds into clean, transparent PNGs.
*   **Automatic Version Control:** Generates safe, versioned file duplicates (`_v1`, `_v2`) next to the original files, protecting your source images from destructive overwrites.
*   **Flexible Workflow Actions:** Process images in the background (preserving original links for reference) or automatically replace markdown links with newly generated assets in a single step.

## 🚀 Usage

1. Select or place your cursor on any image link in Markdown format (`![Image](path/to/image.png)`) or Wikilink format (`![[image.png]]`).
2. Open the **Command Palette** (`Ctrl+P` or `Cmd+P`).
3. Run one of the available processing commands:
   *   **Remove background (replace link):** Clears the black background, saves a new version, and updates the link in your current note.
   *   **Remove background (create new version):** Processes the image into a new file in the vault without updating the active link.
   *   **Invert colors (replace link):** Inverts the image for Dark Mode readability and replaces the active note link.
   *   **Invert colors (create new version):** Generates an inverted versioned copy alongside the original image.

## 🛠️ Under the Hood

This plugin relies entirely on native Obsidian APIs and pure JS image manipulation:
*   **`app.vault.readBinary` & `app.vault.createBinary`:** Directly accesses image data from the vault's memory buffer, removing dependencies on Node.js file-system modules (`fs`) or external terminal executions (`exec`).
*   **Jimp Engine:** Utilizes client-side pixel manipulation buffers (`image.bitmap.data`) for alpha-channel transformations and native contrast/brightness corrections.
*   **Strict Path Resolution:** Integrates with `app.metadataCache.getFirstLinkpathDest` to resolve Wikilinks and relative file paths accurately across complex vault folder structures.

## 📦 Local Installation

Since this is a custom local plugin, it is loaded directly into your vault:

1. Navigate to your vault's plugin directory: `.obsidian/plugins/`
2. Create a new folder named `obsidian-edit-picture`.
3. Place the compiled `main.js` and `manifest.json` inside this folder.
4. Open Obsidian, go to **Settings > Community plugins**, and click **Reload**.
5. Enable **Image Editor** from your installed plugins list.

---
*Developed for personal vault optimization.*
