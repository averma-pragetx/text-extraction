import { useC } from "../../context/ThemeContext";

export function Chip({ color, children }) {
  return (
    <span 
      className="chip" 
      style={{ 
        color, 
        background: color + "1f", 
        border: `1px solid ${color}3a` 
      }}
    >
      {children}
    </span>
  );
}
