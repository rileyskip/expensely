// DOM Elements
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const loginButton = document.getElementById("login-button");
const registerButton = document.getElementById("register-button");
const submitLoginButton = document.getElementById("submit-login");
const submitRegisterButton = document.getElementById("submit-register");
const logoutButton = document.getElementById("logout-button");
const welcomeMessage = document.getElementById("welcome-message");
const notification = document.getElementById("notification");

// Show notification
function showNotification(message, type = "success") {
  notification.textContent = message;
  notification.className = `fixed top-4 right-4 p-4 rounded-lg text-white ${
    type === "success" ? "bg-green-500" : "bg-red-500"
  }`;
  notification.classList.remove("hidden");
  setTimeout(() => {
    notification.classList.add("hidden");
  }, 3000);
}

// Check login state
function checkLoginState() {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const username = localStorage.getItem("username");

  if (isLoggedIn && username) {
    loginForm.classList.add("hidden");
    registerForm.classList.add("hidden");
    document.getElementById("main-content").classList.remove("hidden");
    welcomeMessage.textContent = `Welcome, ${username}!`;
    welcomeMessage.classList.remove("hidden");
  } else {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    document.getElementById("main-content").classList.add("hidden");
    welcomeMessage.classList.add("hidden");
  }
}

// Event Listeners
loginButton.addEventListener("click", () => {
  registerForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
});

registerButton.addEventListener("click", () => {
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
});

submitLoginButton.addEventListener("click", () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (!username || !password) {
    showNotification("Please fill in all fields", "error");
    return;
  }

  const storedPassword = localStorage.getItem(`password_${username}`);

  if (storedPassword === password) {
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("username", username);
    showNotification("Login successful!");
    checkLoginState();
    loginForm.reset();
  } else {
    showNotification("Invalid username or password", "error");
  }
});

submitRegisterButton.addEventListener("click", () => {
  const username = document.getElementById("new-username").value;
  const password = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  if (!username || !password || !confirmPassword) {
    showNotification("Please fill in all fields", "error");
    return;
  }

  if (password !== confirmPassword) {
    showNotification("Passwords do not match", "error");
    return;
  }

  if (localStorage.getItem(`password_${username}`)) {
    showNotification("Username already exists", "error");
    return;
  }

  localStorage.setItem(`password_${username}`, password);
  showNotification("Registration successful! Please login.");
  registerForm.reset();
  registerForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("username");
  showNotification("Logged out successfully");
  checkLoginState();
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  checkLoginState();
});
