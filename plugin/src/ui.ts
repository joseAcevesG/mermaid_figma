import type { ImportMessage, MermaidProject } from '../../shared/types';

type StatusKind = 'error' | 'success' | 'info';

const jsonInput = document.getElementById('json-input') as HTMLTextAreaElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const importBtn = document.getElementById('import-btn') as HTMLButtonElement;
const statusNode = document.getElementById('status') as HTMLDivElement;

function setStatus(message: string, kind: StatusKind = 'info'): void {
  statusNode.textContent = message;
  statusNode.className = kind;
}

function assertIsMermaidProject(value: unknown): asserts value is MermaidProject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Root must be an object of folders.');
  }
  for (const [folderName, folderValue] of Object.entries(value)) {
    if (typeof folderValue !== 'object' || folderValue === null || Array.isArray(folderValue)) {
      throw new Error(`Folder "${folderName}" must map to an object of files.`);
    }
    for (const [fileName, code] of Object.entries(folderValue)) {
      if (typeof code !== 'string') {
        throw new Error(`File "${fileName}" inside folder "${folderName}" must be a string containing Mermaid code.`);
      }
      if (!code.trim()) {
        throw new Error(`File "${fileName}" contains empty Mermaid code.`);
      }
    }
  }
}

function parseProject(jsonText: string): MermaidProject {
  const data = JSON.parse(jsonText) as unknown;
  assertIsMermaidProject(data);
  return data;
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file.'));
    reader.readAsText(file);
  });
}

async function importProject(): Promise<void> {
  try {
    let jsonText = jsonInput.value.trim();
    if (fileInput.files && fileInput.files[0]) {
      jsonText = await readFileAsText(fileInput.files[0]);
    }
    if (!jsonText) {
      setStatus('Provide JSON via textarea or upload a file.', 'error');
      return;
    }
    const project = parseProject(jsonText);
    const message: ImportMessage = {
      type: 'import-project',
      payload: project,
    };
    parent.postMessage({ pluginMessage: message }, '*');
    setStatus('JSON sent to plugin. Switch to the canvas to see the generated sections.', 'success');
  } catch (error) {
    console.error(error);
    setStatus((error as Error).message ?? 'Failed to import JSON.', 'error');
  }
}

importBtn.addEventListener('click', () => {
  void importProject();
});

setStatus('Paste MermaidProject JSON or upload a file, then click Import.', 'info');
