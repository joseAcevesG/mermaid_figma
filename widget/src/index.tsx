import mermaid from 'mermaid';

const { widget } = figma;
const { AutoLayout, SVG, Text, useEffect, useMemo, useState, useSyncedState } = widget;

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'default',
});

let renderCounter = 0;

async function renderMermaid(code: string): Promise<string> {
  const id = `mermaid-${renderCounter++}`;
  const { svg } = await mermaid.render(id, code);
  return svg;
}

function MermaidWidget(): WidgetNode {
  const [code] = useSyncedState('code', 'graph TD; A-->B;');
  const [title] = useSyncedState('title', 'Mermaid Diagram');
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    renderMermaid(code)
      .then((svg) => {
        if (!cancelled) {
          setSvgMarkup(svg);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to render diagram');
          setSvgMarkup('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const content = useMemo(() => {
    if (error) {
      return <Text fill="#C01010">{error}</Text>;
    }
    if (!svgMarkup) {
      return <Text>Rendering Mermaid diagram…</Text>;
    }
    return <SVG src={svgMarkup} />;
  }, [error, svgMarkup]);

  return (
    <AutoLayout
      direction="vertical"
      padding={16}
      spacing={12}
      width={Math.min(900, svgMarkup ? 900 : 480)}
      fill="#FFFFFF"
      cornerRadius={16}
      stroke="#D9D9D9"
      strokeWidth={2}
    >
      <Text fontSize={18} fontWeight={600} fill="#111111">
        {title || 'Untitled Mermaid file'}
      </Text>
      {content}
      <Text fontSize={10} fill="#666">
        Mermaid diagrams render inside FigJam. Update the widget state by re-importing JSON.
      </Text>
    </AutoLayout>
  );
}

widget.register(MermaidWidget);
