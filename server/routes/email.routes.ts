import express from 'express';
import { EmailService } from '../services/email.service';

const router = express.Router();

router.post('/welcome', async (req, res) => {
  const { email, name } = req.body;
  
  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name are required' });
  }

  try {
    const data = await EmailService.sendWelcomeEmail(email, name);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to send welcome email' });
  }
});

router.post('/order-confirmation', async (req, res) => {
  const { email, orderId, amount } = req.body;

  if (!email || !orderId || amount === undefined) {
    return res.status(400).json({ error: 'Email, orderId, and amount are required' });
  }

  try {
    const data = await EmailService.sendOrderEmail(email, orderId, amount);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to send order confirmation email' });
  }
});

router.post('/delivery-update', async (req, res) => {
  const { email, orderId, status } = req.body;

  if (!email || !orderId || !status) {
    return res.status(400).json({ error: 'Email, orderId, and status are required' });
  }

  try {
    const data = await EmailService.sendDeliveryEmail(email, orderId, status);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to send delivery update email' });
  }
});

export default router;
