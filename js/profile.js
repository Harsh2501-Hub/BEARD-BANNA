// ===============================
// PROFILE PAGE
// ===============================

const currentUser =
    JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {

    window.location.href = "login.html";

}

document.getElementById("profile-name").value =
    currentUser.name;

document.getElementById("profile-email").value =
    currentUser.email;

document.getElementById("profile-phone").value =
    currentUser.phone;

document
    .getElementById("profile-form")
    .addEventListener("submit", function (e) {

        e.preventDefault();

        const name =
            document.getElementById("profile-name")
                .value
                .trim();

        const phone =
            document.getElementById("profile-phone")
                .value
                .trim();

        // Validate Name
        if (name.length < 3) {

            showToast("Name must contain at least 3 characters.");

            return;

        }

        // Validate Phone
        if (!/^[6-9]\d{9}$/.test(phone)) {

            showToast("Enter a valid 10-digit phone number.");

            return;

        }

        currentUser.name = name;

        currentUser.phone = phone;

        // Update current user

        localStorage.setItem(

            "currentUser",

            JSON.stringify(currentUser)

        );

        // Update users array

        let users =
            JSON.parse(localStorage.getItem("users")) || [];

        users = users.map(user => {

            if (user.email === currentUser.email) {

                return currentUser;

            }

            return user;

        });

        localStorage.setItem(

            "users",

            JSON.stringify(users)

        );

        showToast("✅ Profile Updated Successfully!");

        const userToggle =
            document.getElementById("user-toggle");

        if (userToggle) {

            userToggle.innerHTML =
                `👤 ${currentUser.name} ▼`;

        }

    });