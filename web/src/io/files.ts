import { parseLogicTree, type LogicTreeFile } from "../schema/logicTree";

/**
 * Local-first file I/O. Uses the File System Access API where available so the
 * user edits a real .json file in place; falls back to upload/download for
 * browsers without it. Nothing is ever sent to a server.
 */

interface FileSystemWritableFileStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface FileSystemFileHandleLike {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
  name: string;
}

type WindowWithFs = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandleLike[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandleLike>;
};

const JSON_PICKER = {
  types: [{ description: "Logic tree", accept: { "application/json": [".json"] } }],
};

export interface LoadedTree {
  tree: LogicTreeFile;
  handle: FileSystemFileHandleLike | null;
  name: string;
}

export function serialize(tree: LogicTreeFile): string {
  return JSON.stringify(tree, null, 2) + "\n";
}

export async function openTree(): Promise<LoadedTree | null> {
  const w = window as WindowWithFs;
  if (w.showOpenFilePicker) {
    const [handle] = await w.showOpenFilePicker(JSON_PICKER);
    if (!handle) return null;
    const file = await handle.getFile();
    return { tree: parseLogicTree(JSON.parse(await file.text())), handle, name: handle.name };
  }
  // Fallback: hidden <input type=file>
  return openViaInput();
}

function openViaInput(): Promise<LoadedTree | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const tree = parseLogicTree(JSON.parse(await file.text()));
        resolve({ tree, handle: null, name: file.name });
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}

/** Save back to an existing handle (true in-place edit), or prompt for one. */
export async function saveTree(
  tree: LogicTreeFile,
  handle: FileSystemFileHandleLike | null,
  suggestedName = "tree.json",
): Promise<FileSystemFileHandleLike | null> {
  const w = window as WindowWithFs;
  const text = serialize(tree);

  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return handle;
  }
  if (w.showSaveFilePicker) {
    const newHandle = await w.showSaveFilePicker({ suggestedName, ...JSON_PICKER });
    const writable = await newHandle.createWritable();
    await writable.write(text);
    await writable.close();
    return newHandle;
  }
  downloadText(text, suggestedName);
  return null;
}

function downloadText(text: string, name: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
