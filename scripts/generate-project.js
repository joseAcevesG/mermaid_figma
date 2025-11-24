#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function usage() {
  console.log(`
Usage: node generate-project.js <input-folder> [options]

Arguments:
  <input-folder>   Path to folder containing mermaid subfolders

Options:
  -o, --output     Output JSON file path (default: output.json)
  -h, --help       Show this help message

Example:
  node scripts/generate-project.js ./test_mermaid
  node scripts/generate-project.js ./test_mermaid -o my-project.json
`);
}

function parseArgs(args) {
  const result = {
    inputFolder: null,
    outputFile: 'output.json'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      usage();
      process.exit(0);
    } else if (arg === '-o' || arg === '--output') {
      result.outputFile = args[++i];
    } else if (!arg.startsWith('-')) {
      result.inputFolder = arg;
    }
  }

  return result;
}

/**
 * Simple mermaid flowchart parser
 * Extracts nodes and edges from mermaid flowchart syntax
 */
function parseMermaidFlowchart(code) {
  const nodes = {};
  const edges = [];
  const subgraphs = [];

  // Track current subgraph context
  let currentSubgraph = null;
  let subgraphCounter = 0;

  // Detect direction (default TD = top-down)
  let direction = 'TD';
  const dirMatch = code.match(/^\s*(graph|flowchart)\s+(TD|TB|LR|RL|BT)/mi);
  if (dirMatch) {
    direction = dirMatch[2];
  }

  // Node patterns:
  // A[text] = rectangle
  // A(text) = rounded rectangle / stadium
  // A{text} = diamond
  // A((text)) = circle
  // A>text] = asymmetric
  // A[[text]] = subroutine
  // A[(text)] = cylinder
  // A{{text}} = hexagon
  const nodePatterns = [
    { regex: /\[\[([^\]]*)\]\]/, type: 'subroutine' },
    { regex: /\[\(([^\)]*)\)\]/, type: 'cylinder' },
    { regex: /\{\{([^\}]*)\}\}/, type: 'hexagon' },
    { regex: /\(\(([^\)]*)\)\)/, type: 'circle' },
    { regex: /\[([^\]]*)\]/, type: 'rectangle' },
    { regex: /\(([^\)]*)\)/, type: 'stadium' },
    { regex: /\{([^\}]*)\}/, type: 'diamond' },
    { regex: />([^\]]*)\]/, type: 'asymmetric' },
  ];

  // Edge patterns:
  // A --> B
  // A --- B
  // A -.-> B (dotted)
  // A ==> B (thick)
  // A -->|text| B
  // A -- text --> B
  const edgeRegex = /([A-Za-z0-9_]+)\s*(-->|---|-\.->|==>|--[^>-]+-->|--[^>-]+---)\s*(?:\|([^|]*)\|)?\s*([A-Za-z0-9_]+)/g;

  // First pass: extract all node definitions
  const lines = code.split('\n');

  for (const line of lines) {
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed.startsWith('graph') || trimmed.startsWith('flowchart')) {
      continue;
    }

    // Check for subgraph start: subgraph "Title" or subgraph Title
    const subgraphStartMatch = trimmed.match(/^subgraph\s+(?:"([^"]+)"|(\S+))/);
    if (subgraphStartMatch) {
      const title = subgraphStartMatch[1] || subgraphStartMatch[2];
      currentSubgraph = {
        id: `subgraph_${subgraphCounter++}`,
        title: title,
        nodes: []
      };
      subgraphs.push(currentSubgraph);
      continue;
    }

    // Check for subgraph end
    if (trimmed === 'end' && currentSubgraph) {
      currentSubgraph = null;
      continue;
    }

    // Find node definitions in the line
    // Match pattern: ID followed by shape definition
    const nodeDefRegex = /([A-Za-z0-9_]+)\s*(\[\[|\[\(|\{\{|\(\(|\[|\(|\{|>)([^\]\)\}]*)(\]\]|\)\]|\}\}|\)\)|\]|\)|\})/g;
    let match;

    while ((match = nodeDefRegex.exec(line)) !== null) {
      const id = match[1];
      const openBracket = match[2];
      const text = match[3].trim();

      // Determine node type from bracket
      let type = 'rectangle';
      if (openBracket === '[[') type = 'subroutine';
      else if (openBracket === '[(') type = 'cylinder';
      else if (openBracket === '{{') type = 'hexagon';
      else if (openBracket === '((') type = 'circle';
      else if (openBracket === '[') type = 'rectangle';
      else if (openBracket === '(') type = 'stadium';
      else if (openBracket === '{') type = 'diamond';
      else if (openBracket === '>') type = 'asymmetric';

      if (!nodes[id]) {
        nodes[id] = { id, text: text || id, type };
        // Track node in current subgraph if we're inside one
        if (currentSubgraph && !currentSubgraph.nodes.includes(id)) {
          currentSubgraph.nodes.push(id);
        }
      } else if (text && text !== id) {
        // Update text if we found a more specific definition
        nodes[id].text = text;
        nodes[id].type = type;
        // Track node in current subgraph if we're inside one
        if (currentSubgraph && !currentSubgraph.nodes.includes(id)) {
          currentSubgraph.nodes.push(id);
        }
      }
    }

    // Find edges in the line - multiple patterns to handle different syntax
    // Pattern 1: A -->|label| B or A --> B
    // Pattern 2: A -- label --> B
    let edgeMatch = line.match(/([A-Za-z0-9_]+)(?:\s*\[[^\]]*\]|\s*\([^)]*\)|\s*\{[^}]*\})?\s*(-->|---|-\.->|==>)\s*\|([^|]*)\|\s*([A-Za-z0-9_]+)/);

    if (!edgeMatch) {
      // Try without label: A --> B
      edgeMatch = line.match(/([A-Za-z0-9_]+)(?:\s*\[[^\]]*\]|\s*\([^)]*\)|\s*\{[^}]*\})?\s*(-->|---|-\.->|==>)\s*([A-Za-z0-9_]+)(?:\s*\[|\s*\(|\s*\{|$)/);
      if (edgeMatch) {
        // Reformat to match expected groups: [full, from, arrow, label, to]
        edgeMatch = [edgeMatch[0], edgeMatch[1], edgeMatch[2], '', edgeMatch[3]];
      }
    }

    if (edgeMatch) {
      const from = edgeMatch[1];
      const arrow = edgeMatch[2];
      const label = edgeMatch[3] || '';
      const to = edgeMatch[4];

      // Ensure nodes exist
      if (!nodes[from]) {
        nodes[from] = { id: from, text: from, type: 'rectangle' };
        if (currentSubgraph && !currentSubgraph.nodes.includes(from)) {
          currentSubgraph.nodes.push(from);
        }
      }
      if (!nodes[to]) {
        nodes[to] = { id: to, text: to, type: 'rectangle' };
        if (currentSubgraph && !currentSubgraph.nodes.includes(to)) {
          currentSubgraph.nodes.push(to);
        }
      }

      // Determine edge style
      let style = 'solid';
      if (arrow.includes('-.')) style = 'dotted';
      else if (arrow.includes('==')) style = 'thick';

      edges.push({
        from,
        to,
        label: label.trim(),
        style
      });
    }
  }

  // Calculate layout positions
  const nodeList = Object.values(nodes);
  const nodeCount = nodeList.length;

  // Simple grid layout based on direction
  const nodeWidth = 150;
  const nodeHeight = 60;
  const horizontalGap = 80;
  const verticalGap = 100;

  // Build adjacency for layering
  const outgoing = {};
  const incoming = {};
  for (const node of nodeList) {
    outgoing[node.id] = [];
    incoming[node.id] = [];
  }
  for (const edge of edges) {
    outgoing[edge.from].push(edge.to);
    incoming[edge.to].push(edge.from);
  }

  // Simple layered layout using topological sort
  const layers = [];
  const assigned = new Set();

  // Find root nodes (no incoming edges)
  let roots = nodeList.filter(n => incoming[n.id].length === 0).map(n => n.id);
  if (roots.length === 0 && nodeList.length > 0) {
    roots = [nodeList[0].id]; // fallback to first node
  }

  // BFS to assign layers
  let currentLayer = roots;
  while (currentLayer.length > 0 && assigned.size < nodeCount) {
    const layer = [];
    for (const id of currentLayer) {
      if (!assigned.has(id)) {
        layer.push(id);
        assigned.add(id);
      }
    }
    if (layer.length > 0) {
      layers.push(layer);
    }

    // Next layer: all nodes that have an incoming edge from current layer
    const nextLayer = new Set();
    for (const id of layer) {
      for (const target of outgoing[id]) {
        if (!assigned.has(target)) {
          nextLayer.add(target);
        }
      }
    }
    currentLayer = Array.from(nextLayer);
  }

  // Add any remaining unassigned nodes
  for (const node of nodeList) {
    if (!assigned.has(node.id)) {
      if (layers.length === 0) layers.push([]);
      layers[layers.length - 1].push(node.id);
    }
  }

  // Assign positions based on layers
  const isHorizontal = direction === 'LR' || direction === 'RL';
  const isReversed = direction === 'RL' || direction === 'BT';

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const layer = layers[layerIndex];
    const effectiveLayerIndex = isReversed ? (layers.length - 1 - layerIndex) : layerIndex;

    for (let nodeIndex = 0; nodeIndex < layer.length; nodeIndex++) {
      const nodeId = layer[nodeIndex];
      const node = nodes[nodeId];

      if (isHorizontal) {
        node.x = effectiveLayerIndex * (nodeWidth + horizontalGap);
        node.y = nodeIndex * (nodeHeight + verticalGap);
      } else {
        node.x = nodeIndex * (nodeWidth + horizontalGap);
        node.y = effectiveLayerIndex * (nodeHeight + verticalGap);
      }

      node.width = nodeWidth;
      node.height = nodeHeight;
    }
  }

  // Calculate bounding boxes for subgraphs
  const padding = 30; // Padding around subgraph nodes
  for (const subgraph of subgraphs) {
    if (subgraph.nodes.length === 0) continue;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const nodeId of subgraph.nodes) {
      const node = nodes[nodeId];
      if (node) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
      }
    }

    subgraph.x = minX - padding;
    subgraph.y = minY - padding;
    subgraph.width = maxX - minX + padding * 2;
    subgraph.height = maxY - minY + padding * 2;
  }

  return {
    direction,
    nodes: Object.values(nodes),
    edges,
    subgraphs
  };
}

