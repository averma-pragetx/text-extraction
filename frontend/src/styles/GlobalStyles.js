export function getGlobalStyles(c) {
  const glow = c.dark;
  return `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
::selection{background:${c.violet}40}
::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-thumb{background:${c.dark ? "rgba(255,255,255,0.12)" : "rgba(15,20,40,0.18)"};border-radius:4px}
::-webkit-scrollbar-track{background:transparent}
@keyframes flow{to{stroke-dashoffset:-1000}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes pulseGlow{0%,100%{opacity:.4}50%{opacity:1}}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
.rise{animation:rise .5s cubic-bezier(.2,.7,.3,1) both}
.mono{font-family:'Space Mono',monospace}
.disp{font-family:'Space Grotesk',sans-serif}
.gbtn{position:relative;border:none;cursor:pointer;font-family:'Space Grotesk',sans-serif;font-weight:600;
  border-radius:14px;padding:11px 20px;font-size:13.5px;color:#fff;letter-spacing:.2px;
  background:linear-gradient(135deg,${c.cyan},${c.violet});transition:transform .18s,box-shadow .25s;
  box-shadow:0 6px 24px -8px ${c.violet}${glow ? "aa" : "66"}}
.gbtn:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 12px 38px -10px ${c.cyan}${glow ? "cc" : "88"}}
.gbtn:active{transform:translateY(0) scale(.99)}
.gbtn:disabled{cursor:not-allowed;opacity:.58;transform:none;box-shadow:none}
.gbtn.ghost{background:${c.glass};color:${c.text};box-shadow:0 0 0 1px ${c.glassBorder} inset;backdrop-filter:blur(12px)}
.gbtn.ghost:hover{background:${c.glassHover};box-shadow:0 0 0 1px ${c.cyan}66 inset}
.glass{background:${c.glass};border:1px solid ${c.glassBorder};border-radius:20px;position:relative;overflow:hidden;
  ${c.dark ? "backdrop-filter:blur(16px);" : "box-shadow:0 8px 28px -18px rgba(15,20,40,0.25);"}}
${c.dark ? `.glass::before{content:'';position:absolute;inset:0;border-radius:20px;padding:1px;
  background:linear-gradient(135deg,rgba(255,255,255,.14),transparent 40%);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}` : ""}
.navItem{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:13px;cursor:pointer;
  color:${c.muted};font-size:13.5px;font-weight:500;transition:all .2s;position:relative;text-decoration:none}
.navItem:hover{color:${c.text};background:${c.dark ? "rgba(255,255,255,.04)" : "rgba(15,20,40,.04)"}}
.navItem.active{color:${c.text};background:linear-gradient(90deg,${c.violet}22,transparent)}
.navItem.active::before{content:'';position:absolute;left:0;top:18%;height:64%;width:3px;border-radius:3px;
  background:linear-gradient(${c.cyan},${c.violet});box-shadow:0 0 12px ${c.cyan}}
.statCard{transition:transform .25s,box-shadow .25s}
.statCard:hover{transform:translateY(-3px);box-shadow:0 16px 50px -22px ${c.violet}${glow ? "88" : "55"}}
.chip{font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.6px;
  padding:4px 9px;border-radius:8px;text-transform:uppercase}
.fchip{font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.4px;padding:6px 13px;
  border-radius:10px;cursor:pointer;text-transform:uppercase;transition:all .18s;border:1px solid ${c.glassBorder};
  color:${c.muted};background:transparent}
.fchip:hover{color:${c.text};border-color:${c.cyan}66}
.fchip.on{color:${c.dark ? "#06080F" : "#fff"};background:linear-gradient(135deg,${c.cyan},${c.violet});border-color:transparent}
.efield{font-family:'Space Grotesk',sans-serif;font-size:13.5px;font-weight:600;color:${c.text};background:${c.dark ? "rgba(255,255,255,0.04)" : "#F2F5FB"};
  border:1px solid ${c.glassBorder};border-radius:10px;padding:7px 11px;width:100%;outline:none}
.efield:focus{border-color:${c.cyan}}
`;
}
