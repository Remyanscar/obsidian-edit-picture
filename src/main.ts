// noinspection JSUnusedGlobalSymbols,JSIgnoredPromiseFromCall

import { Plugin, TFile, MarkdownView, Notice } from "obsidian";
import Jimp from "jimp";

/**
 * Matches standard Markdown image links. (e.g., ![alt](path.png))
 */
const IMAGE_REGEX = /!\[.*]\((.*\.(png|jpg|jpeg|gif|bmp|svg))\)/i;

/**
 * Matches Obsidian Wikilink image links. (e.g., ![[path.png]])
 */
const WIKI_IMAGE_LINK_REGEX = /!\[\[(.*\.(png|jpg|jpeg|gif|bmp|svg))]]/i;

/**
 * Safely converts a native ArrayBuffer to a Uint8Array (or Node Buffer if available).
 * Required as a compatibility bridge for the Jimp library running in Obsidian's environment.
 */
function arrayBufferToBuffer(arrayBuffer: ArrayBuffer): Uint8Array {
    const win = window as unknown as { Buffer?: { from: (buf: ArrayBuffer) => Uint8Array } };
    if (win.Buffer) {
        return win.Buffer.from(arrayBuffer);
    }
    return new Uint8Array(arrayBuffer);
}

/**
 * Main entry point for the Obsidian Image Editor plugin.
 */
export default class EditPicture extends Plugin {
    async onload(): Promise<void> {
        this.addCommand({
            id: "remove-image-background-new-version",
            name: "Remove background (create new version)",
            callback: async () => {
                await this.handleImageProcessing("removeBackground");
            }
        });

        this.addCommand({
            id: "remove-image-background-replace-link",
            name: "Remove background (replace link)",
            callback: async () => {
                await this.handleImageProcessing("removeBackground", true);
            }
        });

        this.addCommand({
            id: "invert-image-colors-new-version",
            name: "Invert colors (create new version)",
            callback: async () => {
                await this.handleImageProcessing("invertColors");
            }
        });

        this.addCommand({
            id: "invert-image-colors-replace-link",
            name: "Invert colors (replace link)",
            callback: async () => {
                await this.handleImageProcessing("invertColors", true);
            }
        });
    }

    /**
     * Core router for image processing. Determines the active image link, resolves its file path,
     * applies the requested Jimp filter, and optionally updates the Markdown editor selection.
     */
    async handleImageProcessing(action: "removeBackground" | "invertColors", replaceLink = false): Promise<void> {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const editor = activeView.editor;
        const selection = editor.getSelection();
        const match = selection.match(IMAGE_REGEX) || selection.match(WIKI_IMAGE_LINK_REGEX);

        if (match && match[1]) {
            const imagePath = match[1];
            let resolvedPath = imagePath;
            const currentFilePath = activeView.file?.path;

            if (!currentFilePath) {
                new Notice("Could not determine current file path.");
                return;
            }

            const lastSlashIndex = currentFilePath.lastIndexOf('/');
            const currentFileDir = lastSlashIndex === -1 ? '' : currentFilePath.substring(0, lastSlashIndex);

            if (!imagePath.includes('/')) {
                resolvedPath = currentFileDir === '' ? imagePath : `${currentFileDir}/${imagePath}`;
            }

            if (selection.match(WIKI_IMAGE_LINK_REGEX)) {
                resolvedPath = (await this.resolveWikilink(resolvedPath)) || resolvedPath;
            }

            const file = this.app.vault.getAbstractFileByPath(resolvedPath);

            if (file instanceof TFile) {
                try {
                    const originalFilePath = file.path;
                    const newFilePath = this.generateNewFilePath(originalFilePath);
                    const ext = this.getExtension(originalFilePath);

                    if (ext === ".png") {
                        if (action === "removeBackground") {
                            await this.removeBlackElements(file, newFilePath);
                        } else if (action === "invertColors") {
                            await this.invertImageColors(file, newFilePath);
                        }
                    } else {
                        await this.copyImageFile(file, newFilePath);
                        if (action === "removeBackground" || action === "invertColors") {
                            new Notice("Image filters can only be applied to PNG files. File copied without changes.");
                        }
                    }

                    if (replaceLink) {
                        const newLink = this.createNewLink(newFilePath, selection);
                        editor.replaceSelection(newLink);
                    }

                    new Notice(`Image successfully processed: ${newFilePath}`);
                } catch (error: unknown) {
                    new Notice("Error occurred while processing the image.");
                    console.error(error);
                }
            } else {
                new Notice("Selected file is not an image or could not be found.");
            }
        } else {
            new Notice("No image link selected.");
        }
    }

