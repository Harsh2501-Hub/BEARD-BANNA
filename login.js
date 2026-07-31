// ===============================
// LOGIN SYSTEM
// ===============================

const loginForm =
    document.getElementById("login-form");

loginForm.addEventListener("submit", function (e) {

    e.preventDefault();

    const email =
        document.getElementById("login-email")
            .value
            .trim()
            .toLowerCase();

    const password =
        document.getElementById("login-password")
            .value;

    const users =
        JSON.parse(localStorage.getItem("users")) || [];

    const user =
        users.find(u =>

            u.email === email &&
            u.password === password

        );

    if (!user) {

        alert("Invalid email or password.");

        return;

    }

    // Save Logged In User
    localStorage.setItem(

        "currentUser",

        JSON.stringify(user)

    );

    showToast("Welcome back, " + user.name + "!");

    setTimeout(() => {

        window.location.href = "index.html";

    }, 1500);

});