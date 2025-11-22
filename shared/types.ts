export interface MermaidFile {
  code: string;
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
