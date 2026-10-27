// WC Digital Agency Platform — design tokens from the redesign canvas.
// Merge into tailwind.config.js:  theme: { extend: require('./design/tokens/tailwind.tokens.js') }
module.exports = {
  colors: {
    stone: '#EFEDE7',      // page background
    surface: '#FFFFFF',    // cards, panels, inputs on stone
    'surface-2': '#F7F6F2',// inner panels, schedule boxes, rows on white
    ink: '#121212',        // text, sidebar, dark cards, primary buttons
    'ink-2': '#4D4A44',    // secondary text
    muted: '#6A665F',      // labels, meta text
    line: '#ECEAE4',       // row dividers
    accent: '#FFD43B',     // brand yellow: active nav, badges, Submit
    'dark-1': '#1E1D1B',   // panels inside dark cards
    'dark-2': '#2A2926',   // chips inside dark cards
    status: {
      'missed-fg': '#C0362C', 'missed-bg': '#FBE7E4',
      'pending-fg': '#8A5A00', 'pending-bg': '#FCF0CC',
      'done-fg': '#1F7A4A',   'done-bg': '#E2F2E7',
      'review-fg': '#1E4797', 'review-bg': '#DCE6F7',
      'todo-fg': '#4D4A44',   'todo-bg': '#ECEAE4',
      'brief-bg': '#FFF6CC',
    },
  },
  fontFamily: {
    display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
    sans: ['Geist', 'system-ui', 'sans-serif'],
    mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
  },
  borderRadius: { card: '24px', 'card-lg': '30px', pill: '999px' },
  height: { 'ctl-sm': '38px', ctl: '44px', 'ctl-lg': '48px', 'ctl-xl': '52px' },
  width: { sidebar: '248px' },
  maxWidth: { content: '1280px' },
};
