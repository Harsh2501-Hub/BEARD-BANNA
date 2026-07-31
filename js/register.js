// ===============================
// REGISTER SYSTEM
// ===============================

const registerForm =
    document.getElementById("register-form");

registerForm.addEventListener("submit", function (e) {

    e.preventDefault();

    const name =
        document.getElementById("register-name").value.trim();

    const email =
        document.getElementById("register-email").value.trim().toLowerCase();

    const phone =
        document.getElementById("register-phone").value.trim();

    const password =
        document.getElementById("register-password").value;

    const confirmPassword =
        document.getElementById("confirm-password").value;

    // Password Match
    if (password !== confirmPassword) {

        alert("Passwords do not match.");

        return;

    }

    // Get existing users
    const users =
        JSON.parse(localStorage.getItem("users")) || [];

    // Email already exists?
    const exists =
        users.find(user => user.email === email);

    if (exists) {

        alert("An account with this email already exists.");

        return;

    }

    // Create User
    users.push({

        name,

        email,

        phone,

        password

    });

    localStorage.setItem(
        "users",
        JSON.stringify(users)
    );

    showToast("🎉 Account created successfully!");

    setTimeout(() => {

        window.location.href = "login.html";

    }, 1500);

});