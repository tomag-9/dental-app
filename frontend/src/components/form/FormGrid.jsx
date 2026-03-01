export default function FormGrid({ 
  children, 
  columns = { default: 1, md: 2, lg: 3 } 
}) {
  let gridClass = `grid gap-4`;
  
  if (columns.md) gridClass += ` md:grid-cols-${columns.md}`;
  if (columns.lg) gridClass += ` lg:grid-cols-${columns.lg}`;
  if (columns.default) gridClass += ` grid-cols-${columns.default}`;

  // Fallback to inline style for dynamic column values
  const style = {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(250px, 1fr))`,
    gap: '1rem'
  };

  return (
    <div style={style}>
      {children}
    </div>
  );
}
