export const LoginPage = {
  usernameInput: 'label:has-text("Username") >> input',
  passwordInput: 'label:has-text("Password") >> input',
  submitButton: 'button:has-text("Login")',
  loadingButton: 'button:has-text("Logging in...")',
  errorBox: '.text-red-600',
  heading: 'text=Helm Admin',
  form: '[data-testid="login-form"]',
};
