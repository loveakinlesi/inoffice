export const $ = id => document.getElementById(id);
export const escapeHtml = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;
export function toast(message) {
  const el=$('toast'); el.textContent=message; el.classList.remove('opacity-0','translate-y-4');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.add('opacity-0','translate-y-4'),4000);
}
export const openModal = id => $(id).showModal();
export function closeModal(id) {
  $(id).close();
  if (id === 'settingsModal') $('settingsContent').replaceChildren();
}
export function bindModals() {
  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close]'); if(close) closeModal(close.dataset.close);
    if(e.target instanceof HTMLDialogElement) {
      const r=e.target.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) e.target.close();
    }
  });
}
