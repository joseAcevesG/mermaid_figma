const { widget } = figma;
const { AutoLayout, SVG, Text: WidgetText, useSyncedState } = widget;

export function MermaidWidget() {
  const [code] = useSyncedState('code', 'graph TD; A-->B;');
  const [title] = useSyncedState('title', 'Mermaid Diagram');
  const [svgMarkup] = useSyncedState('svg', '');

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
      <WidgetText fontSize={18} fontWeight={600} fill="#111111">
        {title || 'Untitled Mermaid file'}
      </WidgetText>
      
      {svgMarkup ? (
        <SVG src={svgMarkup} />
      ) : (
        <WidgetText fill="#666">
          No SVG content available. Please re-import the project.
        </WidgetText>
      )}

      <WidgetText fontSize={10} fill="#666">
        Mermaid diagrams are rendered by the plugin and displayed here.
      </WidgetText>
    </AutoLayout>
  );
}
