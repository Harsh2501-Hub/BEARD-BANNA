// ===============================
// CHECK LOGIN
// ===============================

const currentUser =
    JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {

    alert("Please login to continue.");

    window.location.href = "login.html";

}

// ===========================================
// BEARD BANNA CHECKOUT SYSTEM
// Part 1
// ===========================================

// ------------------------------
// Load Cart
// ------------------------------

const cart = JSON.parse(localStorage.getItem("cart")) || [];

const summary = document.getElementById("summary-items");

const subtotalElement = document.getElementById("subtotal");
const shippingElement = document.getElementById("shipping");
const grandTotalElement = document.getElementById("grandTotal");

let subtotal = 0;
let shipping = 0;
let grandTotal = 0;

// ------------------------------
// Empty Cart
// ------------------------------

if (cart.length === 0) {

    summary.innerHTML = `
        <p>Your cart is empty.</p>
    `;

} else {

    displaySummary();

}

// ------------------------------
// Display Order Summary
// ------------------------------

function displaySummary() {

    summary.innerHTML = "";

    subtotal = 0;

    cart.forEach(item => {

        const total = item.price * item.qty;

        subtotal += total;

        summary.innerHTML += `

        <div class="summary-item">

            <div>

                <strong>${item.name}</strong>

                <br>

                <small>

                    Qty : ${item.qty}

                    ${item.size ? "| Size : " + item.size : ""}

                </small>

            </div>

            <div>

                ₹${total}

            </div>

        </div>

        `;

    });

    calculateTotals();

}

// ------------------------------
// Shipping Calculation
// ------------------------------

function calculateTotals() {

    if (subtotal >= 1999) {

        shipping = 0;

    }

    else {

        shipping = 99;

    }

    grandTotal = subtotal + shipping;

    subtotalElement.innerHTML = "₹" + subtotal;

    shippingElement.innerHTML =

        shipping === 0

            ? "FREE"

            : "₹99";

    grandTotalElement.innerHTML =

        "₹" + grandTotal;

}

// ------------------------------
// Payment Sections
// ------------------------------

const paymentRadios = document.querySelectorAll(
    'input[name="payment"]'
);

const upiSection =
    document.getElementById("upi-section");

const cardSection =
    document.getElementById("card-section");

// Hide initially

upiSection.style.display = "none";

cardSection.style.display = "none";

// ------------------------------
// Payment Change
// ------------------------------

paymentRadios.forEach(radio => {

    radio.addEventListener("change", function () {

        upiSection.style.display = "none";

        cardSection.style.display = "none";

        if (this.value === "upi") {

            upiSection.style.display = "block";

        }

        if (

            this.value === "credit" ||

            this.value === "debit"

        ) {

            cardSection.style.display = "block";

        }

    });

});

// ===========================================
// PART 2
// Checkout Validation & Confirmation Popup
// ===========================================

const checkoutForm =
    document.getElementById("checkout-form");

let orderData = {};

// ------------------------------
// Checkout Form Submit
// ------------------------------

checkoutForm.addEventListener("submit", function (e) {

    e.preventDefault();

    // --------------------------
    // Customer Details
    // --------------------------

    const name =
        document.getElementById("name").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const phone =
        document.getElementById("phone").value.trim();

    const address =
        document.getElementById("address").value.trim();

    const city =
        document.getElementById("city").value.trim();

    const state =
        document.getElementById("state").value.trim();

    const pincode =
        document.getElementById("pincode").value.trim();

    const payment =
        document.querySelector('input[name="payment"]:checked');

    // --------------------------
    // Empty Validation
    // --------------------------

    if (
        !name ||
        !email ||
        !phone ||
        !address ||
        !city ||
        !state ||
        !pincode
    ) {

        alert("Please fill all required fields.");

        return;

    }

    // --------------------------
    // Email Validation
    // --------------------------

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {

        alert("Enter a valid Email Address.");

        return;

    }

    // --------------------------
    // Phone Validation
    // --------------------------

    const phonePattern =
        /^[6-9]\d{9}$/;

    if (!phonePattern.test(phone)) {

        alert("Enter a valid 10-digit Mobile Number.");

        return;

    }

    // --------------------------
    // PIN Code
    // --------------------------

    const pinPattern =
        /^\d{6}$/;

    if (!pinPattern.test(pincode)) {

        alert("Enter a valid 6-digit PIN Code.");

        return;

    }

    // --------------------------
    // Payment Selected
    // --------------------------

    if (!payment) {

        alert("Please choose a payment method.");

        return;

    }

    // --------------------------
    // UPI Validation
    // --------------------------

    if (payment.value === "upi") {

        const upi =
            document.getElementById("upi-id")
                .value
                .trim();

        if (upi === "") {

            alert("Please enter your UPI ID.");

            return;

        }

    }

    // --------------------------
    // Card Validation
    // --------------------------

    if (

        payment.value === "credit" ||

        payment.value === "debit"

    ) {

        const cardNumber =
            document.getElementById("card-number")
                .value
                .trim();

        const cardName =
            document.getElementById("card-name")
                .value
                .trim();

        const expiry =
            document.getElementById("expiry")
                .value
                .trim();

        const cvv =
            document.getElementById("cvv")
                .value
                .trim();

        if (

            !cardNumber ||

            !cardName ||

            !expiry ||

            !cvv

        ) {

            alert("Please complete your Card Details.");

            return;

        }

    }

    // --------------------------
    // Save Customer Data
    // --------------------------

    orderData = {

        name,

        email,

        phone,

        address,

        city,

        state,

        pincode,

        payment: payment.value

    };

    showConfirmation();

});

