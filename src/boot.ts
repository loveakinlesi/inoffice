// Temporary switch while the React port reaches parity: `?react=1` opts in (and sticks for the session).
const params = new URLSearchParams(location.search);
if (params.has('react')) sessionStorage.setItem('inoffice.react', params.get('react') === '0' ? '0' : '1');
if (sessionStorage.getItem('inoffice.react') === '1') {
  document.getElementById('app')?.remove();
  document.getElementById('installPrompt')?.remove();
  import('./main.tsx');
} else {
  import('./main.js');
}
