// ===============================
// ADMIN LOGIN
// ===============================

const ADMIN = Object.freeze({

    username: "admin",

    password: "123456"

});

// ===============================
// ADMIN SESSION HELPERS
// ===============================

function isAdminLoggedIn() {

    return localStorage.getItem("adminLoggedIn") === "true";

}

function saveAdminSession() {

    saveAdminSession();

}

function clearAdminSession() {

    localStorage.removeItem(

        "adminLoggedIn"

    );

}

const loginForm =
    document.getElementById("admin-login-form");

document.addEventListener("keydown", function (e) {

    if (

        e.key === "Enter"

        &&

        loginForm

    ) {

        loginForm.requestSubmit();

    }

});

if (loginForm) {

    loginForm.addEventListener("submit", loginAdmin);

}

function loginAdmin(e) {

    e.preventDefault();

    const username =

        document
            .getElementById("admin-username")
            .value
            .trim();

    const password =

        document
            .getElementById("admin-password")
            .value
            .trim();

    if (!username || !password) {

        showToast(

            "Please enter username and password",

            "error"

        );

        return;

    }

    if (

        username === ADMIN.username &&

        password === ADMIN.password

    ) {

        // Save Admin Session

        localStorage.setItem(

            "adminLoggedIn",

            "true"

        );

        // Redirect

        showToast(

            "✅ Login Successful",

            "success"

        );

    }

    else {

        showToast(

            "❌ Invalid Username or Password",

            "error"

        );

    }

}

// ===============================
// LOGIN PAGE CHECK
// ===============================

if (

    window.location.pathname.includes("login.html") &&

    isAdminLoggedIn()

) {

    setTimeout(() => {

        window.location.href = "dashboard.html";

    }, 1200);

}

// ===============================
// PROTECT ADMIN PAGES
// ===============================

if (

    !window.location.pathname.includes("login.html")

) {

    if (

        !isAdminLoggedIn()

    ) {

        setTimeout(() => {

            window.location.href = "login.html";

        }, 1200);

    }

}

// ===============================
// ADMIN LOGOUT
// ===============================

const logoutBtn =
    document.getElementById("logout-btn");

if (logoutBtn) {

    logoutBtn.addEventListener("click", logoutAdmin);

}

function logoutAdmin() {

    clearAdminSession();

    showToast(

        "👋 Logged Out Successfully",

        "success"

    );

}