// ------------------------------
// Confirmation Popup
// ------------------------------

function showConfirmation() {

    const confirmProducts =
        document.getElementById("confirm-products");

    const confirmDetails =
        document.getElementById("confirm-details");

    confirmProducts.innerHTML = "";

    let totalItems = 0;

    cart.forEach(item => {

        totalItems += item.qty;

        confirmProducts.innerHTML += `

        <div class="confirm-item">

            <img src="${item.image}">

            <div>

                <h4>${item.name}</h4>

                <p>Qty : ${item.qty}</p>

                <p>Size : ${item.size}</p>

            </div>

        </div>

        `;

    });

    const delivery = new Date();

    delivery.setDate(delivery.getDate() + 5);

    const paymentNames = {

        cod: "Cash On Delivery",

        upi: "UPI",

        credit: "Credit Card",

        debit: "Debit Card"

    };

    confirmDetails.innerHTML = `

        <p><b>Total Items :</b> ${totalItems}</p>

        <p><b>Grand Total :</b> ₹${grandTotal}</p>

        <p><b>Payment :</b> ${paymentNames[orderData.payment]}</p>

        <p><b>Deliver To :</b></p>

        <p>

            ${orderData.address}<br>

            ${orderData.city}, ${orderData.state}<br>

            ${orderData.pincode}

        </p>

        <p>

            <b>Estimated Delivery :</b>

            ${delivery.toLocaleDateString("en-IN")}

        </p>

    `;

    document
        .getElementById("confirm-modal")
        .style.display = "flex";

}

// ===========================================
// PART 3
// Confirm Order & Helper Functions
// ===========================================

// ------------------------------
// Close Confirmation Popup
// ------------------------------

function closeModal() {

    document.getElementById("confirm-modal").style.display = "none";

}

// ------------------------------
// Confirm Order
// ------------------------------

function confirmOrder() {

    const btn = document.querySelector(".confirm-btn");

    btn.disabled = true;

    btn.innerHTML = `

        <span class="loader"></span>

        Processing...

    `;

    // Generate Order ID
    const orderId =
        "BB" +
        Date.now().toString().slice(-8);

    // Save Order

    const order = {

        orderId,

        customer: orderData,

        cart,

        subtotal,

        shipping,

        grandTotal,

        orderDate: new Date().toLocaleString()

    };

    localStorage.setItem(

        "lastOrder",

        JSON.stringify(order)

    );

    // Clear Cart

    localStorage.removeItem("cart");

    // Redirect

    setTimeout(() => {

        window.location.href =
            "order-success.html";

    }, 2000);

}

// ------------------------------
// Close Popup on Outside Click
// ------------------------------

window.addEventListener("click", function (e) {

    const modal = document.getElementById("confirm-modal");

    if (e.target === modal) {

        closeModal();

    }

});

// ------------------------------
// Auto Format Card Number
// ------------------------------

const cardNumber =
    document.getElementById("card-number");

if (cardNumber) {

    cardNumber.addEventListener("input", function () {

        let value = this.value.replace(/\D/g, "");

        value = value.replace(/(.{4})/g, "$1 ").trim();

        this.value = value;

    });

}

// ------------------------------
// Auto Format Expiry
// ------------------------------

const expiry =
    document.getElementById("expiry");

if (expiry) {

    expiry.addEventListener("input", function () {

        let value = this.value.replace(/\D/g, "");

        if (value.length > 2) {

            value =
                value.substring(0, 2) +
                "/" +
                value.substring(2, 4);

        }

        this.value = value;

    });

}

// ------------------------------
// Only Numbers in CVV
// ------------------------------

const cvv =
    document.getElementById("cvv");

if (cvv) {

    cvv.addEventListener("input", function () {

        this.value =
            this.value.replace(/\D/g, "");

    });

}

// ------------------------------
// Only Numbers in Phone
// ------------------------------

const phone =
    document.getElementById("phone");

if (phone) {

    phone.addEventListener("input", function () {

        this.value =
            this.value.replace(/\D/g, "");

    });

}

// ------------------------------
// Only Numbers in PIN Code
// ------------------------------

const pin =
    document.getElementById("pincode");

if (pin) {

    pin.addEventListener("input", function () {

        this.value =
            this.value.replace(/\D/g, "");

    });

}