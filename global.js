console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

let pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'contact/', title: 'Contact' },
    { url: 'cv/', title: 'CV' },
    { url: 'https://github.com/TChima1', title: 'GitHub' }
  ];
  
  const ARE_WE_HOME = document.documentElement.classList.contains('home');
  
  let nav = document.createElement('nav');
  document.body.prepend(nav);
  
  for (let p of pages) {
    let url = p.url;
    
    if (!ARE_WE_HOME && !url.startsWith('http')) {
      url = '../' + url;
    }
  
    let a = document.createElement('a');
    a.href = url;
    a.textContent = p.title;
    
    a.classList.toggle(
      'current',
      a.host === location.host && a.pathname === location.pathname
    );
    
    a.toggleAttribute(
      'target',
      a.host !== location.host
    );
    if (a.hasAttribute('target')) {
      a.target = '_blank';
    }
  
    nav.append(a);
  }
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<label class="color-scheme">
      Theme:
      <select>
        <option value="light dark">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>`
  );
  
  const select = document.querySelector('.color-scheme select');
  
  function setColorScheme(colorScheme) {
    document.documentElement.style.setProperty('color-scheme', colorScheme);
    select.value = colorScheme;
  }
  
  if ("colorScheme" in localStorage) {
    setColorScheme(localStorage.colorScheme);
  }
  
  select.addEventListener('input', function(event) {
    const newScheme = event.target.value;
    setColorScheme(newScheme);
    localStorage.colorScheme = newScheme;
  });