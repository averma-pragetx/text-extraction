export function GlowDot({ color }) {
  return (
    <span 
      style={{ 
        width: 7, 
        height: 7, 
        borderRadius: 99, 
        background: color, 
        boxShadow: `0 0 10px ${color}`, 
        display: "inline-block", 
        animation: "pulseGlow 1.8s infinite" 
      }} 
    />
  );
}
