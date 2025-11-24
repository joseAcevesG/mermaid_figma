import type { ImportMessage, MermaidProject, MermaidFile, MermaidNode, MermaidEdge } from '../../shared/types';

const UI_SIZE = { width: 420, height: 480 } as const;
const FOLDER_SECTION_WIDTH = 1400;
const FOLDER_SECTION_MIN_HEIGHT = 600;
const FILE_SECTION_MIN_HEIGHT = 500;
const SECTION_PADDING = 100;
const DIAGRAM_OFFSET_X = 50;
const DIAGRAM_OFFSET_Y = 80;

// Color palette for nodes
const NODE_COLORS: Record<string, RGB> = {
  rectangle: { r: 0.93, g: 0.93, b: 1 },    // Light purple
  stadium: { r: 0.9, g: 0.95, b: 0.9 },     // Light green
  diamond: { r: 1, g: 0.95, b: 0.85 },      // Light orange
  circle: { r: 0.85, g: 0.95, b: 1 },       // Light blue
  subroutine: { r: 0.95, g: 0.9, b: 0.95 }, // Light pink
  cylinder: { r: 0.9, g: 0.9, b: 0.9 },     // Light gray
  hexagon: { r: 1, g: 0.9, b: 0.9 },        // Light red
  asymmetric: { r: 0.95, g: 0.95, b: 0.85 } // Light yellow
};

figma.showUI(__html__, UI_SIZE);

figma.ui.onmessage = async (message: ImportMessage) => {
  console.log('Plugin received message:', message.type);
  if (message.type !== 'import-project') {
    return;
  }
  try {
    const result = await createProject(message.payload);
    if (result.deletedCount > 0) {
      figma.notify(`Updated ${result.deletedCount} existing section(s). Mermaid diagrams refreshed!`);
    } else {
      figma.notify('Mermaid diagrams created!');
    }
  } catch (error) {
    console.error('Error creating project:', error);
    figma.notify('Error creating project: ' + (error as Error).message, { error: true });
  }
};

// Map mermaid node type to FigJam shape type
function getShapeType(nodeType: MermaidNode['type']): 'ROUNDED_RECTANGLE' | 'DIAMOND' | 'ELLIPSE' {
  switch (nodeType) {
    case 'diamond':
      return 'DIAMOND';
    case 'circle':
      return 'ELLIPSE';
    case 'stadium':
    case 'rectangle':
    case 'subroutine':
    case 'cylinder':
    case 'hexagon':
    case 'asymmetric':
    default:
      return 'ROUNDED_RECTANGLE';
  }
}

