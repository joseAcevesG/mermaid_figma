import type { ImportMessage, MermaidProject } from '../../shared/types';

const UI_SIZE = { width: 420, height: 420 } as const;
const FOLDER_SECTION_WIDTH = 1200;
const FOLDER_SECTION_MIN_HEIGHT = 400;
const FILE_SECTION_HEIGHT = 320;
const SECTION_PADDING = 80;
const FILE_SECTION_WIDTH = FOLDER_SECTION_WIDTH - SECTION_PADDING * 2;
const WIDGET_OFFSET_X = 24;
const WIDGET_OFFSET_Y = 80;

figma.showUI(__html__, UI_SIZE);

figma.ui.onmessage = async (message: ImportMessage) => {
  if (message.type !== 'import-project') {
    return;
  }
  await createProject(message.payload);
  figma.notify('Mermaid sections created.');
};

async function createProject(project: MermaidProject): Promise<void> {
  const folders = Object.entries(project);
  if (folders.length === 0) {
    figma.notify('No folders found in project JSON.');
    return;
  }

  const nodesToSelect: SceneNode[] = [];
  const startY = 0;

  for (const [folderIndex, [folderName, files]] of folders.entries()) {
    const fileEntries = Object.entries(files);
    if (fileEntries.length === 0) {
      continue;
    }

    const folderX = folderIndex * (FOLDER_SECTION_WIDTH + SECTION_PADDING);
    const folderY = startY;
    const folderHeight = Math.max(
      FOLDER_SECTION_MIN_HEIGHT,
      fileEntries.length * (FILE_SECTION_HEIGHT + SECTION_PADDING) + SECTION_PADDING
    );

    const folderSection = figma.createSection();
    folderSection.name = folderName;
    folderSection.resizeWithoutConstraints(FOLDER_SECTION_WIDTH, folderHeight);
    folderSection.x = folderX;
    folderSection.y = folderY;
    nodesToSelect.push(folderSection);

    let currentFileY = folderY + SECTION_PADDING;

    for (const [fileName, mermaidCode] of fileEntries) {
      const fileSection = figma.createSection();
      fileSection.name = fileName;
      fileSection.resizeWithoutConstraints(FILE_SECTION_WIDTH, FILE_SECTION_HEIGHT);
      fileSection.x = folderX + SECTION_PADDING;
      fileSection.y = currentFileY;

      const widget = figma.createWidget('mermaid-widget');
      widget.widgetSyncedState = {
        code: mermaidCode,
        title: fileName,
      };
      widget.x = fileSection.x + WIDGET_OFFSET_X;
      widget.y = fileSection.y + WIDGET_OFFSET_Y;
      fileSection.appendChild(widget);

      nodesToSelect.push(fileSection, widget);
      currentFileY += FILE_SECTION_HEIGHT + SECTION_PADDING;
    }
  }

  figma.currentPage.selection = nodesToSelect;
  figma.viewport.scrollAndZoomIntoView(nodesToSelect);
}
