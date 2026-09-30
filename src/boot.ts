// Temporary switch until the vanilla app is removed: `?react=0` opts back into it for the session.
const params = new URLSearchParams(location.search);
if (params.has('react')) sessionStorage.setItem('inoffice.react', params.get('react') === '0' ? '0' : '1');
if (sessionStorage.getItem('inoffice.react') === '0') {
  import('./main.js');
} else {
  document.getElementById('app')?.remove();
  document.getElementById('installPrompt')?.remove();
  import('./main.tsx');
}
