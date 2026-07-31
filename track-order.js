const currentUser =
    JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {

    alert("Please login first.");

    window.location.href = "login.html";

}

const order =
    JSON.parse(localStorage.getItem("lastOrder"));

if (!order) {

    window.location.href = "index.html";

}

document.getElementById("track-order-id").innerHTML =
    order.orderId;

document.getElementById("track-order-date").innerHTML =
    new Date(order.orderDate).toLocaleDateString("en-IN");

const delivery =
    new Date(order.orderDate);

delivery.setDate(
    delivery.getDate() + 5
);

document.getElementById("track-delivery-date").innerHTML =
    delivery.toLocaleDateString("en-IN");

document.getElementById("customer-name").innerHTML =
    order.customer.name;

document.getElementById("customer-email").innerHTML =
    order.customer.email;

document.getElementById("customer-phone").innerHTML =
    order.customer.phone;

document.getElementById("customer-address").innerHTML =

    `${order.customer.address},

${order.customer.city},

${order.customer.state}

- ${order.customer.pincode}`;

document.getElementById("tracking-number").innerHTML =
    "BBX" + order.orderId.replace("BB", "");

// ==============================
// Animated Tracking Progress
// ==============================

const steps = [

    document.getElementById("step1"),
    document.getElementById("step2"),
    document.getElementById("step3"),
    document.getElementById("step4"),
    document.getElementById("step5")

];

const times = [

    document.getElementById("time1"),
    document.getElementById("time2"),
    document.getElementById("time3"),
    document.getElementById("time4"),
    document.getElementById("time5")

];

const progressFill =
    document.getElementById("progress-fill");

const progressPercent =
    document.getElementById("progress-percent");

const currentStatus =
    document.getElementById("current-status");

// ===========================
// Persistent Tracking Progress
// ===========================

let current =
    Number(localStorage.getItem("trackingStage")) || 0;

function getCurrentTime() {

    return new Date().toLocaleTimeString("en-IN", {

        hour: "2-digit",

        minute: "2-digit"

    });

}

// Show completed stages

for (let i = 0; i <= current; i++) {

    steps[i].classList.add("active");

    if (!times[i].innerHTML) {

        times[i].innerHTML =
            "Completed at " + getCurrentTime();

    }

}

const initialPercent =
    ((current + 1) / steps.length) * 100;

progressFill.style.width =
    initialPercent + "%";

progressPercent.innerHTML =
    initialPercent + "%";

currentStatus.innerHTML =
    "Current Status : " +
    statusText[current];

const interval = setInterval(() => {

    current++;

    if (current >= steps.length) {

        clearInterval(interval);

        localStorage.removeItem("trackingStage");

        return;

    }

    steps[current].classList.add("active");

    times[current].innerHTML =
        "Completed at " + getCurrentTime();

    // Update the delivery panel
    updateDelivery();

    localStorage.setItem("trackingStage", current);

}, 5000);
// ==============================
// Delivery Animation
// ==============================

const van =
    document.querySelector(".delivery-van");

const arrival =
    document.getElementById("arrival-time");

const message =
    document.getElementById("delivery-message");

function updateDelivery() {

    const percent =
        ((current + 1) / steps.length) * 100;

    van.style.left =
        (percent - 5) + "%";

    const texts = [

        "Your order has been confirmed.",

        "Your parcel is being packed.",

        "Your parcel has been shipped.",

        "Your parcel is out for delivery.",

        "Your parcel has been delivered successfully."

    ];

    message.innerHTML = texts[current];

    const hoursLeft = Math.max(0, 24 - (current * 6));

    arrival.innerHTML =
        hoursLeft > 0
            ? hoursLeft + " Hours"
            : "Delivered";

}

updateDelivery();

setInterval(updateDelivery, 1000);