    /**
     * Inverts image colors, tweaks contrast and brightness for Dark Mode compatibility,
     * and writes the resulting buffer back to the Obsidian vault.
     */
    async invertImageColors(originalFile: TFile, newFilePath: string): Promise<void> {
        try {
            const arrayBuffer = await this.app.vault.readBinary(originalFile);

            // @ts-expect-error: Jimp historically expects a Node Buffer, but Uint8Array works natively in the browser.
            const image = await Jimp.read(arrayBufferToBuffer(arrayBuffer));

            image.invert();
            image.contrast(0.3);
            image.brightness(-0.05);

            const outputBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
            const finalArrayBuffer = outputBuffer.buffer.slice(
                outputBuffer.byteOffset,
                outputBuffer.byteOffset + outputBuffer.byteLength
            );

            // @ts-expect-error: TS types slice as returning ArrayBuffer | SharedArrayBuffer, but Obsidian Vault strictly requires ArrayBuffer.
            await this.app.vault.createBinary(newFilePath, finalArrayBuffer);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to invert image colors: ${message}`);
        }
    }

    /**
     * Scans the image pixels and removes solid black background colors based on a specific RGB distance tolerance.
     */
    async removeBlackElements(originalFile: TFile, newFilePath: string): Promise<void> {
        try {
            const arrayBuffer = await this.app.vault.readBinary(originalFile);

            // @ts-expect-error: Jimp historically expects a Node Buffer, but Uint8Array works natively in the browser.
            const image = await Jimp.read(arrayBufferToBuffer(arrayBuffer));

            const tolerance = 88.33;
            const { data } = image.bitmap;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i] ?? 0;
                const g = data[i + 1] ?? 0;
                const b = data[i + 2] ?? 0;

                const distance = Math.sqrt(r * r + g * g + b * b);

                if (distance <= tolerance) {
                    data[i + 3] = 0; // Set alpha channel to 0 (transparent)
                }
            }

            const outputBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
            const finalArrayBuffer = outputBuffer.buffer.slice(
                outputBuffer.byteOffset,
                outputBuffer.byteOffset + outputBuffer.byteLength
            );

            // @ts-expect-error: TS types slice as returning ArrayBuffer | SharedArrayBuffer, but Obsidian Vault strictly requires ArrayBuffer.
            await this.app.vault.createBinary(newFilePath, finalArrayBuffer);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to remove black background: ${message}`);
        }
    }

    /**
     * Resolves an Obsidian Wikilink into a strict absolute vault path.
     */
    async resolveWikilink(wikiLink: string): Promise<string | null> {
        const resolved = this.app.metadataCache.getFirstLinkpathDest(wikiLink, "");
        if (resolved instanceof TFile) {
            return resolved.path;
        }
        new Notice(`Could not resolve Wikilink: ${wikiLink}`);
        return null;
    }

    /**
     * Extracts the file extension (in lowercase) from a given file path.
     */
    getExtension(filePath: string): string {
        const lastDot = filePath.lastIndexOf('.');
        return lastDot === -1 ? '' : filePath.substring(lastDot).toLowerCase();
    }

    /**
     * Automatically generates a non-colliding file path by appending or incrementing a `_vX` suffix.
     */
    generateNewFilePath(originalFilePath: string): string {
        const lastSlash = originalFilePath.lastIndexOf('/');
        const dir = lastSlash === -1 ? '' : originalFilePath.substring(0, lastSlash);
        const fileName = lastSlash === -1 ? originalFilePath : originalFilePath.substring(lastSlash + 1);

        const lastDot = fileName.lastIndexOf('.');
        const baseName = lastDot === -1 ? fileName : fileName.substring(0, lastDot);
        const ext = lastDot === -1 ? '' : fileName.substring(lastDot);

        const versionedBaseName = baseName.replace(/_v(\d+)$/, (_match: string, p1: string): string => {
            return `_v${(parseInt(p1, 10) + 1).toString()}`;
        });

        let newBaseName = versionedBaseName;
        if (baseName === versionedBaseName) {
            newBaseName = `${baseName}_v1`;
        }

        let newFilePath = dir === '' ? `${newBaseName}${ext}` : `${dir}/${newBaseName}${ext}`;
        let version = 1;

        while (this.app.vault.getAbstractFileByPath(newFilePath) != null) {
            version++;
            newFilePath = dir === '' ? `${baseName}_v${version}${ext}` : `${dir}/${baseName}_v${version}${ext}`;
        }

        return newFilePath;
    }

    /**
     * Duplicates the specified file asynchronously using the native Vault API.
     */
    async copyImageFile(originalFile: TFile, newFilePath: string): Promise<void> {
        const buffer = await this.app.vault.readBinary(originalFile);
        await this.app.vault.createBinary(newFilePath, buffer);
    }

    /**
     * Constructs a new Markdown or Wikilink string using the newly generated file path.
     */
    createNewLink(newFilePath: string, selection: string): string {
        if (selection.match(IMAGE_REGEX)) {
            return selection.replace(IMAGE_REGEX, `![Image](${newFilePath})`);
        } else if (selection.match(WIKI_IMAGE_LINK_REGEX)) {
            return selection.replace(WIKI_IMAGE_LINK_REGEX, `![[${newFilePath}]]`);
        } else {
            return selection;
        }
    }
}
