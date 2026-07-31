// ===============================
// ADMIN DASHBOARD
// ===============================

const products = [

    {
        id: 1
    },

    {
        id: 2
    },

    {
        id: 3
    }

];

document.getElementById(

    "total-products"

).textContent = products.length;

const users =

    JSON.parse(

        localStorage.getItem("users")

    ) || [];

document.getElementById(

    "total-customers"

).textContent = users.length;

const orders =

    JSON.parse(

        localStorage.getItem("orders")

    ) || [];

document.getElementById(

    "total-orders"

).textContent = orders.length;

let revenue = 0;

orders.forEach(order => {

    revenue += order.total || 0;

});

document.getElementById(

    "total-revenue"

).textContent =

    "₹" + revenue.toLocaleString();

const wishlist =

    JSON.parse(

        localStorage.getItem("wishlist")

    ) || [];

document.getElementById(

    "total-wishlist"

).textContent = wishlist.length;

document.getElementById(

    "popular-product"

).textContent =

    products[0].name;

// ===============================
// RECENT ORDERS
// ===============================

const recentOrders = [

    {

        id: "#1001",

        customer: "Harsh",

        amount: "₹799",

        status: "Pending",

        date: "11 Jul"

    },

    {

        id: "#1002",

        customer: "Raj",

        amount: "₹1299",

        status: "Delivered",

        date: "10 Jul"

    }

];

const ordersBody =

    document.getElementById(

        "recent-orders-body"

    );

recentOrders.forEach(order => {

    ordersBody.innerHTML += `

        <tr>

            <td>${order.id}</td>

            <td>${order.customer}</td>

            <td>${order.amount}</td>

            <td>${order.status}</td>

            <td>${order.date}</td>

        </tr>

    `;

});

// ===============================
// RECENT CUSTOMERS
// ===============================

const recentCustomers = [

    {

        name: "Harsh",

        email: "harsh@email.com",

        phone: "9876543210"

    },

    {

        name: "Raj",

        email: "raj@email.com",

        phone: "9123456789"

    }

];

const customerBody =

    document.getElementById(

        "recent-customers-body"

    );

recentCustomers.forEach(customer => {

    customerBody.innerHTML += `

    <tr>

        <td>${customer.name}</td>

        <td>${customer.email}</td>

        <td>${customer.phone}</td>

    </tr>

    `;

});

// ===============================
// QUICK ACTIONS
// ===============================

document
    .getElementById("add-product-btn")
    .addEventListener("click", () => {

        window.location.href = "products.html";

    });

document
    .getElementById("view-orders-btn")
    .addEventListener("click", () => {

        window.location.href = "orders.html";

    });

document
    .getElementById("customers-btn")
    .addEventListener("click", () => {

        window.location.href = "customers.html";

    });

document
    .getElementById("settings-btn")
    .addEventListener("click", () => {

        window.location.href = "settings.html";

    });

// ===============================
// DASHBOARD READY
// ===============================

window.addEventListener("load", () => {

    console.log("Dashboard Loaded");

});

// ===============================
// TODAY'S DATE
// ===============================

const today = new Date();

document.getElementById(

    "today-date"

).textContent =

    today.toDateString();