async function createDiagram(
  section: SectionNode,
  file: MermaidFile,
  offsetX: number,
  offsetY: number
): Promise<{ width: number; height: number }> {
  const nodes = file.nodes || [];
  const edges = file.edges || [];
  const subgraphs = file.subgraphs || [];

  if (nodes.length === 0) {
    // No parsed data, show code as text
    const codeText = figma.createText();
    codeText.fontName = { family: 'Inter', style: 'Regular' };
    codeText.fontSize = 11;
    codeText.characters = file.code.substring(0, 500);
    codeText.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
    section.appendChild(codeText);
    codeText.x = offsetX;
    codeText.y = offsetY;
    return { width: 400, height: 200 };
  }

  // Create a map to store created shape nodes for connector binding
  const shapeMap = new Map<string, ShapeWithTextNode>();

  // Create a map to store subgraph frames
  const subgraphFrames = new Map<string, FrameNode>();

  // Create frames for subgraphs
  for (const subgraph of subgraphs) {
    const frame = figma.createFrame();
    frame.name = subgraph.title;

    // Set frame styling - light background with border
    frame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 1 }, opacity: 0.5 }];
    frame.strokes = [{ type: 'SOLID', color: { r: 0.7, g: 0.7, b: 0.8 } }];
    frame.strokeWeight = 2;
    frame.cornerRadius = 8;

    // Position and size the frame with validation
    const frameWidth = Math.max(subgraph.width || 200, 200);
    const frameHeight = Math.max(subgraph.height || 150, 150);
    frame.resize(frameWidth, frameHeight);
    section.appendChild(frame);
    frame.x = offsetX + (subgraph.x || 0);
    frame.y = offsetY + (subgraph.y || 0);

    // Add title text at the top of the frame
    const titleText = figma.createText();
    titleText.fontName = { family: 'Inter', style: 'Semi Bold' };
    titleText.fontSize = 14;
    titleText.characters = subgraph.title;
    titleText.fills = [{ type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.4 } }];
    frame.appendChild(titleText);
    titleText.x = 10;
    titleText.y = 10;

    subgraphFrames.set(subgraph.id, frame);
  }

  // Build a map of node ID to subgraph ID
  const nodeToSubgraph = new Map<string, string>();
  for (const subgraph of subgraphs) {
    for (const nodeId of subgraph.nodes) {
      nodeToSubgraph.set(nodeId, subgraph.id);
    }
  }

  // Calculate bounds for sizing
  let maxX = 0;
  let maxY = 0;

  // Create shapes for each node
  for (const node of nodes) {
    const shapeType = getShapeType(node.type);
    const shape = figma.createShapeWithText();

    // Set shape type
    shape.shapeType = shapeType;

    // Set text properties
    shape.text.characters = node.text;
    shape.text.fontSize = 14;

    // Set fill color based on node type
    const color = NODE_COLORS[node.type] || NODE_COLORS.rectangle;
    shape.fills = [{ type: 'SOLID', color }];

    // Set stroke
    shape.strokes = [{ type: 'SOLID', color: { r: 0.58, g: 0.44, b: 0.86 } }]; // Purple stroke
    shape.strokeWeight = 2;

    // Fixed width, but dynamic height based on text length
    const FIXED_WIDTH = 200;
    const MIN_HEIGHT = 60;
    const FONT_SIZE = 14;
    const LINE_HEIGHT = FONT_SIZE * 2; // 2x line height for better spacing
    const VERTICAL_PADDING = 30; // Top and bottom padding
    const HORIZONTAL_PADDING = 20; // Left and right padding
    const AVG_CHAR_WIDTH = 9; // Approximate character width at 14pt (slightly conservative)

    // Estimate number of lines needed based on text length and width
    // Account for word wrapping by being more conservative
    const availableWidth = FIXED_WIDTH - (HORIZONTAL_PADDING * 2);
    const charsPerLine = Math.floor(availableWidth / AVG_CHAR_WIDTH);
    const estimatedLines = Math.ceil(node.text.length / charsPerLine);

    // Calculate height with safety multiplier for word wrapping
    const textHeight = estimatedLines * LINE_HEIGHT;
    const estimatedHeight = Math.max(textHeight + VERTICAL_PADDING, MIN_HEIGHT);

    // Resize with calculated dimensions
    shape.resize(FIXED_WIDTH, estimatedHeight);

    // Determine parent container (subgraph frame or main section)
    const subgraphId = nodeToSubgraph.get(node.id);
    let parentContainer: SectionNode | FrameNode = section;
    let relativeX = offsetX + (node.x || 0);
    let relativeY = offsetY + (node.y || 0);

    if (subgraphId) {
      const subgraphFrame = subgraphFrames.get(subgraphId);
      if (subgraphFrame) {
        parentContainer = subgraphFrame;
        // Calculate position relative to subgraph frame
        const subgraph = subgraphs.find(sg => sg.id === subgraphId);
        if (subgraph) {
          relativeX = (node.x || 0) - (subgraph.x || 0);
          relativeY = (node.y || 0) - (subgraph.y || 0);
        }
      }
    }

    // Add to parent container and position
    parentContainer.appendChild(shape);
    shape.x = relativeX;
    shape.y = relativeY;

    // Track for connectors
    shapeMap.set(node.id, shape);

    // Update bounds using actual shape dimensions
    maxX = Math.max(maxX, (node.x || 0) + shape.width);
    maxY = Math.max(maxY, (node.y || 0) + shape.height);
  }

  // Create connectors for each edge
  for (const edge of edges) {
    const fromShape = shapeMap.get(edge.from);
    const toShape = shapeMap.get(edge.to);

    if (fromShape && toShape) {
      const connector = figma.createConnector();

      // Add connector to section (connectors work across container boundaries)
      section.appendChild(connector);

      // Connect the shapes - always connect from bottom to top for vertical flow
      connector.connectorStart = {
        endpointNodeId: fromShape.id,
        magnet: 'BOTTOM'
      };
      connector.connectorEnd = {
        endpointNodeId: toShape.id,
        magnet: 'TOP'
      };

      // Set arrow style
      connector.connectorEndStrokeCap = 'ARROW_LINES';

      // Set line style based on edge style
      if (edge.style === 'dotted') {
        connector.dashPattern = [4, 4];
      } else if (edge.style === 'thick') {
        connector.strokeWeight = 3;
      }

      // Set stroke color
      connector.strokes = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];

      // Add label if present
      if (edge.label) {
        connector.text.characters = edge.label;
        connector.text.fontSize = 12;
      }
    }
  }

  return { width: maxX + 100, height: maxY + 100 };
}

