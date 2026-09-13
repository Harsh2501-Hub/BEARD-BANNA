// ===============================
// UI UTILITIES
// ===============================

// Toast Message
// Toast Message
function showToast(message) {

    const oldToast =
        document.querySelector(".toast");

    if (oldToast) {

        oldToast.remove();

    }

    const toast =
        document.createElement("div");

    toast.className = "toast";

    toast.innerText = message;

    document.body.appendChild(toast);

    setTimeout(() => {

        toast.classList.add("show");

    }, 50);

    setTimeout(() => {

        toast.classList.remove("show");

        setTimeout(() => {

            toast.remove();

        }, 350);

    }, 2500);

}