export interface MermaidNode {
  id: string;
  text: string;
  type: 'rectangle' | 'stadium' | 'diamond' | 'circle' | 'subroutine' | 'cylinder' | 'hexagon' | 'asymmetric';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MermaidEdge {
  from: string;
  to: string;
  label: string;
  style: 'solid' | 'dotted' | 'thick';
}

export interface MermaidSubgraph {
  id: string;
  title: string;
  nodes: string[]; // Node IDs that belong to this subgraph
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MermaidFile {
  code: string;
  direction?: 'TD' | 'TB' | 'LR' | 'RL' | 'BT';
  nodes?: MermaidNode[];
  edges?: MermaidEdge[];
  subgraphs?: MermaidSubgraph[];
  // Legacy SVG support
  svg?: string;
}

export interface MermaidProject {
  [folderName: string]: {
    [fileName: string]: string | MermaidFile;
  };
}

export interface ImportMessage {
  type: 'import-project';
  payload: MermaidProject;
}
