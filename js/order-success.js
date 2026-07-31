const order =
    JSON.parse(localStorage.getItem("lastOrder"));

if (!order) {

    window.location.href = "index.html";

}

document.getElementById("order-id").innerHTML =
    order.orderId;

document.getElementById("order-date").innerHTML =
    new Date(order.orderDate).toLocaleDateString("en-IN");

const delivery = new Date();

delivery.setDate(delivery.getDate() + 5);

document.getElementById("delivery-date").innerHTML =
    delivery.toLocaleDateString("en-IN");

document.getElementById("payment-method").innerHTML =
    order.customer.payment.toUpperCase();

let items = 0;

order.cart.forEach(item => {

    items += item.qty;

});

document.getElementById("total-items").innerHTML =
    items;

document.getElementById("grand-total").innerHTML =
    order.grandTotal;

// ===================================
// INVOICE DETAILS
// ===================================

// Invoice Number
document.getElementById("invoice-no").innerHTML =
    "INV-" + order.orderId;

// Order ID
document.getElementById("invoice-order-id").innerHTML =
    order.orderId;

// Date
document.getElementById("invoice-date").innerHTML =
    new Date(order.orderDate).toLocaleDateString("en-IN");

// Customer
document.getElementById("invoice-name").innerHTML =
    order.customer.name;

document.getElementById("invoice-email").innerHTML =
    order.customer.email;

document.getElementById("invoice-phone").innerHTML =
    order.customer.phone;

document.getElementById("invoice-address").innerHTML =
    `
${order.customer.address}<br>
${order.customer.city},
${order.customer.state}
- ${order.customer.pincode}
`;

// Products
const invoiceProducts =
    document.getElementById("invoice-products");

invoiceProducts.innerHTML = "";

order.cart.forEach(item => {

    invoiceProducts.innerHTML += `

<tr>

<td>${item.name}</td>

<td>${item.qty}</td>

<td>₹${item.price}</td>

<td>₹${item.price * item.qty}</td>

</tr>

`;

});

// Totals
document.getElementById("invoice-subtotal").innerHTML =
    order.subtotal;

document.getElementById("invoice-shipping").innerHTML =
    order.shipping === 0 ? "FREE" : "₹99";

const paymentNames = {

    cod: "Cash On Delivery",

    upi: "UPI",

    credit: "Credit Card",

    debit: "Debit Card"

};

document.getElementById("invoice-payment").innerHTML =
    paymentNames[order.customer.payment];

document.getElementById("invoice-grand-total").innerHTML =
    order.grandTotal;

async function downloadInvoice() {

    const invoice = document.getElementById("invoice");

    // Make invoice visible temporarily
    invoice.style.left = "0";
    invoice.style.top = "0";

    const canvas = await html2canvas(invoice, {

        scale: 2,

        useCORS: true,

        backgroundColor: "#ffffff"

    });

    // Hide invoice again
    invoice.style.left = "-9999px";

    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({

        orientation: "portrait",

        unit: "mm",

        format: "a4"

    });

    const pageWidth = 210;

    const pageHeight = 297;

    const imgWidth = pageWidth - 20;

    const imgHeight =
        (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(

        imgData,

        "PNG",

        10,

        10,

        imgWidth,

        imgHeight

    );

    pdf.save(

        `BEARD_BANNA_Invoice_${order.orderId}.pdf`

    );

}