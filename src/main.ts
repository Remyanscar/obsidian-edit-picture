// noinspection JSUnusedGlobalSymbols,JSIgnoredPromiseFromCall
import {Plugin, TFile, MarkdownView, Notice} from "obsidian";

const IMAGE_REGEX = /(!?)\[(.*?)]\((.*?)\)/;
const WIKI_IMAGE_LINK_REGEX = /(!?)\[\[(.*?)]]/;
const SUPPORTED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "bmp"]);

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

    async handleImageProcessing(action: "removeBackground" | "invertColors", replaceLink = false): Promise<void> {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const editor = activeView.editor;
        const selection = editor.getSelection();

        if (!selection) {
            new Notice("No text selected. Please select an image link.");
            return;
        }

        const mdMatch = selection.match(IMAGE_REGEX);
        const wikiMatch = selection.match(WIKI_IMAGE_LINK_REGEX);

        if (!mdMatch && !wikiMatch) {
            new Notice("No valid image link found in the selection.");
            return;
        }

        let imagePath = "";
        let newLinkBuilder: (newPath: string, newFileName: string) => string;
        let originalMatchText = "";

        if (mdMatch) {
            originalMatchText = mdMatch[0];
            const excl = mdMatch[1] ?? "!";
            const altText = mdMatch[2] ?? "";
            const rawTarget = mdMatch[3] ?? "";
            const spaceIndex = rawTarget.indexOf(" ");
            const targetPath = spaceIndex !== -1 ? rawTarget.substring(0, spaceIndex) : rawTarget;
            const trailing = spaceIndex !== -1 ? rawTarget.substring(spaceIndex) : "";
            imagePath = targetPath.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

            try {
                imagePath = decodeURIComponent(imagePath);
            } catch {
                // Ignore decoding failure
            }
            newLinkBuilder = (newPath: string) => `${excl}[${altText}](${newPath.replace(/ /g, "%20")}${trailing})`;

        } else if (wikiMatch) {
            originalMatchText = wikiMatch[0];
            const excl = wikiMatch[1] ?? "!";
            const rawTarget = wikiMatch[2] ?? "";
            const pipeIndex = rawTarget.indexOf("|");
            const targetPath = pipeIndex !== -1 ? rawTarget.substring(0, pipeIndex) : rawTarget;
            const trailing = pipeIndex !== -1 ? rawTarget.substring(pipeIndex) : "";
            imagePath = targetPath.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

            newLinkBuilder = (newPath: string, newFileName: string) => {
                const target = imagePath.includes("/") ? newPath : newFileName;
                return `${excl}[[${target}${trailing}]]`;
            };
        } else {
            return;
        }

        const currentFilePath = activeView.file?.path || "";
        const file = this.app.metadataCache.getFirstLinkpathDest(imagePath, currentFilePath);

        if (file instanceof TFile) {
            const ext = file.extension.toLowerCase();

            if (!SUPPORTED_EXTENSIONS.has(ext)) {
                new Notice("Unsupported format. Please use PNG, JPG, JPEG, or BMP.");
                return;
            }

            try {
                const targetExt = action === "removeBackground" ? "png" : ext;
                const newFilePath = this.generateNewFilePath(file, targetExt);
                const newFileName = newFilePath.substring(newFilePath.lastIndexOf("/") + 1);

                const arrayBuffer = await this.app.vault.readBinary(file);
                const processedBuffer = await this.processImageNative(arrayBuffer, ext, action);
                await this.app.vault.createBinary(newFilePath, processedBuffer);

                if (replaceLink) {
                    const newLink = newLinkBuilder(newFilePath, newFileName);
                    const cursorFrom = editor.getCursor("from");
                    const cursorTo = editor.getCursor("to");
                    let replaced = false;

                    for (let l = cursorFrom.line; l <= cursorTo.line; l++) {
                        const lineContent = editor.getLine(l);
                        const idx = lineContent.indexOf(originalMatchText);

                        if (idx !== -1) {
                            editor.replaceRange(
                                newLink,
                                {line: l, ch: idx},
                                {line: l, ch: idx + originalMatchText.length}
                            );
                            replaced = true;
                            break;
                        }
                    }

                    if (!replaced) {
                        const updatedSelection = selection.replace(originalMatchText, newLink);
                        editor.replaceSelection(updatedSelection);
                    }
                }
                new Notice(`Image successfully processed: ${newFileName}`);

            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                new Notice(`Error processing image: ${message}`);
                console.error("EditPicture error:", error);
            }
        } else {
            new Notice(`File not found in vault: ${imagePath}`);
        }
    }

    getMimeType(ext: string): string {
        if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
        if (ext === "bmp") return "image/bmp";
        return "image/png";
    }

    async processImageNative(arrayBuffer: ArrayBuffer, originalExt: string, action: "invertColors" | "removeBackground"): Promise<ArrayBuffer> {
        const mimeType = this.getMimeType(originalExt);
        const blob = new Blob([arrayBuffer], {type: mimeType});
        const url = URL.createObjectURL(blob);

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = createEl("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");

                if (!ctx) {
                    reject(new Error("Could not create canvas context"));
                    return;
                }

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                if (action === "invertColors") {
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i] ?? 0;
                        const g = data[i + 1] ?? 0;
                        const b = data[i + 2] ?? 0;

                        data[i] = 255 - r;
                        data[i + 1] = 255 - g;
                        data[i + 2] = 255 - b;

                        for (let c = 0; c < 3; c++) {
                            let val = data[i + c] ?? 0;
                            val -= 12.75;
                            val = (val - 128) * 1.3 + 128;
                            data[i + c] = Math.max(0, Math.min(255, val));
                        }
                    }
                } else if (action === "removeBackground") {
                    const tolerance = 88.33;
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i] ?? 0;
                        const g = data[i + 1] ?? 0;
                        const b = data[i + 2] ?? 0;

                        const distance = Math.sqrt(r * r + g * g + b * b);
                        if (distance <= tolerance) {
                            data[i + 3] = 0;
                        }
                    }
                }

                ctx.putImageData(imageData, 0, 0);
                const targetMime = action === "removeBackground" ? "image/png" : mimeType;

                canvas.toBlob((outBlob) => {
                    if (!outBlob) {
                        reject(new Error("Failed to encode image"));
                        return;
                    }
                    outBlob.arrayBuffer().then(resolve).catch(reject);
                }, targetMime);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load image for processing"));
            };
            img.src = url;
        });
    }

    generateNewFilePath(originalFile: TFile, targetExt: string): string {
        const parent = originalFile.parent;
        const ext = `.${targetExt}`;
        let coreBaseName = originalFile.basename;
        const match = coreBaseName.match(/_ep-v(\d+)$/);

        if (match) {
            coreBaseName = coreBaseName.substring(0, coreBaseName.length - match[0].length);
        }

        let highestVersion = 0;
        const prefix = `${coreBaseName}_ep-v`;

        if (parent) {
            for (const child of parent.children) {
                if (child instanceof TFile && child.extension.toLowerCase() === targetExt) {
                    if (child.basename.startsWith(prefix)) {
                        const versionStr = child.basename.substring(prefix.length);
                        const versionNum = parseInt(versionStr, 10);
                        if (!isNaN(versionNum) && versionNum > highestVersion) {
                            highestVersion = versionNum;
                        }
                    }
                }
            }
        }

        let nextVersion = highestVersion + 1;
        const parentPath = parent && !parent.isRoot() ? `${parent.path}/` : "";
        let newFilePath = "";

        while (true) {
            newFilePath = `${parentPath}${coreBaseName}_ep-v${nextVersion}${ext}`;
            const fileExistsInVault = this.app.vault.getAbstractFileByPath(newFilePath) != null;
            const fileExistsInParent = parent?.children.some((c) => c.name === `${coreBaseName}_ep-v${nextVersion}${ext}`) ?? false;

            if (!fileExistsInVault && !fileExistsInParent) {
                break;
            }
            nextVersion++;
        }

        return newFilePath;
    }
}
