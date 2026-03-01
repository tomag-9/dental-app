export default function FormGrid({ children }) {
  // Using inline styles for responsive grid layout
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