// Find and delete existing sections with matching names
function deleteExistingSections(folderNames: string[], fileNames: Map<string, string[]>): number {
  let deletedCount = 0;
  const allNodes = figma.currentPage.children;

  for (const node of allNodes) {
    if (node.type === 'SECTION') {
      // Check if this is a folder section we're about to recreate
      if (folderNames.includes(node.name)) {
        console.log(`Deleting existing folder section: ${node.name}`);
        node.remove();
        deletedCount++;
      } else {
        // Check if it's a file section inside any folder
        for (const [folderName, files] of fileNames.entries()) {
          if (files.includes(node.name)) {
            console.log(`Deleting existing file section: ${node.name}`);
            node.remove();
            deletedCount++;
            break;
          }
        }
      }
    }
  }

  return deletedCount;
}

async function createProject(project: MermaidProject): Promise<{ deletedCount: number }> {
  const folders = Object.entries(project);
  if (folders.length === 0) {
    figma.notify('No folders found in project JSON.');
    return { deletedCount: 0 };
  }

  // Collect folder and file names for cleanup
  const folderNames = folders.map(([name]) => name);
  const fileNames = new Map<string, string[]>();
  for (const [folderName, files] of folders) {
    fileNames.set(folderName, Object.keys(files));
  }

  // Delete existing sections with matching names
  const deletedCount = deleteExistingSections(folderNames, fileNames);
  if (deletedCount > 0) {
    console.log(`Deleted ${deletedCount} existing section(s)`);
  }

  // Load fonts once at the start
  await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

  const nodesToSelect: SceneNode[] = [];

  let folderX = 0;

  for (const [folderName, files] of folders) {
    const fileEntries = Object.entries(files);
    if (fileEntries.length === 0) {
      continue;
    }

    // Calculate folder height based on files
    let totalFilesHeight = SECTION_PADDING;

    // Create folder section
    const folderSection = figma.createSection();
    folderSection.name = folderName;
    folderSection.x = folderX;
    folderSection.y = 0;

    let fileY = SECTION_PADDING;
    let maxFileWidth = 0;

    for (const [fileName, content] of fileEntries) {
      // Normalize content to MermaidFile
      const file: MermaidFile = typeof content === 'string'
        ? { code: content }
        : content;

      // Create file section
      const fileSection = figma.createSection();
      fileSection.name = fileName;

      // Create title text
      const titleText = figma.createText();
      titleText.fontName = { family: 'Inter', style: 'Semi Bold' };
      titleText.fontSize = 16;
      titleText.characters = fileName || 'Untitled';
      titleText.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
      fileSection.appendChild(titleText);
      titleText.x = 20;
      titleText.y = 20;

      // Create the diagram
      const { width, height } = await createDiagram(
        fileSection,
        file,
        DIAGRAM_OFFSET_X,
        DIAGRAM_OFFSET_Y
      );

      // Resize file section based on content
      const fileSectionWidth = Math.max(width + DIAGRAM_OFFSET_X * 2, 400);
      const fileSectionHeight = Math.max(height + DIAGRAM_OFFSET_Y + 50, FILE_SECTION_MIN_HEIGHT);
      fileSection.resizeWithoutConstraints(fileSectionWidth, fileSectionHeight);

      // Add file section to folder section
      folderSection.appendChild(fileSection);
      fileSection.x = SECTION_PADDING;
      fileSection.y = fileY;

      fileY += fileSectionHeight + SECTION_PADDING;
      maxFileWidth = Math.max(maxFileWidth, fileSectionWidth);

      nodesToSelect.push(fileSection);
    }

    // Resize folder section
    const folderWidth = Math.max(maxFileWidth + SECTION_PADDING * 2, FOLDER_SECTION_WIDTH);
    const folderHeight = Math.max(fileY, FOLDER_SECTION_MIN_HEIGHT);
    folderSection.resizeWithoutConstraints(folderWidth, folderHeight);

    nodesToSelect.push(folderSection);

    // Move to next folder position
    folderX += folderWidth + SECTION_PADDING;
  }

  figma.currentPage.selection = nodesToSelect;
  figma.viewport.scrollAndZoomIntoView(nodesToSelect);

  return { deletedCount };
}