function getMermaidFiles(folderPath) {
  const files = {};

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.mmd')) {
        const filePath = path.join(folderPath, entry.name);
        const code = fs.readFileSync(filePath, 'utf-8');

        console.log(`    Parsing: ${entry.name}`);
        const parsed = parseMermaidFlowchart(code);

        files[entry.name] = {
          code,
          ...parsed
        };
      }
    }
  } catch (err) {
    console.error(`Error reading folder ${folderPath}:`, err.message);
  }

  return files;
}

function generateProject(inputFolder) {
  const project = {};

  // Resolve to absolute path
  const absPath = path.resolve(inputFolder);

  if (!fs.existsSync(absPath)) {
    console.error(`Error: Folder not found: ${absPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(absPath);
  if (!stats.isDirectory()) {
    console.error(`Error: Not a directory: ${absPath}`);
    process.exit(1);
  }

  console.log(`Reading from: ${absPath}`);
  console.log('Parsing mermaid flowcharts...\n');

  // Get all subfolders
  const entries = fs.readdirSync(absPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const folderName = entry.name;
      const folderPath = path.join(absPath, folderName);

      console.log(`  Folder: ${folderName}`);
      const files = getMermaidFiles(folderPath);

      if (Object.keys(files).length > 0) {
        project[folderName] = files;
      }
    }
  }

  // Also check for .mmd files in the root folder
  const rootFiles = getMermaidFiles(absPath);
  if (Object.keys(rootFiles).length > 0) {
    project['Root'] = rootFiles;
  }

  return project;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    usage();
    process.exit(1);
  }

  const { inputFolder, outputFile } = parseArgs(args);

  if (!inputFolder) {
    console.error('Error: No input folder specified');
    usage();
    process.exit(1);
  }

  const project = generateProject(inputFolder);

  const folderCount = Object.keys(project).length;
  const fileCount = Object.values(project).reduce((sum, files) => sum + Object.keys(files).length, 0);

  if (folderCount === 0) {
    console.error('No mermaid files found in any subfolders.');
    process.exit(1);
  }

  // Write output
  const outputPath = path.resolve(outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(project, null, 2));

  console.log(`\nGenerated: ${outputPath}`);
  console.log(`  Folders: ${folderCount}`);
  console.log(`  Files: ${fileCount}`);
}

main();
