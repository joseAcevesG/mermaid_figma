export interface MermaidProject {
  [folderName: string]: {
    [fileName: string]: string;
  };
}

export interface ImportMessage {
  type: 'import-project';
  payload: MermaidProject;
}
