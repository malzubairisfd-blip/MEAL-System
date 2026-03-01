export function buildDependencyGraph(files: any[]) {
  const nodes = files.map((f, i) => ({
    id: String(i),
    label: f.file,
  }));

  const edges: any[] = [];

  files.forEach((f, i) => {
    f.imports.forEach((imp: string) => {
      const targetIndex = files.findIndex(x => x.file.includes(imp));
      if (targetIndex >= 0) {
        edges.push({
          source: String(i),
          target: String(targetIndex),
        });
      }
    });
  });

  return { nodes, edges };
}
