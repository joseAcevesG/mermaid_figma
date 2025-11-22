console.log('[DEBUG] ui.ts: Script starting');

import type { ImportMessage, MermaidProject } from '../../shared/types';

console.log('[DEBUG] ui.ts: Types imported');

// DOM elements
const jsonInput = document.getElementById('json-input') as HTMLTextAreaElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const importBtn = document.getElementById('import-btn') as HTMLButtonElement;
const statusNode = document.getElementById('status') as HTMLDivElement;

console.log('[DEBUG] ui.ts: DOM elements:', {
  jsonInput: !!jsonInput,
  fileInput: !!fileInput,
  importBtn: !!importBtn,
  statusNode: !!statusNode
});

type StatusKind = 'error' | 'success' | 'info';

function setStatus(message: string, kind: StatusKind = 'info'): void {
  console.log(`[DEBUG] Status: ${message} (${kind})`);
  if (statusNode) {
    statusNode.textContent = message;
    statusNode.className = kind;
  }
}

function assertIsMermaidProject(value: unknown): asserts value is MermaidProject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Root must be an object of folders.');
  }
  for (const [folderName, folderValue] of Object.entries(value)) {
    if (typeof folderValue !== 'object' || folderValue === null || Array.isArray(folderValue)) {
      throw new Error(`Folder "${folderName}" must map to an object of files.`);
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

// Simple SVG placeholder (no mermaid for now)
function createPlaceholderSvg(code: string): string {
  const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 100);
  return `<svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="100" fill="#f0f0f0" stroke="#ccc"/>
    <text x="10" y="30" font-family="monospace" font-size="12" fill="#333">Mermaid placeholder:</text>
    <text x="10" y="55" font-family="monospace" font-size="10" fill="#666">${escaped}</text>
  </svg>`;
}

async function processProject(project: MermaidProject): Promise<MermaidProject> {
  console.log('[DEBUG] Processing project...');
  const processedProject: MermaidProject = {};

  for (const [folderName, files] of Object.entries(project)) {
    console.log(`[DEBUG] Processing folder: ${folderName}`);
    processedProject[folderName] = {};
    for (const [fileName, content] of Object.entries(files)) {
      console.log(`[DEBUG] Processing file: ${fileName}`);
      const code = typeof content === 'string' ? content : content.code;
      const svg = createPlaceholderSvg(code);

      processedProject[folderName][fileName] = { code, svg };
    }
  }

  console.log('[DEBUG] Project processing complete');
  return processedProject;
}

async function importProject(): Promise<void> {
  console.log('[DEBUG] Import button clicked - starting import');

  try {
    let jsonText = jsonInput.value.trim();
    console.log(`[DEBUG] JSON input length: ${jsonText.length}`);

    if (fileInput.files && fileInput.files[0]) {
      console.log('[DEBUG] Reading from file input');
      jsonText = await readFileAsText(fileInput.files[0]);
      console.log(`[DEBUG] File content length: ${jsonText.length}`);
    }

    if (!jsonText) {
      setStatus('Provide JSON via textarea or upload a file.', 'error');
      return;
    }

    setStatus('Parsing project...', 'info');
    const rawProject = parseProject(jsonText);
    console.log('[DEBUG] Parsed project folders:', Object.keys(rawProject));

    const processedProject = await processProject(rawProject);

    const message: ImportMessage = {
      type: 'import-project',
      payload: processedProject,
    };

    console.log('[DEBUG] Posting message to plugin:', message.type);
    parent.postMessage({ pluginMessage: message }, '*');
    setStatus('Project sent to FigJam!', 'success');

  } catch (error) {
    console.error('[DEBUG] Import failed:', error);
    setStatus((error as Error).message ?? 'Failed to import JSON.', 'error');
  }
}

// Set up click handler
console.log('[DEBUG] Setting up click handler');
if (importBtn) {
  importBtn.addEventListener('click', () => {
    console.log('[DEBUG] Button click event fired');
    void importProject();
  });
  console.log('[DEBUG] Click handler attached');
} else {
  console.error('[DEBUG] Import button not found!');
}

// Initial status
setStatus('Ready. Paste JSON or upload a file, then click Import.', 'info');

console.log('[DEBUG] ui.ts: Script complete');
