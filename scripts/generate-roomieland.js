#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function usage() {
  console.log(`
Usage: node generate-roomieland.js <input-folder> [options]

Arguments:
  <input-folder>   Path to roomieland-design folder

Options:
  -o, --output     Output JSON file path (default: roomieland.json)
  -h, --help       Show this help message

Description:
  Scans first-level subfolders and recursively finds all .mmd files.
  Output is flattened by category (first-level folder name only).

Example:
  node scripts/generate-roomieland.js /path/to/roomieland-design
  node scripts/generate-roomieland.js /path/to/roomieland-design -o project.json
`);
}

function parseArgs(args) {
  const result = {
    inputFolder: null,
    outputFile: 'roomieland.json'
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
        nodes[id].text = text;
        nodes[id].type = type;
        // Track node in current subgraph if we're inside one
        if (currentSubgraph && !currentSubgraph.nodes.includes(id)) {
          currentSubgraph.nodes.push(id);
        }
      }
    }

    // Find edges in the line - multiple patterns to handle different syntax
    let edgeMatch = line.match(/([A-Za-z0-9_]+)(?:\s*\[[^\]]*\]|\s*\([^)]*\)|\s*\{[^}]*\})?\s*(-->|---|-\.->|==>)\s*\|([^|]*)\|\s*([A-Za-z0-9_]+)/);

    if (!edgeMatch) {
      edgeMatch = line.match(/([A-Za-z0-9_]+)(?:\s*\[[^\]]*\]|\s*\([^)]*\)|\s*\{[^}]*\})?\s*(-->|---|-\.->|==>)\s*([A-Za-z0-9_]+)(?:\s*\[|\s*\(|\s*\{|$)/);
      if (edgeMatch) {
        edgeMatch = [edgeMatch[0], edgeMatch[1], edgeMatch[2], '', edgeMatch[3]];
      }
    }

    if (edgeMatch) {
      const from = edgeMatch[1];
      const arrow = edgeMatch[2];
      const label = edgeMatch[3] || '';
      const to = edgeMatch[4];

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
    if (outgoing[edge.from]) outgoing[edge.from].push(edge.to);
    if (incoming[edge.to]) incoming[edge.to].push(edge.from);
  }

  // Simple layered layout using topological sort
  const layers = [];
  const assigned = new Set();

  let roots = nodeList.filter(n => incoming[n.id].length === 0).map(n => n.id);
  if (roots.length === 0 && nodeList.length > 0) {
    roots = [nodeList[0].id];
  }

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

    const nextLayer = new Set();
    for (const id of layer) {
      for (const target of (outgoing[id] || [])) {
        if (!assigned.has(target)) {
          nextLayer.add(target);
        }
      }
    }
    currentLayer = Array.from(nextLayer);
  }

  for (const node of nodeList) {
    if (!assigned.has(node.id)) {
      if (layers.length === 0) layers.push([]);
      layers[layers.length - 1].push(node.id);
    }
  }

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

/**
 * Recursively find all .mmd files in a directory
 */
function findMmdFiles(dir, files = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        findMmdFiles(fullPath, files);
      } else if (entry.isFile() && entry.name.endsWith('.mmd')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
  }

  return files;
}

function generateProject(inputFolder) {
  const project = {};

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
  console.log('Scanning for mermaid files...\n');

  // Get first-level subfolders only
  const entries = fs.readdirSync(absPath, { withFileTypes: true });
  let totalFiles = 0;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const categoryName = entry.name;
      const categoryPath = path.join(absPath, categoryName);

      // Find all .mmd files recursively in this category
      const mmdFiles = findMmdFiles(categoryPath);

      if (mmdFiles.length > 0) {
        console.log(`  ${categoryName}: ${mmdFiles.length} file(s)`);
        project[categoryName] = {};

        for (const mmdFilePath of mmdFiles) {
          const fileName = path.basename(mmdFilePath);
          const code = fs.readFileSync(mmdFilePath, 'utf-8');

          console.log(`    - ${fileName}`);

          try {
            const parsed = parseMermaidFlowchart(code);
            project[categoryName][fileName] = {
              code,
              ...parsed
            };
            totalFiles++;
          } catch (err) {
            console.error(`    Error parsing ${fileName}:`, err.message);
            project[categoryName][fileName] = { code, nodes: [], edges: [], direction: 'TD' };
            totalFiles++;
          }
        }
      }
    }
  }

  console.log(`\nTotal: ${Object.keys(project).length} categories, ${totalFiles} files`);

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

  const categoryCount = Object.keys(project).length;

  if (categoryCount === 0) {
    console.error('No mermaid files found.');
    process.exit(1);
  }

  const outputPath = path.resolve(outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(project, null, 2));

  console.log(`\nGenerated: ${outputPath}`);
}

main();
