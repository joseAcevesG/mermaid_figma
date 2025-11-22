import type { ImportMessage, MermaidProject } from '../../shared/types';

const UI_SIZE = { width: 420, height: 480 } as const;
const FOLDER_SECTION_WIDTH = 1200;
const FOLDER_SECTION_MIN_HEIGHT = 400;
const FILE_SECTION_HEIGHT = 400;
const SECTION_PADDING = 80;
const FILE_SECTION_WIDTH = FOLDER_SECTION_WIDTH - SECTION_PADDING * 2;
const CONTENT_OFFSET_X = 24;
const CONTENT_OFFSET_Y = 60;

figma.showUI(__html__, UI_SIZE);

figma.ui.onmessage = async (message: ImportMessage) => {
  console.log('Plugin received message:', message.type);
  if (message.type !== 'import-project') {
    return;
  }
  try {
    await createProject(message.payload);
    figma.notify('Mermaid sections created.');
  } catch (error) {
    console.error('Error creating project:', error);
    figma.notify('Error creating project: ' + (error as Error).message, { error: true });
  }
};

async function createProject(project: MermaidProject): Promise<void> {
  const folders = Object.entries(project);
  if (folders.length === 0) {
    figma.notify('No folders found in project JSON.');
    return;
  }

  // Load fonts once at the start
  await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  const nodesToSelect: SceneNode[] = [];

  for (const [folderIndex, [folderName, files]] of folders.entries()) {
    const fileEntries = Object.entries(files);
    if (fileEntries.length === 0) {
      continue;
    }

    const folderX = folderIndex * (FOLDER_SECTION_WIDTH + SECTION_PADDING);
    const folderY = 0;
    const folderHeight = Math.max(
      FOLDER_SECTION_MIN_HEIGHT,
      fileEntries.length * (FILE_SECTION_HEIGHT + SECTION_PADDING) + SECTION_PADDING
    );

    // Create folder section
    const folderSection = figma.createSection();
    folderSection.name = folderName;
    folderSection.x = folderX;
    folderSection.y = folderY;
    folderSection.resizeWithoutConstraints(FOLDER_SECTION_WIDTH, folderHeight);
    nodesToSelect.push(folderSection);

    for (const [fileIndex, [fileName, content]] of fileEntries.entries()) {
      const code = typeof content === 'string' ? content : content.code;
      const svg = typeof content === 'string' ? undefined : content.svg;

      // File section position (relative to page, will be moved into folder)
      const fileSectionX = SECTION_PADDING;
      const fileSectionY = SECTION_PADDING + fileIndex * (FILE_SECTION_HEIGHT + SECTION_PADDING);

      // Create file section
      const fileSection = figma.createSection();
      fileSection.name = fileName;
      fileSection.resizeWithoutConstraints(FILE_SECTION_WIDTH, FILE_SECTION_HEIGHT);

      // Create content frame
      const contentFrame = figma.createFrame();
      contentFrame.name = fileName + ' - Content';
      contentFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      contentFrame.cornerRadius = 16;
      contentFrame.strokeWeight = 2;
      contentFrame.strokes = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }];

      // Create title text
      const titleText = figma.createText();
      titleText.fontName = { family: 'Inter', style: 'Semi Bold' };
      titleText.fontSize = 18;
      titleText.characters = fileName || 'Untitled Mermaid file';
      titleText.fills = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
      titleText.x = 16;
      titleText.y = 16;
      contentFrame.appendChild(titleText);

      let contentHeight = 100;

      if (svg) {
        try {
          // Create SVG node from the rendered mermaid
          const svgNode = figma.createNodeFromSvg(svg);
          svgNode.x = 16;
          svgNode.y = 50;
          contentFrame.appendChild(svgNode);

          // Get actual size
          const bounds = svgNode.absoluteBoundingBox;
          if (bounds) {
            contentHeight = bounds.height + 70;
          }
        } catch (e) {
          console.error('Failed to create SVG node:', e);
          // Fallback to error text
          const errorText = figma.createText();
          errorText.fontName = { family: 'Inter', style: 'Regular' };
          errorText.fontSize = 12;
          errorText.characters = 'Error rendering SVG: ' + (e as Error).message;
          errorText.fills = [{ type: 'SOLID', color: { r: 0.8, g: 0, b: 0 } }];
          errorText.x = 16;
          errorText.y = 50;
          contentFrame.appendChild(errorText);
        }
      } else {
        // No SVG, show code as text
        const codeText = figma.createText();
        codeText.fontName = { family: 'Inter', style: 'Regular' };
        codeText.fontSize = 11;
        codeText.characters = code.substring(0, 500);
        codeText.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
        codeText.x = 16;
        codeText.y = 50;
        contentFrame.appendChild(codeText);
      }

      // Size the frame
      contentFrame.resizeWithoutConstraints(
        Math.min(FILE_SECTION_WIDTH - CONTENT_OFFSET_X * 2, 800),
        Math.max(150, contentHeight)
      );

      // Position content frame relative to file section (will be set after appendChild)
      // First add to file section, then position
      fileSection.appendChild(contentFrame);
      contentFrame.x = CONTENT_OFFSET_X;
      contentFrame.y = CONTENT_OFFSET_Y;

      // Add file section to folder section
      folderSection.appendChild(fileSection);
      fileSection.x = fileSectionX;
      fileSection.y = fileSectionY;

      nodesToSelect.push(fileSection);
    }
  }

  figma.currentPage.selection = nodesToSelect;
  figma.viewport.scrollAndZoomIntoView(nodesToSelect);
}
