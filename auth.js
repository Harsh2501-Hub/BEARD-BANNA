// ===============================
// AUTH SYSTEM
// ===============================

const currentUser =
    JSON.parse(localStorage.getItem("currentUser"));

const userArea =
    document.getElementById("user-area");

if (userArea) {

    if (currentUser) {

        userArea.innerHTML = `

<div class="user-dropdown">

    <button
        id="user-toggle"
        class="user-toggle">

        👤 ${currentUser.name} ▼

    </button>

    <div
        id="dropdown-menu"
        class="dropdown-menu">

        <a href="profile.html">

            👤 My Profile

        </a>

        <a href="track-order.html">

            📦 My Orders

        </a>

        <a href="wishlist.html">

            ❤️ Wishlist

        </a>

        <button onclick="logout()">

            Logout

        </button>

    </div>

</div>

`;

        const toggle =
            document.getElementById("user-toggle");

        const menu =
            document.getElementById("dropdown-menu");

        if (toggle) {

            toggle.addEventListener("click", () => {

                menu.classList.toggle("show-menu");

                toggle.classList.toggle("active");

            });

            document.addEventListener("click", (e) => {

                if (!toggle.contains(e.target)
                    &&
                    !menu.contains(e.target)) {

                    menu.classList.remove("show-menu");

                }

            });

        }
    }

}

function logout() {

    if (!confirm("Are you sure you want to logout?")) {

        return;

    }

    localStorage.removeItem("currentUser");

    showToast("👋 Logged out successfully!");

    setTimeout(() => {

        window.location.href = "login.html";

    }, 1500);

}