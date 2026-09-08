import 'dotenv/config';
import { supabase } from '../server/lib/supabase.js';

async function run() {
  const orderId = `FB-TEST-${Date.now().toString().slice(-6)}`;
  console.log(`Creating fresh ₹1 test order: ${orderId}...`);

  const guestSessionId = `guest_test_${Date.now()}`;

  const orderData = {
    id: orderId,
    user_id: guestSessionId,
    items: [{ id: 'item_test_1', name: '₹1 UPI Test Item', price: 1, quantity: 1 }],
    subtotal: 1,
    discount: 0,
    delivery_charge: 0,
    total: 1,
    status: 'pending',
    payment_status: 'pending',
    payment_method: 'upi',
    phone: '9999999999',
    customer_name: 'UPI Test Customer',
    email: 'test@frostybite.com',
    address: '123 Frosty Lane, Frosty City',
    delivery_address: '123 Frosty Lane, Frosty City',
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('orders').insert(orderData).select();
  if (error) {
    console.error('Failed to insert test order:', error);
    process.exit(1);
  }

  console.log('Order created successfully in Supabase:');
  console.log(`- Order ID: ${orderId}`);
  console.log(`- Total: ₹${orderData.total}`);
  console.log(`- Status: ${orderData.status}`);
  console.log(`- Payment Status: ${orderData.payment_status}`);

  console.log('\nCalling POST /api/payment/create-attempt...');
  const res = await fetch('http://localhost:3000/api/payment/create-attempt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Guest-Session': guestSessionId
    },
    body: JSON.stringify({
      order_id: orderId,
      guest_session_id: guestSessionId,
      order_details: {
        id: orderId,
        totalPrice: 1
      }
    })
  });

  const resStatus = res.status;
  const resData = await res.json();
  console.log(`HTTP Status: ${resStatus}`);
  console.log('Response Data:', JSON.stringify(resData, null, 2));
}

run();
