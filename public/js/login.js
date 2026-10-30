const form = document.getElementById('loginForm');
const password = document.getElementById('password');
const errorElement = document.getElementById('loginError');
const button = document.getElementById('loginButton');
document.getElementById('showPassword').addEventListener('change', event => { password.type = event.target.checked ? 'text' : 'password'; });
form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  button.textContent = 'Входим…';
  errorElement.textContent = '';
  try {
    await Api.post('/api/auth/login', {login:document.getElementById('login').value.trim(),password:password.value});
    localStorage.removeItem('currentStaffId');
    location.replace('index.html');
  } catch (error) {
    errorElement.textContent = error.message;
    password.value = '';
    password.focus();
  } finally { button.disabled = false; button.textContent = 'Войти'; }
});
